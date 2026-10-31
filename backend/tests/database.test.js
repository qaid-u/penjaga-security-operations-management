const {test}=require('node:test');
const assert=require('node:assert/strict');
const {configureDemo}=require('../scripts/phase5-demo-config');
configureDemo();
const {Pool}=require('pg');
const fs=require('node:fs/promises');
const path=require('node:path');
const {dbOptions}=require('../config/dbOptions');
const {loadMigrations,migrationStatus,migrate}=require('../database/migrate');
const {clientEnvironment}=require('../scripts/backup-database');

test('connections are provider neutral, bounded and default to Malaysian civil time',()=>{
  const local=dbOptions({DATABASE_URL:'postgresql://user:fixture@localhost/db'});
  assert.equal(local.ssl,false);assert.equal(local.max,10);assert.equal(local.options,'-c timezone=Asia/Kuala_Lumpur');
  assert.equal(dbOptions({PGOPTIONS:'-c timezone=UTC'}).options,'-c timezone=UTC');
  const remote=dbOptions({NODE_ENV:'production',DATABASE_URL:'postgresql://user:fixture@db.example.invalid/db?sslmode=require'});
  assert.equal(remote.ssl.rejectUnauthorized,true);assert.ok(!remote.connectionString.includes('sslmode='));
  const env=clientEnvironment({PGOPTIONS:'-c timezone=UTC',NODE_ENV:'production',DATABASE_URL:'postgresql://user:p%40ss@db.example.invalid:5433/db%20name?sslmode=require'});
  assert.equal(env.PGSSLMODE,'verify-full');assert.equal(env.PGPORT,'5433');assert.equal(env.PGPASSWORD,'p@ss');assert.equal(env.PGDATABASE,'db name');
});

