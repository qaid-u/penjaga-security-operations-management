// Creates only a named, local synthetic database; never resets an existing database.
const { configureDemo } = require('./phase5-demo-config');
const { dbOptions } = require('../config/dbOptions');
const { Pool } = require('pg');
const fs = require('node:fs/promises');
const path = require('node:path');
const bcrypt = require('bcrypt');
async function main() {
  configureDemo('penjaga_phase6_demo');
  const config = dbOptions();
  const adminConfig = { ...config, database: 'postgres' };
  if (config.connectionString) {
    const url = new URL(config.connectionString); url.pathname = '/postgres'; adminConfig.connectionString = url.toString();
  }
  const admin = new Pool(adminConfig);
  try {
    if (!(await admin.query('select 1 from pg_database where datname=$1', ['penjaga_phase6_demo'])).rowCount) await admin.query('create database penjaga_phase6_demo');
  } finally { await admin.end(); }
  const pool = new Pool(config);
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('select pg_advisory_xact_lock(7416, 1)');
    const tables = await client.query("select tablename from pg_tables where schemaname='public'");
    if (tables.rowCount) {
      if (!tables.rows.some(r => r.tablename === 'phase6_demo_manifest')) throw new Error('Target is not an identified Phase 6 demonstration database; refusing changes.');
      if ((await client.query('select version from phase6_demo_manifest')).rows[0]?.version !== 1) throw new Error('Unexpected demonstration version.');
      await client.query(await fs.readFile(path.join(__dirname,'../database/migrations/004_nlp_review.sql'),'utf8'));
      await client.query("insert into tbl_jadual_mingguan(tarikh_mula,tarikh_tamat,tajuk_jadual,dicipta_oleh) select current_date-1,current_date+5,'DEMO Phase 6',1 where not exists(select 1 from tbl_jadual_mingguan where current_date between tarikh_mula and tarikh_tamat)");
      await client.query('commit');
      console.log('Existing Phase 6 synthetic database retained; a current demonstration week is appended only if needed.'); return;
    }
    await client.query("set local timezone='Asia/Kuala_Lumpur'");
    for (const file of ['schema.sql', 'roles.sql', 'migrations/003_lokasi_3d.sql','migrations/004_nlp_review.sql']) await client.query(await fs.readFile(path.join(__dirname, '../database', file), 'utf8'));
    const password = process.env.PHASE6_DEMO_PASSWORD;
    if (!password || password.length < 10) throw new Error('Set PHASE6_DEMO_PASSWORD (10+ characters) for isolated synthetic accounts.');
    const hash = await bcrypt.hash(password, 10);
    for (const [role, name] of [[1,'admin'],[2,'chief'],[3,'guard_a'],[3,'guard_b']]) {
      await client.query('insert into tbl_pengguna(id_peranan,nama_penuh,emel,nama_pengguna,kata_laluan) values($1,$2,$3,$4,$5)', [role,`DEMO ${name}`,`${name}@example.invalid`,`demo_${name}`,hash]);
    }
    await client.query(`
      insert into tbl_pos_kawalan(nama_pos,nama_bangunan,lokasi) values
        ('DEMO Pos A','Bangunan demonstrasi','Zon sintetik A'),('DEMO Pos B','Bangunan demonstrasi','Zon sintetik B');
      update tbl_lokasi_3d set id_pos=case hotspot_id when 'HOTSPOT_MAIN_ENTRANCE' then 1 when 'HOTSPOT_LEFT_WING' then 2 end;
      insert into tbl_kategori_insiden(nama_kategori,tahap_keutamaan,kata_kunci_rujukan) values
        ('DEMO Pencerobohan','High',array['pencerobohan','pecah masuk']),('Rondaan Biasa','Low',array['rondaan','selamat']);
      insert into tbl_checklist(nama_checklist,penerangan_checklist,kategori_checklist) values
        ('DEMO Pintu diperiksa','Pemeriksaan sintetik sahaja','DEMO');
      insert into tbl_jadual_mingguan(tarikh_mula,tarikh_tamat,tajuk_jadual,dicipta_oleh)
        values(current_date-1,current_date+5,'DEMO Phase 6',1);
      insert into tbl_keperluan_pos(id_pos,syif,bilangan_diperlukan) values(1,'Pagi',1),(2,'Malam',1);
      create table phase6_demo_manifest(version int not null,created_at timestamptz default now());
      insert into phase6_demo_manifest(version) values(1);
    `);
    await client.query('commit');
    console.log('Prepared penjaga_phase6_demo with synthetic accounts, categories, checklist, posts and week. No operational records changed.');
  } catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); await pool.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode=1; });
