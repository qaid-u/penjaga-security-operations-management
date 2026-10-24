// Creates a separate local synthetic database. Never clears or resets an existing database.
const { configureDemo, database } = require('./phase5-demo-config');
const { Pool } = require('pg');
const fs = require('node:fs/promises');
const path = require('node:path');
const bcrypt = require('bcrypt');
async function main() {
  configureDemo();
  const connection = process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : { host:process.env.PGHOST || 'localhost',port:Number(process.env.PGPORT)||5432,user:process.env.PGUSER || 'postgres',password:process.env.PGPASSWORD || 'postgres',database };
  const adminConfig = { ...connection, database:'postgres' };
  if (connection.connectionString) { const url=new URL(connection.connectionString);url.pathname='/postgres';adminConfig.connectionString=url.toString(); }
  const admin = new Pool(adminConfig);
  try {
    if (!(await admin.query('select 1 from pg_database where datname=$1',[database])).rowCount) await admin.query('create database penjaga_phase5_demo');
  } finally { await admin.end(); }
  const pool = new Pool(connection);
  const client = await pool.connect();
  try {
    const tables = await client.query("select tablename from pg_tables where schemaname='public'");
    if (tables.rowCount) {
      if (!tables.rows.some((r)=>r.tablename==='phase5_demo_manifest')) throw new Error('Target database is not an identified Phase 5 demo; refusing to modify it.');
      const manifest = await client.query('select version from phase5_demo_manifest');
      if(manifest.rows[0]?.version !== 1)throw new Error('Unexpected demo version; no changes made.');
      console.log('Existing Phase 5 synthetic demo retained. No reseeding performed.');return;
    }
    await client.query('begin');
    await client.query("set local timezone = 'Asia/Kuala_Lumpur'");
    await client.query(await fs.readFile(path.join(__dirname,'../database/schema.sql'),'utf8'));
    await client.query(await fs.readFile(path.join(__dirname,'../database/migrations/003_lokasi_3d.sql'),'utf8'));
    const hash = await bcrypt.hash(process.env.PHASE5_DEMO_PASSWORD || 'Demo-Penjaga-2026!',10);
    await client.query("insert into tbl_peranan(id_peranan,nama_peranan,tahap_capaian) values (1,'Pentadbir Sistem',1),(2,'Ketua Pengawal',2),(3,'Pengawal Keselamatan',3)");
    for(const [id,role,name] of [[1,1,'admin'],[2,2,'chief'],[3,3,'guard_a'],[4,3,'guard_b']]) await client.query('insert into tbl_pengguna(id_pengguna,id_peranan,nama_penuh,emel,nama_pengguna,kata_laluan) values($1,$2,$3,$4,$5,$6)',[id,role,`Demo ${name}`,`${name}@example.invalid`,`demo_${name}`,hash]);
    await client.query(`
      insert into tbl_pos_kawalan(id_pos,nama_pos,nama_bangunan,lokasi,status_pos) values
       (1,'DEMO Pos A','Bangunan demonstrasi','Zon sintetik A','Aktif'),(2,'DEMO Pos B','Bangunan demonstrasi','Zon sintetik B','Aktif'),(3,'DEMO Tanpa Pautan','Bangunan demonstrasi','Tidak dipetakan','Aktif');
      update tbl_lokasi_3d set id_pos=case hotspot_id when 'HOTSPOT_MAIN_ENTRANCE' then 1 when 'HOTSPOT_LEFT_WING' then 2 end;
      insert into tbl_jadual_mingguan(id_jadual_mingguan,tarikh_mula,tarikh_tamat,status_jadual) values(1,'2026-10-19','2026-10-25','Disahkan');
      insert into tbl_jadual_bertugas(id_jadual,id_jadual_mingguan,id_pengguna,id_pos,tarikh_tugas,syif,masa_mula,masa_tamat) values
        (1,1,3,1,'2026-10-23','Malam','23:00','08:00'),(2,1,4,2,'2026-10-24','Pagi','07:00','16:00');
      insert into tbl_kehadiran_tugas(id_jadual,id_pengguna,masa_check_in) values(1,3,'2026-10-23 23:03');
      insert into tbl_laporan_harian(id_laporan,id_pengguna,id_pos,tajuk_laporan,syif,tarikh_laporan,masa_laporan,kandungan_laporan,status_laporan)
        select i,case when i%2=1 then 3 else 4 end,1+(i-1)%3,'DEMO Laporan '||i,'Pagi',date '2026-10-24' - ((i-1)%30),time '09:00','Rekod sintetik untuk penilaian sahaja',case when i%3=0 then 'Diluluskan' else 'Dihantar' end from generate_series(1,240) i;
      insert into tbl_hasil_nlp(id_laporan,teks_diproses,kategori_dikesan,skor_risiko,tahap_risiko,tarikh_analisis)
        select i,'teks sintetik','DEMO Kategori',case when i%2=1 then 75 else 15 end,case when i%2=1 then 'High' else 'Low' end,timestamp '2026-10-24 10:00' from generate_series(1,239) i;
      insert into tbl_hasil_nlp(id_laporan,teks_diproses,kategori_dikesan,skor_risiko,tahap_risiko,tarikh_analisis) values(1,'teks sintetik lama','DEMO Lama',10,'Low','2026-10-24 09:00');
      insert into tbl_tindakan_susulan(id_tindakan,id_laporan,pegawai_bertanggungjawab,tindakan_diambil,status_tindakan) values
        (1,1,'Demo Admin','Tindakan sintetik','Dalam Tindakan'),(2,2,'Demo Admin','Tindakan sintetik','Baru'),(3,3,'Demo Admin','Tindakan sintetik','Selesai');
      insert into tbl_progress_tindakan(id_tindakan,id_pengguna,catatan_progress,jenis_progress) values(1,2,'Kemajuan sintetik','Kemaskini Ketua');
      create table phase5_demo_manifest(version int not null,created_at timestamptz default now());
      insert into phase5_demo_manifest(version) values(1);
    `);
    for(const [table,column] of [['tbl_pengguna','id_pengguna'],['tbl_peranan','id_peranan'],['tbl_pos_kawalan','id_pos'],['tbl_jadual_mingguan','id_jadual_mingguan'],['tbl_jadual_bertugas','id_jadual'],['tbl_laporan_harian','id_laporan'],['tbl_tindakan_susulan','id_tindakan']])await client.query(`select setval(pg_get_serial_sequence('${table}','${column}'),(select max(${column}) from ${table}))`);
    await client.query('commit');
    console.log('Created penjaga_phase5_demo: 4 synthetic accounts, 3 posts, 240 reports; date 2026-10-24. No operational database records changed.');
  } catch(error) {await client.query('rollback');throw error;}
  finally {client.release();await pool.end();}
}
main().catch((error)=>{console.error(error.message);process.exitCode=1;});
