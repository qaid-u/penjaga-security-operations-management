const {test}=require('node:test');
const assert=require('node:assert/strict');
const {configureDemo}=require('../scripts/phase5-demo-config');
configureDemo();
const {Pool}=require('pg');
const {dbOptions}=require('../config/dbOptions');
const {migrate}=require('../database/migrate');
const {seedDemoRecords}=require('../scripts/seed-demo-records');
const {categories}=require('../../tests/phase7/fixtures/independent-challenges.json');

test('demo records are additive, classifier-backed, conflict-aware and safe to rerun',async()=>{
  const schema=`penjaga_demo_seed_test_${process.pid}_${Date.now()}`;
  const admin=new Pool(dbOptions());
  const pool=new Pool({...dbOptions(),options:`-c search_path=${schema} -c timezone=Asia/Kuala_Lumpur`});
  try{
    await admin.query(`create schema ${schema}`);await migrate(pool,{initialize:true});
    for(const [role,username]of [[1,'test_admin'],[2,'test_ketua'],[3,'test_pengawal']])await pool.query('insert into tbl_pengguna(id_peranan,nama_penuh,nama_pengguna,emel,kata_laluan) values($1,$2,$2,$3,$4)',[role,username,username+'@example.invalid','unused-test-hash']);
    for(const c of categories)await pool.query('insert into tbl_kategori_insiden(nama_kategori,tahap_keutamaan,kata_kunci_rujukan) values($1,$2,$3)',[c.name,c.priority,c.keywords]);
    const guard=(await pool.query("select id_pengguna from tbl_pengguna where nama_pengguna='test_pengawal'")).rows[0].id_pengguna;
    const post=(await pool.query('select min(id_pos) as id from tbl_pos_kawalan')).rows[0].id;
    const original=(await pool.query("insert into tbl_laporan_harian(id_pengguna,id_pos,tajuk_laporan,syif,tarikh_laporan,masa_laporan,kandungan_laporan) values($1,$2,'Existing report','Pagi',current_date,'09:00','Preserve this record') returning *",[guard,post])).rows[0];
    const week=(await pool.query("insert into tbl_jadual_mingguan(tarikh_mula,tarikh_tamat,tajuk_jadual) values(date_trunc('week',current_date)::date,date_trunc('week',current_date)::date+6,'Existing week') returning id_jadual_mingguan")).rows[0].id_jadual_mingguan;
    const duty=(await pool.query("insert into tbl_jadual_bertugas(id_jadual_mingguan,id_pengguna,id_pos,tarikh_tugas,syif,masa_mula,masa_tamat,catatan) values($1,$2,$3,current_date,'Pagi','08:00','16:00','Existing assignment') returning *",[week,guard,post])).rows[0];
    const result=await seedDemoRecords(pool);
    assert.equal(result.reports,28);assert.equal(result.submitted,8);assert.equal(result.approved,16);assert.equal(result.rejected,4);assert.equal(result.actions,8);assert.equal(result.pendingFollowUps,4);
    assert.equal(result.skippedConflicts,1);assert.equal(result.assignments,13);assert.equal(result.attendance,7);
    assert.deepEqual((await pool.query('select * from tbl_laporan_harian where id_laporan=$1',[original.id_laporan])).rows[0],original);
    assert.deepEqual((await pool.query('select * from tbl_jadual_bertugas where id_jadual=$1',[duty.id_jadual])).rows[0],duty);
    assert.equal((await pool.query('select count(*)::int n from tbl_hasil_nlp where metadata->>\'synthetic\'=\'true\'')).rows[0].n,28);
    assert.equal((await pool.query('select count(*)::int n from tbl_job_nlp where status=\'completed\'')).rows[0].n,28);
    assert.equal((await pool.query('select count(*)::int n from tbl_notifikasi')).rows[0].n,0,'Demo data must not emit operational alerts');
    const again=await seedDemoRecords(pool);assert.equal(again.alreadyPresent,true);
    assert.equal((await pool.query('select count(*)::int n from tbl_laporan_harian')).rows[0].n,29);
    assert.equal((await pool.query('select count(*)::int n from tbl_tindakan_susulan')).rows[0].n,8);
  }finally{await pool.end();await admin.query(`drop schema if exists ${schema} cascade`);await admin.end();}
});