test('database migrations enforce integrity, preserve rows and remain safe to repeat',async t=>{
  const schema=`penjaga_database_test_${process.pid}_${Date.now()}`;
  const admin=new Pool(dbOptions());
  const pool=new Pool({...dbOptions(),options:`-c search_path=${schema} -c timezone=Asia/Kuala_Lumpur`});
  const migrations=await loadMigrations();
  try{
    await admin.query(`create schema ${schema}`);
    await t.test('status is read only and empty databases require explicit initialization',async()=>{
      assert.equal((await migrationStatus(pool,migrations)).initialized,false);
      await assert.rejects(migrate(pool),/Empty database/);
      assert.equal((await pool.query("select to_regclass('tbl_schema_migrations') as ledger")).rows[0].ledger,null);
    });
    await t.test('fresh setup applies all ordered migrations without demo accounts',async()=>{
      const result=await migrate(pool,{initialize:true});assert.equal(result.initialized,true);assert.equal(result.applied.length,migrations.length);
      assert.equal((await pool.query('select count(*)::int n from tbl_pengguna')).rows[0].n,0);
      assert.equal((await pool.query('select count(*)::int n from tbl_peranan')).rows[0].n,3);
      assert.ok((await migrationStatus(pool,migrations)).migrations.every(m=>m.status==='applied'));
      assert.equal((await pool.query("select count(*)::int n from pg_constraint where connamespace=current_schema()::regnamespace and conname like 'ck_penjaga_%' and not convalidated")).rows[0].n,0);
    });
    await pool.query("insert into tbl_pengguna(id_peranan,nama_penuh,emel,nama_pengguna,kata_laluan) values(1,'Synthetic user','db@example.invalid','db_test','unused-test-hash')");
    const user=(await pool.query('select id_pengguna from tbl_pengguna')).rows[0].id_pengguna;
    const post=(await pool.query('select min(id_pos) as id from tbl_pos_kawalan')).rows[0].id;
    const report=(await pool.query("insert into tbl_laporan_harian(id_pengguna,id_pos,tajuk_laporan,syif,tarikh_laporan,masa_laporan,kandungan_laporan) values($1,$2,'Synthetic report','Malam','2026-10-30','23:00','Test data') returning id_laporan",[user,post])).rows[0].id_laporan;
    assert.equal((await pool.query('select tahap_risiko from tbl_laporan_harian where id_laporan=$1',[report])).rows[0].tahap_risiko,'Unknown');
    await t.test('direct writes reject invalid states and preserve valid overnight shifts',async()=>{
      for(const sql of [
        "update tbl_laporan_harian set status_laporan='Invalid'",
        "update tbl_laporan_harian set syif='Invalid'",
        "update tbl_pengguna set status_akaun='Invalid'",
      ])await assert.rejects(pool.query(sql),error=>error.code==='23514');
      await assert.rejects(pool.query("insert into tbl_keperluan_pos(id_pos,syif,bilangan_diperlukan) values($1,'Pagi',-1)",[post]),error=>error.code==='23514');
      await assert.rejects(pool.query("insert into tbl_jadual_mingguan(tarikh_mula,tarikh_tamat) values('2026-10-31','2026-10-30')"),error=>error.code==='23514');
      const week=(await pool.query("insert into tbl_jadual_mingguan(tarikh_mula,tarikh_tamat) values('2026-10-26','2026-11-01') returning id_jadual_mingguan")).rows[0].id_jadual_mingguan;
      const assignment=(await pool.query("insert into tbl_jadual_bertugas(id_jadual_mingguan,id_pengguna,id_pos,tarikh_tugas,syif,masa_mula,masa_tamat) values($1,$2,$3,'2026-10-30','Malam','23:00','07:00') returning id_jadual",[week,user,post])).rows[0].id_jadual;
      await assert.rejects(pool.query('update tbl_jadual_bertugas set masa_tamat=masa_mula'),error=>error.code==='23514');
      await assert.rejects(pool.query("insert into tbl_kehadiran_tugas(id_jadual,id_pengguna,masa_check_out) values($1,$2,now())",[assignment,user]),error=>error.code==='23514');
      await pool.query("insert into tbl_kehadiran_tugas(id_jadual,id_pengguna,masa_check_in,masa_check_out) values($1,$2,'2026-10-30 23:00','2026-10-31 07:00')",[assignment,user]);
      await assert.rejects(pool.query("update tbl_kehadiran_tugas set masa_check_out='2026-10-30 22:00'"),error=>error.code==='23514');
      await pool.query("insert into tbl_pengesahan_laporan(id_laporan,id_pengguna_pengesah,status_pengesahan) values($1,$2,'Diluluskan')",[report,user]);
      await assert.rejects(pool.query("insert into tbl_pengesahan_laporan(id_laporan,id_pengguna_pengesah,status_pengesahan) values($1,$2,'Diluluskan')",[report,user]),error=>error.code==='23505');
      const checklist=(await pool.query("insert into tbl_checklist(nama_checklist) values('Synthetic item') returning id_checklist")).rows[0].id_checklist;
      await pool.query("insert into tbl_jawapan_checklist(id_laporan,id_checklist,jawapan) values($1,$2,'Ya')",[report,checklist]);
      await assert.rejects(pool.query("insert into tbl_jawapan_checklist(id_laporan,id_checklist,jawapan) values($1,$2,'Ya')",[report,checklist]),error=>error.code==='23505');
    });
    await t.test('concurrent upgrades serialize and reruns preserve existing records',async()=>{
      const before=(await pool.query('select row_to_json(l) as data from tbl_laporan_harian l')).rows;
      const results=await Promise.all([migrate(pool),migrate(pool)]);assert.ok(results.every(r=>r.applied.length===0));
      assert.deepEqual((await pool.query('select row_to_json(l) as data from tbl_laporan_harian l')).rows,before);
      await assert.rejects(migrate(pool,{migrations:migrations.map((m,i)=>i===0?{...m,checksum:'0'.repeat(64)}:m)}),/checksum changed/);
    });
    await t.test('failed SQL and its ledger entry roll back together',async()=>{
      const bad={name:'999_rollback_test.sql',checksum:'a'.repeat(64),sql:"create table rollback_probe(id int); select * from nonexistent_migration_probe"};
      await assert.rejects(migrate(pool,{migrations:[...migrations,bad]}),error=>error.code==='42P01');
      assert.equal((await pool.query("select to_regclass('rollback_probe') as probe")).rows[0].probe,null);
      assert.equal((await pool.query("select count(*)::int n from tbl_schema_migrations where name=$1",[bad.name])).rows[0].n,0);
    });
    await t.test('existing invalid rows stop upgrades without rewriting history',async()=>{
      const legacy=`${schema}_legacy`;
      await admin.query(`create schema ${legacy}`);
      const old=new Pool({...dbOptions(),options:`-c search_path=${legacy}`});
      try{
        await old.query(await fs.readFile(path.join(__dirname,'../database/schema.sql'),'utf8'));
        await old.query("insert into tbl_pos_kawalan(nama_pos,status_pos) values('Historical post','Legacy invalid')");
        await assert.rejects(migrate(old),error=>error.code==='23514');
        assert.equal((await old.query('select status_pos from tbl_pos_kawalan')).rows[0].status_pos,'Legacy invalid');
        assert.equal((await old.query("select to_regclass('tbl_schema_migrations') as ledger")).rows[0].ledger,null);
      }finally{await old.end();await admin.query(`drop schema ${legacy} cascade`);}
    });
    await t.test('recognized historical action label is normalized once with an audit record',async()=>{
      const legacy=`${schema}_alias`;
      await admin.query(`create schema ${legacy}`);
      const old=new Pool({...dbOptions(),options:`-c search_path=${legacy}`});
      try{
        await migrate(old,{initialize:true,migrations:migrations.filter(m=>!m.name.startsWith('007_'))});
        const user=(await old.query("insert into tbl_pengguna(id_peranan,nama_penuh,emel,nama_pengguna,kata_laluan) values(1,'Synthetic','alias@example.invalid','alias','unused') returning id_pengguna")).rows[0].id_pengguna;
        const post=(await old.query('select min(id_pos) as id from tbl_pos_kawalan')).rows[0].id;
        const report=(await old.query("insert into tbl_laporan_harian(id_pengguna,id_pos,tajuk_laporan,syif,tarikh_laporan,masa_laporan,kandungan_laporan,status_laporan) values($1,$2,'Legacy alias','Pagi','2026-10-30','08:00','Synthetic','Diluluskan') returning id_laporan",[user,post])).rows[0].id_laporan;
        const action=(await old.query("insert into tbl_tindakan_susulan(id_laporan,pegawai_bertanggungjawab,tindakan_diambil,status_tindakan) values($1,'Synthetic','Preserve this action','Dalam Proses') returning *",[report])).rows[0];
        await migrate(old);
        const after=(await old.query('select * from tbl_tindakan_susulan where id_tindakan=$1',[action.id_tindakan])).rows[0];
        assert.deepEqual(after,{...action,status_tindakan:'Dalam Tindakan'});
        const audit=(await old.query("select rekod_terlibat,nilai_lama,nilai_baharu from tbl_audit_trail where jenis_aktiviti='NORMALIZE_ACTION_STATUS'")).rows;
        assert.deepEqual(audit,[{rekod_terlibat:'Tindakan #'+action.id_tindakan,nilai_lama:'Dalam Proses',nilai_baharu:'Dalam Tindakan'}]);
        await migrate(old);
        assert.equal((await old.query("select count(*)::int n from tbl_audit_trail where jenis_aktiviti='NORMALIZE_ACTION_STATUS'")).rows[0].n,1);
      }finally{await old.end();await admin.query(`drop schema ${legacy} cascade`);}
    });
  }finally{await pool.end();await admin.query(`drop schema ${schema} cascade`);await admin.end();}
});
