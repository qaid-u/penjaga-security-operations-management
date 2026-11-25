// A DATE column has no time or zone, so the API must return it exactly as stored.
// East of UTC, pg's default Date parsing serialises it as the previous day.
process.env.TZ='Asia/Kuala_Lumpur'; // CI runs in UTC, where the shift never appears
process.env.NLP_WORKER_ENABLED='false';
process.env.NLP_AI_REVIEW_ENABLED='false';
process.env.NLP_AUTO_TRAIN_ENABLED='false';
process.env.PORT='0';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {configureDemo}=require('../scripts/phase5-demo-config');
configureDemo();
const {Pool}=require('pg');
const {dbOptions}=require('../config/dbOptions');
const {migrate}=require('../database/migrate');

test('APIs return calendar dates unshifted under Asia/Kuala_Lumpur',async()=>{
  assert.equal(new Date(2026,10,25).getTimezoneOffset(),-480,'The test must run in UTC+8');
  const schema=`penjaga_date_test_${process.pid}_${Date.now()}`;
  const admin=new Pool(dbOptions());
  const pool=require('../config/db');
  pool.options.options=`-c search_path=${schema} -c timezone=Asia/Kuala_Lumpur`;
  let server;
  try{
    await admin.query(`create schema ${schema}`);
    await migrate(pool,{initialize:true});
    await pool.query(`insert into tbl_pengguna(id_pengguna,id_peranan,nama_penuh,nama_pengguna,emel,kata_laluan) values
      (1,1,'Admin','date_admin','admin@example.invalid','unused'),(2,2,'Chief','date_chief','chief@example.invalid','unused'),
      (3,3,'Guard','date_guard','guard@example.invalid','unused')`);
    const post=(await pool.query('select min(id_pos)::int as id from tbl_pos_kawalan')).rows[0].id;
    const report=(await pool.query(`insert into tbl_laporan_harian(id_pengguna,id_pos,tajuk_laporan,syif,tarikh_laporan,masa_laporan,kandungan_laporan,status_laporan)
      values(3,$1,'SYNTHETIC calendar date','Pagi','2026-11-25','00:30','Routine patrol','Diluluskan') returning id_laporan`,[post])).rows[0].id_laporan;
    await pool.query(`insert into tbl_tindakan_susulan(id_laporan,pegawai_bertanggungjawab,tindakan_diambil,status_tindakan,tarikh_mula,tarikh_selesai)
      values($1,'Synthetic officer','Synthetic follow-up','Selesai','2026-11-25','2026-11-26')`,[report]);
    server=require('../server');if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));
    const base=`http://127.0.0.1:${server.address().port}/api`;
    const jwt=require('jsonwebtoken');const {jwtSecret}=require('../middleware/auth');
    const request=async(url,user,method='GET',body)=>{
      const response=await fetch(base+url,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${jwt.sign({id:user},jwtSecret,{expiresIn:'5m'})}`},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
      const data=await response.json();
      assert.ok(response.ok,`${method} ${url} returned ${response.status}: ${data.message}`);
      return data;
    };

    const detail=await request(`/reports/${report}`,2);
    assert.equal(detail.report.tarikh_laporan,'2026-11-25','report detail');
    assert.equal(detail.actions[0].tarikh_mula,'2026-11-25','report detail action start');
    assert.equal(detail.actions[0].tarikh_selesai,'2026-11-26','report detail action end');
    assert.equal((await request('/reports',2)).data[0].tarikh_laporan,'2026-11-25','report list');

    const [action]=await request('/actions',1);
    assert.deepEqual([action.tarikh_laporan,action.tarikh_mula,action.tarikh_selesai],['2026-11-25','2026-11-25','2026-11-26'],'follow-up list');

    const week=(await pool.query("insert into tbl_jadual_mingguan(tarikh_mula,tarikh_tamat) values('2026-11-23','2026-11-29') returning id_jadual_mingguan")).rows[0].id_jadual_mingguan;
    const assignment=await request(`/jadual/mingguan/${week}/assignments`,2,'POST',
      {id_pengguna:3,id_pos:post,tarikh_tugas:'2026-11-25',syif:'Pagi',masa_mula:'07:00',masa_tamat:'15:00'});
    assert.equal(assignment.tarikh_tugas,'2026-11-25','created assignment');
    const confirmed=await request(`/jadual/mingguan/${week}/confirm`,1,'POST',{});
    assert.deepEqual([confirmed.tarikh_mula,confirmed.tarikh_tamat],['2026-11-23','2026-11-29'],'week status change');
  }finally{
    if(server)await new Promise(resolve=>server.close(resolve));
    await admin.query(`drop schema if exists ${schema} cascade`);
    await pool.end();await admin.end();
  }
});
