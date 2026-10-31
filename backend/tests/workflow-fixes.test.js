process.env.NLP_WORKER_ENABLED='false';
process.env.NLP_AI_REVIEW_ENABLED='false';
process.env.PORT='0';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const bcrypt=require('bcrypt');
const {configureDemo}=require('../scripts/phase5-demo-config');
configureDemo();
const {Pool}=require('pg');
const {dbOptions}=require('../config/dbOptions');
const {eligibleSql,checkInSql}=require('../utils/attendance');
const {escapeCSV}=require('../utils/helpers');

test('workflow regressions use disposable schema and real authenticated APIs',async t=>{
  const schema=`penjaga_workflow_test_${process.pid}_${Date.now()}`;
  const admin=new Pool(dbOptions());
  const pool=require('../config/db');
  pool.options.options=`-c search_path=${schema} -c timezone=UTC`;
  let server;
  try{
    await admin.query(`create schema ${schema}`);
    for(const file of ['schema.sql','roles.sql','migrations/003_lokasi_3d.sql','migrations/004_nlp_review.sql','migrations/007_database_integrity.sql'])await pool.query(await fs.readFile(path.join(__dirname,'../database',file),'utf8'));
    const password='Original-password-123';
    const hash=await bcrypt.hash(password,10);
    await pool.query(`insert into tbl_pengguna(id_pengguna,id_peranan,nama_penuh,nama_pengguna,emel,kata_laluan) values
      (1,1,'Admin','admin','admin@example.invalid',$1),(2,2,'Chief','chief','chief@example.invalid',$1),
      (3,3,'Guard','guard','guard@example.invalid',$1),(4,3,'Other guard','other','other@example.invalid',$1)`,[hash]);
    await pool.query(`insert into tbl_pos_kawalan(id_pos,nama_pos) values(1,'Post A'),(2,'Post B');
      insert into tbl_laporan_harian(id_pengguna,id_pos,tajuk_laporan,syif,tarikh_laporan,masa_laporan,kandungan_laporan,status_laporan)
      select 3,1,'Recent '||i,'Pagi',date '2026-10-29','09:00','Routine report','Diluluskan' from generate_series(1,65)i;
      insert into tbl_laporan_harian(id_pengguna,id_pos,tajuk_laporan,syif,tarikh_laporan,masa_laporan,kandungan_laporan)
      values(3,2,'Old needle','Malam','2026-10-01','23:00','Smoke 100%_literal, "quoted"'),(4,2,'Private needle','Pagi','2026-10-01','10:00','Other guard private text');
      insert into tbl_hasil_nlp(id_laporan,teks_diproses,kategori_dikesan,skor_risiko,tahap_risiko,metadata)
      values(66,'Smoke','Kebakaran',90,'Critical','{"review":{"status":"needs_review"}}');
      insert into tbl_checklist(id_checklist,nama_checklist,status_aktif) values(1,'Doors',true),(2,'Lights',true),(3,'Retired',false);
      insert into tbl_jadual_mingguan(id_jadual_mingguan,tarikh_mula,tarikh_tamat) values(1,current_date-2,current_date+5);
      insert into tbl_jadual_bertugas(id_jadual,id_jadual_mingguan,id_pengguna,id_pos,tarikh_tugas,syif,masa_mula,masa_tamat)
      values(1,1,3,1,(now() at time zone 'Asia/Kuala_Lumpur')::date-1,'Malam','23:00','08:00'),
            (2,1,3,1,(now() at time zone 'Asia/Kuala_Lumpur')::date-1,'Pagi','07:00','16:00'),
            (3,1,3,1,(now() at time zone 'Asia/Kuala_Lumpur')::date+1,'Pagi','07:00','16:00');
      insert into tbl_kehadiran_tugas(id_jadual,id_pengguna,masa_check_in) values(1,3,now()-interval '1 hour');`);
    server=require('../server');if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));
    const base=`http://127.0.0.1:${server.address().port}/api`;
    const jwt=require('jsonwebtoken');const {jwtSecret}=require('../middleware/auth');
    const request=async(url,user=3,method='GET',body)=>{
      const response=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...(user?{Authorization:`Bearer ${jwt.sign({id:user},jwtSecret,{expiresIn:'5m'})}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
      const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}
      return {status:response.status,data,headers:response.headers};
    };
    await t.test('filters apply before pagination and preserve ownership and latest risk',async()=>{
      const found=await request('/reports?status=Dihantar&search=needle&post=2&shift=Malam&date=2026-10-01&risk=Critical&attention=true&limit=1');
      assert.equal(found.status,200);assert.equal(found.data.meta.total,1);assert.equal(found.data.data[0].id_laporan,66);
      assert.equal(found.data.data[0].tarikh_laporan,'2026-10-01');assert.equal(found.data.filters.posts.length,2);
      assert.equal((await request('/reports?search=needle',1)).data.meta.total,2);
      assert.equal((await request('/reports?search=100%25_literal')).data.meta.total,1);
      for(const query of ['risk=Fake','date=2026-02-30','post=1%20OR%201=1','status[x]=x'])assert.equal((await request(`/reports?${query}`)).status,400);
    });
    await t.test('CSV export uses full filtered selection, ownership and spreadsheet-safe quoting',async()=>{
      const csv=await request('/reports/export.csv?search=needle');
      assert.equal(csv.status,200);assert.match(csv.headers.get('content-type'),/text\/csv/);
      assert.match(csv.data,/Old needle/);assert.ok(!csv.data.includes('Private needle'));assert.match(csv.data,/""quoted""/);
      assert.equal((await request('/reports/export.csv?status=Diluluskan')).data.split('\r\n').length,66);
      const audit=await request('/audit?format=csv',1);assert.equal(audit.status,200);assert.match(audit.headers.get('content-type'),/text\/csv/);
      assert.equal((await request('/audit?format=csv',3)).status,403);
      assert.equal((await request('/reports/export.csv',null)).status,401);
      for(const cell of ['=SUM(A1)',' +cmd','@formula','-1+2'])assert.ok(escapeCSV(cell).startsWith("'"));
    });
    await t.test('report, dashboard and audit exports honor inclusive calendar ranges',async()=>{
      const filtered=await request('/reports?from=2026-10-01&to=2026-10-01',1);assert.equal(filtered.status,200);assert.equal(filtered.data.meta.total,2);
      const csv=await request('/reports/export.csv?from=2026-10-01&to=2026-10-01',3);assert.match(csv.data,/Old needle/);assert.ok(!csv.data.includes('Private needle'));assert.ok(!csv.data.includes('Recent '));
      const stats=await request('/dashboard?from=2026-10-01&to=2026-10-01',2);assert.equal(stats.status,200);assert.equal(stats.data.cards.total_laporan,2);assert.equal(stats.data.trend[0].date,'2026-10-01');assert.equal(stats.data.latest[0].tarikh_laporan,'2026-10-01');
      await pool.query("insert into tbl_audit_trail(id_pengguna,modul_sistem,jenis_aktiviti,penerangan_aktiviti,status_aktiviti,tarikh_masa_aktiviti) values(1,'Period test','Range start','start','Berjaya','2024-02-01 00:00:00'),(1,'Period test','Range end','end','Berjaya','2024-02-29 23:59:59'),(1,'Period test','Outside range','outside','Berjaya','2024-03-01 00:00:00')");
      const audit=await request('/audit?format=csv&from=2024-02-01&to=2024-02-29',1);assert.equal(audit.status,200);assert.match(audit.data,/Range start/);assert.match(audit.data,/Range end/);assert.ok(!audit.data.includes('Outside range'));
      for(const endpoint of ['/reports/export.csv','/audit?format=csv','/dashboard'])for(const range of ['from=2026-02-30&to=2026-03-01','from=2027-01-01&to=2026-01-01','from=2026-01-01','from=0000-01-01&to=2026-01-01'])assert.equal((await request(endpoint+(endpoint.includes('?')?'&':'?')+range,1)).status,400);
    });
    await t.test('API requires all and only active checklist answers exactly once',async()=>{
      const body={id_pos:1,tajuk_laporan:'Checklist regression',kandungan_laporan:'Routine patrol',syif:'Pagi',tarikh_laporan:'2026-10-29',masa_laporan:'09:00'};
      const answer=id_checklist=>({id_checklist,jawapan:'Ya'});
      for(const checklist of [[],[answer(1)],[answer(1),answer(1)],[answer(1),answer(3)],[answer(1),answer(2),answer(3)],[null]]){
        assert.equal((await request('/reports',3,'POST',{...body,checklist})).status,400);
      }
      assert.equal((await pool.query("select count(*)::int n from tbl_laporan_harian where tajuk_laporan='Checklist regression'")).rows[0].n,0);
      assert.equal((await request('/reports',3,'POST',{...body,checklist:[answer(1),answer(2)]})).status,201);
      assert.equal((await pool.query('select count(*)::int n from tbl_jawapan_checklist')).rows[0].n,2);
    });
    await t.test('overnight assignment remains visible and checkout enforces owner and prior check-in',async()=>{
      const schedule=await request('/jadual/my-schedule');assert.equal(schedule.status,200);
      const night=schedule.data.find(r=>r.id_jadual===1);assert.equal(night.can_check_out,true);
      assert.ok(!schedule.data.some(r=>r.id_jadual===2));
      assert.equal((await request('/jadual/assignments/1/check-out',4,'POST')).status,404);
      assert.equal((await request('/jadual/assignments/3/check-in',3,'POST')).status,404);
      assert.equal((await request('/jadual/assignments/1/check-out',3,'POST')).status,200);
      assert.equal((await pool.query("select abs(extract(epoch from (masa_check_out-(now() at time zone 'Asia/Kuala_Lumpur'))))<10 as local_time from tbl_kehadiran_tugas where id_jadual=1")).rows[0].local_time,true);
      assert.equal((await request('/jadual/assignments/1/check-out',3,'POST')).status,409);
      // Explicit clock examples prove the same policy with a UTC database session.
      for(const [clock,canIn,canOut] of [['2026-10-28T23:30:00+08:00',true,true],['2026-10-29T00:30:00+08:00',true,true],['2026-10-29T08:00:00+08:00',true,true],['2026-10-29T09:00:00+08:00',false,true],['2026-10-30T00:01:00+08:00',false,false]]){
        const sql=`select ${checkInSql()} as ci,${eligibleSql()} as co from (select date '2026-10-28' tarikh_tugas,time '23:00' masa_mula,time '08:00' masa_tamat) duty`;
        const r=(await pool.query(sql.replaceAll('now()',`timestamptz '${clock}'`))).rows[0];assert.equal(r.ci,canIn);assert.equal(r.co,canOut);
      }
    });
    await t.test('follow-up candidates include older low-risk requests and exclude completed handoffs',async()=>{
      const row=(await pool.query("insert into tbl_laporan_harian(id_pengguna,id_pos,tajuk_laporan,syif,tarikh_laporan,masa_laporan,kandungan_laporan,status_laporan,perlu_tindakan_susulan) values(3,1,'Old low-risk request','Pagi','2020-01-01','09:00','Repair requested','Diluluskan',true) returning id_laporan")).rows[0];
      await pool.query("insert into tbl_hasil_nlp(id_laporan,teks_diproses,kategori_dikesan,skor_risiko,tahap_risiko) values($1,'Repair','Kerosakan Aset',10,'Low')",[row.id_laporan]);
      const pending=await request('/reports?follow_up=pending&limit=1',1);
      assert.equal(pending.status,200);assert.equal(pending.data.meta.total,1);assert.equal(pending.data.data[0].id_laporan,row.id_laporan);
      assert.equal(pending.data.data[0].tahap_risiko,'Low');
      assert.equal((await request('/reports?follow_up=invalid',1)).status,400);
      assert.equal((await request('/reports?follow_up=pending',4)).data.meta.total,0);
      assert.equal((await request('/actions',1,'POST',{id_laporan:row.id_laporan,pegawai_bertanggungjawab:'Admin',tindakan_diambil:'Repair the lock'})).status,201);
      assert.equal((await request('/reports?follow_up=pending',1)).data.meta.total,0);
    });
    await t.test('daily coverage respects the selected date and excess guards cannot hide another post shortage',async()=>{
      await pool.query("insert into tbl_keperluan_pos(id_pos,syif,bilangan_diperlukan,status_aktif) values(1,'Pagi',1,true),(2,'Pagi',1,true)");
      await pool.query("insert into tbl_jadual_bertugas(id_jadual,id_jadual_mingguan,id_pengguna,id_pos,tarikh_tugas,syif,masa_mula,masa_tamat) values(4,1,4,1,(now() at time zone 'Asia/Kuala_Lumpur')::date+1,'Pagi','07:00','16:00')");
      const dates=(await pool.query("select ((now() at time zone 'Asia/Kuala_Lumpur')::date+1)::text as tomorrow, ((now() at time zone 'Asia/Kuala_Lumpur')::date)::text as today")).rows[0];
      const result=await request('/jadual/mingguan/1/coverage-summary?date='+dates.tomorrow,1);
      assert.equal(result.status,200);assert.equal(result.data.totalRequired,2);assert.equal(result.data.totalAssigned,2);assert.equal(result.data.shortage,1);
      const post=result.data.coverageByPost.find(row=>row.id_pos===1);assert.equal(post.assignments.length,2);assert.equal(post.assignments[0].tarikh_tugas,dates.tomorrow);
      const otherDay=await request('/jadual/mingguan/1/coverage-summary?date='+dates.today,1);
      assert.equal(otherDay.data.totalAssigned,0);assert.equal(otherDay.data.shortage,2);
      assert.equal((await request('/jadual/mingguan/1/coverage-summary?date=2026-02-30',1)).status,400);
      assert.equal((await request('/jadual/mingguan/1/coverage-summary?date=2020-01-01',1)).status,400);
      assert.equal((await request('/jadual/mingguan/1/coverage-summary',1)).status,200);
      const weeks=await request('/jadual/mingguan',1);assert.equal(weeks.status,200);assert.match(weeks.data[0].tarikh_mula,/^\d{4}-\d{2}-\d{2}$/);
    });
    await t.test('notification counts, paging and read controls are scoped to their owner',async()=>{
      await pool.query("delete from tbl_notifikasi; insert into tbl_notifikasi(id_pengguna,tajuk_notifikasi,mesej_notifikasi,jenis_notifikasi,tahap_keutamaan) select 3,'Notice '||i,'Message','Test','Low' from generate_series(1,55)i; insert into tbl_notifikasi(id_pengguna,tajuk_notifikasi,mesej_notifikasi,jenis_notifikasi,tahap_keutamaan) values(4,'Other owner','Private','Test','Low')");
      assert.equal((await request('/notifications/unread-count',3)).data.unread,55);
      assert.equal((await request('/notifications?page=2',3)).data.length,5);
      assert.equal((await request('/notifications?page=0',3)).status,400);
      const other=(await request('/notifications',4)).data[0];
      assert.equal((await request('/notifications/'+other.id_notifikasi+'/read',3,'PATCH')).status,404);
      assert.equal((await request('/notifications/read-all',3,'PATCH')).data.updated,55);
      assert.equal((await request('/notifications/unread-count',3)).data.unread,0);
      assert.equal((await request('/notifications/unread-count',4)).data.unread,1);
      assert.equal((await request('/notifications?unread=true',3)).data.length,0);
      assert.equal((await request('/notifications/unread-count',null)).status,401);
      const action=(await pool.query('select id_tindakan from tbl_tindakan_susulan limit 1')).rows[0];
      assert.equal((await request('/actions/'+action.id_tindakan+'/request-update',1,'POST',{catatan_progress:'Please check the lock'})).status,201);
      assert.equal((await request('/notifications/unread-count',2)).data.unread,1);
      assert.equal((await request('/actions/'+action.id_tindakan+'/progress',2,'POST',{catatan_progress:'The lock is repaired'})).status,201);
      assert.equal((await request('/notifications/unread-count',1)).data.unread,1);
    });
    await t.test('analytics compares equal windows, fills zero days and keeps unknown risk out of the risk denominator',async()=>{
      const rows=(await pool.query("insert into tbl_laporan_harian(id_pengguna,id_pos,tajuk_laporan,syif,tarikh_laporan,masa_laporan,kandungan_laporan,status_laporan) values(3,2,'Analysis high','Pagi','2025-01-01','09:00','Synthetic','Dihantar'),(3,1,'Analysis unknown','Pagi','2025-01-01','10:00','Synthetic','Dihantar'),(3,1,'Analysis low','Pagi','2025-01-03','11:00','Synthetic','Diluluskan'),(3,1,'Analysis previous','Pagi','2024-12-30','09:00','Synthetic','Dihantar') returning id_laporan")).rows;
      for(const [index,risk] of [[0,'High'],[2,'Low'],[3,'Low']])await pool.query("insert into tbl_hasil_nlp(id_laporan,teks_diproses,kategori_dikesan,skor_risiko,tahap_risiko) values($1,'Synthetic','Kerosakan Aset',10,$2)",[rows[index].id_laporan,risk]);
      const response=await request('/dashboard?from=2025-01-01&to=2025-01-03',2);assert.equal(response.status,200);
      const a=response.data.insights;assert.equal(a.current.total,3);assert.equal(a.current.classified,2);assert.equal(a.current.high,1);assert.equal(a.current.reviewed,1);assert.equal(a.previous.total,1);assert.equal(a.comparison.volumeChange,200);assert.equal(a.comparison.riskShareChange,50);assert.equal(a.comparison.from,'2024-12-29');assert.equal(a.comparison.to,'2024-12-31');assert.equal(a.series.length,3);assert.equal(a.series[1].reports,0);assert.equal(a.series[1].previous,1);assert.equal(a.posts[0].id_pos,2);
      const zero=(await request('/dashboard?from=2018-01-02&to=2018-01-03',1)).data.insights;assert.equal(zero.current.total,0);assert.equal(zero.comparison.volumeChange,null);assert.equal(zero.comparison.riskShareChange,null);assert.equal(zero.series.length,2);
      assert.equal((await request('/dashboard?from=2099-01-01&to=2099-01-03',1)).data.insights.futurePeriod,true);
      const all=(await request('/dashboard',1)).data.insights;assert.equal(all.comparison,null);assert.ok(all.series.length<=366);
      assert.equal((await request('/dashboard?location=bad',1)).status,400);
      const linked=await request('/reports?post=2&from=2025-01-01&to=2025-01-03&risk=HighCritical',2);assert.equal(linked.status,200);assert.equal(linked.data.meta.total,1);assert.equal(linked.data.data[0].id_laporan,rows[0].id_laporan);
    });
    await t.test('password change verifies old password and stores a new bcrypt hash',async()=>{
      const url='/auth/change-password';const next='Replacement-password-456';
      assert.equal((await request(url,null,'POST',{currentPassword:password,newPassword:next})).status,401);
      assert.equal((await request(url,3,'POST',{currentPassword:'wrong',newPassword:next})).status,400);
      assert.equal((await request(url,3,'POST',{currentPassword:password,newPassword:'short'})).status,400);
      assert.equal((await request(url,3,'POST',{currentPassword:password,newPassword:'界'.repeat(25)})).status,400);
      assert.equal((await request(url,3,'POST',{currentPassword:password,newPassword:password})).status,400);
      assert.equal((await request(url,3,'POST',{currentPassword:password,newPassword:next})).status,200);
      const saved=(await pool.query('select kata_laluan from tbl_pengguna where id_pengguna=3')).rows[0].kata_laluan;
      assert.notEqual(saved,next);assert.equal(await bcrypt.compare(next,saved),true);assert.equal(await bcrypt.compare(password,saved),false);
      assert.equal((await pool.query("select count(*)::int n from tbl_audit_trail where jenis_aktiviti='CHANGE_PASSWORD'")).rows[0].n,1);
      assert.equal((await request(url,3,'POST',{currentPassword:next,newPassword:password})).status,429);
      assert.equal((await request('/auth/login',null,'POST',{username:'guard',password:next})).status,200);
    });
  }finally{
    if(server)await new Promise(resolve=>server.close(resolve));
    await pool.end();
    if(/^penjaga_workflow_test_\d+_\d+$/.test(schema))await admin.query(`drop schema if exists ${schema} cascade`);
    await admin.end();
  }
});
