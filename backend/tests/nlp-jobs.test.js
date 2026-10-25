process.env.NLP_WORKER_ENABLED='false';
process.env.NLP_AI_REVIEW_ENABLED='false';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {configureDemo}=require('../scripts/phase5-demo-config');
configureDemo('penjaga_phase6_demo');
const {Pool}=require('pg');
const {dbOptions}=require('../config/dbOptions');

test('durable analysis jobs and report intelligence use an isolated synthetic schema',async t=>{
  const schema=`penjaga_nlp_test_${process.pid}_${Date.now()}`;
  const admin=new Pool(dbOptions());
  const pool=require('../config/db');
  pool.options.options=`-c search_path=${schema} -c timezone=Asia/Kuala_Lumpur`;
  let server;
  try{
    await admin.query(`create schema ${schema}`);
    for(const file of ['schema.sql','roles.sql','migrations/003_lokasi_3d.sql','migrations/004_nlp_review.sql'])await pool.query(await fs.readFile(path.join(__dirname,'../database',file),'utf8'));
    await pool.query(`
      insert into tbl_pengguna(id_pengguna,id_peranan,nama_penuh,emel,nama_pengguna,kata_laluan) values
        (1,1,'DEMO Admin','a@example.invalid','demo_admin','unused'),(2,2,'DEMO Chief','c@example.invalid','demo_chief','unused'),
        (3,3,'DEMO Guard','g@example.invalid','demo_guard','unused'),(4,3,'DEMO Other','o@example.invalid','demo_other','unused');
      insert into tbl_pos_kawalan(id_pos,nama_pos) values(1,'DEMO Post');
      update tbl_lokasi_3d set id_pos=1 where hotspot_id='HOTSPOT_MAIN_ENTRANCE';
      insert into tbl_kategori_insiden(nama_kategori,tahap_keutamaan,kata_kunci_rujukan) values
        ('Pencerobohan','High',array['pencerobohan','tanpa pas']),('Kebakaran','Critical',array['kebakaran','asap']),('Rondaan Biasa','Low',array['rondaan','selamat']);
      insert into tbl_laporan_harian(id_laporan,id_pengguna,id_pos,tajuk_laporan,syif,tarikh_laporan,masa_laporan,kandungan_laporan,tahap_risiko) values
        (1,3,1,'DEMO Input','Malam',current_date,'23:10','Pencerobohan dikesan pada 23:10 di Pintu Masuk Utama. Ketua dimaklumkan.','Unknown'),
        (2,4,1,'PRIVATE_OTHER_REPORT','Malam',current_date,'23:20','Pencerobohan dikesan pada 23:20 di Pintu Masuk Utama.','Unknown');
      select setval(pg_get_serial_sequence('tbl_laporan_harian','id_laporan'),2);
    `);
    const jobs=require('../services/nlpJobs');
    server=require('../server');if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));
    const base=`http://127.0.0.1:${server.address().port}`;
    const jwt=require('jsonwebtoken');const {jwtSecret}=require('../middleware/auth');
    const request=async(route,user=1,method='GET',body)=>{
      const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(user?{Authorization:`Bearer ${jwt.sign({id:user},jwtSecret,{expiresIn:'5m'})}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
      return {status:response.status,data:await response.json()};
    };
    const report=(await pool.query('select * from tbl_laporan_harian where id_laporan=1')).rows[0];
    const queue=async(options)=>{const c=await pool.connect();try{await c.query('begin');const job=await jobs.enqueue(c,report,1,options);await c.query('commit');return job;}catch(e){await c.query('rollback');throw e;}finally{c.release();}};
    const reviewer=async()=>({status:'needs_review',provider:'gemini',model:'mocked-provider',findings:[{code:'ambiguity',message:'Semak naratif.',quote:'Pencerobohan',start:0,end:12}],reason:'Synthetic provider test only'});
    let first;
    await t.test('migration is repeatable and queue deduplicates pending submissions',async()=>{
      await pool.query(await fs.readFile(path.join(__dirname,'../database/migrations/004_nlp_review.sql'),'utf8'));
      first=await queue();assert.equal((await queue()).id_job,first.id_job);assert.equal((await pool.query('select count(*)::int n from tbl_job_nlp')).rows[0].n,1);
      const view=await request('/api/reports/1/analysis',3);assert.equal(view.status,200);assert.equal(view.data.analysis,null);assert.equal(view.data.job.status,'pending');
      assert.equal((await request('/api/reports/1',3)).data.report.tahap_risiko,'Unknown');
    });
    await t.test('worker uses actual local inference and persists evidence without official decisions',async()=>{
      assert.equal(await jobs.runOne(pool,{reviewer}),true);
      const view=(await request('/api/reports/1/analysis',3)).data;
      assert.equal(view.job.status,'completed');assert.ok(view.analysis.metadata.model.trainedInferenceRan);
      assert.equal(view.analysis.metadata.review.status,'needs_review');assert.equal(view.analysis.kategori_dikesan,'Pencerobohan');
      for(const span of view.analysis.metadata.evidence)assert.equal(report.kandungan_laporan.slice(span.start,span.end),span.text);
      assert.equal((await pool.query('select status_laporan from tbl_laporan_harian where id_laporan=1')).rows[0].status_laporan,'Dihantar');
      assert.equal((await pool.query('select count(*)::int n from tbl_tindakan_susulan')).rows[0].n,0);
    });
    await t.test('completed analysis stays visible while an explicit reanalysis is queued',async()=>{
      const old=(await request('/api/reports/1/analysis',3)).data.analysis.id_nlp;
      const response=await request('/api/reports/1/reanalyse',2,'POST',{});assert.equal(response.status,202);
      const view=(await request('/api/reports/1/analysis',3)).data;assert.equal(view.analysis.id_nlp,old);assert.equal(view.job.status,'pending');
      assert.equal((await request('/api/reports/1/reanalyse',3,'POST',{})).status,403);
    });
    await t.test('parallel claims process one job and reanalysis never duplicates conservative alerts',async()=>{
      let calls=0;const bounded=async args=>{calls++;return reviewer(args);};
      await Promise.all([jobs.runOne(pool,{reviewer:bounded}),jobs.runOne(pool,{reviewer:bounded})]);
      assert.equal(calls,1);
      assert.equal((await pool.query('select count(*)::int n from tbl_hasil_nlp where id_laporan=1')).rows[0].n,2);
      assert.equal((await pool.query("select count(*)::int n from tbl_notifikasi where id_laporan=1 and jenis_notifikasi='Risiko Tinggi'")).rows[0].n,1);
    });
    await t.test('unavailable reviewer is stored honestly while local analysis succeeds',async()=>{
      await queue({force:true});await jobs.runOne(pool,{reviewer:async()=>jobs.unavailable('NOT_CONFIGURED')});
      const view=(await request('/api/reports/1/analysis',3)).data;assert.equal(view.job.status,'completed');assert.equal(view.analysis.metadata.review.status,'unavailable');
    });
    await t.test('source, search, related reports and helper preserve guard ownership/roles',async()=>{
      assert.equal((await request('/api/reports/1/analysis',4)).status,403);
      assert.equal((await request('/api/reports/1/similar',4)).status,403);
      assert.equal((await request('/api/reports/1/analysis',null)).status,401);
      const found=await request('/api/reports/search?q=pencerobohan',3);assert.equal(found.status,200);assert.ok(!JSON.stringify(found.data).includes('PRIVATE_OTHER_REPORT'));
      assert.ok(found.data.items.every(r=>r.id_laporan===1));assert.equal(found.data.method,'tfidf');
      assert.equal((await request('/api/reports/assist',1,'POST',{text:report.kandungan_laporan})).status,403);
      const assist=await request('/api/reports/assist',3,'POST',{text:report.kandungan_laporan});assert.equal(assist.status,200);assert.ok(assist.data.title);assert.equal(assist.data.review,undefined);
      assert.equal((await request('/api/reports/assist',3,'POST',{text:{bad:true}})).status,400);
      assert.equal((await request('/api/reports/1%20OR%201=1/analysis',1)).status,400);
    });
    await t.test('chief/admin feedback is audited, tied to the correct analysis and never retrains',async()=>{
      const analysis=(await request('/api/reports/1/analysis',1)).data.analysis;
      assert.equal((await request('/api/reports/1/analysis-feedback',3,'POST',{id_nlp:analysis.id_nlp,decision:'helpful'})).status,403);
      assert.equal((await request('/api/reports/1/analysis-feedback',2,'POST',{id_nlp:analysis.id_nlp,decision:'needs_correction',comment:'DEMO sahaja'})).status,201);
      assert.equal((await request('/api/reports/1/analysis-feedback',2,'POST',{id_nlp:analysis.id_nlp,decision:'helpful'})).status,201);
      assert.equal((await pool.query('select count(*)::int n from tbl_maklum_balas_nlp')).rows[0].n,1);
      assert.equal((await request('/api/reports/2/analysis-feedback',2,'POST',{id_nlp:analysis.id_nlp,decision:'helpful'})).status,404);
    });
    await t.test('briefing is an authorized bounded projection of recorded reports',async()=>{
      assert.equal((await request('/api/reports/briefing',3)).status,403);
      const result=await request('/api/reports/briefing',2);assert.equal(result.status,200);assert.equal(result.data.method,'extractive_records');assert.equal(result.data.items.length,2);
      assert.equal((await request('/api/reports/briefing?date=2026-02-30',2)).status,400);
    });
    await t.test('report saves with no active categories and analysis job handles review separately',async()=>{
      await pool.query("update tbl_kategori_insiden set status_kategori='Tidak Aktif'");
      const response=await request('/api/reports',3,'POST',{id_pos:1,tajuk_laporan:'DEMO Pending',kandungan_laporan:'Laporan tanpa konfigurasi kategori yang aktif.',syif:'Pagi',tarikh_laporan:'2026-10-25',masa_laporan:'10:20',checklist:[]});
      assert.equal(response.status,201);assert.equal(response.data.nlp,null);assert.equal(response.data.analysisJob.status,'pending');assert.equal(response.data.report.tahap_risiko,'Unknown');
    });
    await t.test('stale job input fails without appending misleading analysis',async()=>{
      await pool.query("update tbl_job_nlp set status='failed' where id_laporan<>1 and status='pending'");
      await queue({force:true});await pool.query("update tbl_laporan_harian set kandungan_laporan='Changed synthetic source' where id_laporan=1");
      const before=(await pool.query('select count(*)::int n from tbl_hasil_nlp')).rows[0].n;
      await jobs.runOne(pool,{reviewer});
      assert.equal((await pool.query('select count(*)::int n from tbl_hasil_nlp')).rows[0].n,before);
      assert.equal((await pool.query('select last_error from tbl_job_nlp where id_laporan=1 order by id_job desc limit 1')).rows[0].last_error,'STALE_INPUT');
    });
    await t.test('event dialogue persists grounded answers separately and survives the real worker path',async()=>{
      await pool.query("update tbl_kategori_insiden set status_kategori='Aktif'; insert into tbl_kategori_insiden(nama_kategori,tahap_keutamaan,kata_kunci_rujukan) values ('Kerosakan Kemudahan','Medium',array['rosak','tidak berfungsi'])");
      await pool.query("select setval(pg_get_serial_sequence('tbl_pos_kawalan','id_pos'),(select max(id_pos) from tbl_pos_kawalan))");
      for(const file of ['005_djm_security_posts.sql','006_security_buildings.sql'])await pool.query(await fs.readFile(path.join(__dirname,'../database/migrations',file),'utf8'));
      const lifts=(await pool.query("select id_lokasi,id_pos,hotspot_id from tbl_lokasi_3d where hotspot_id in ('POST_DJM_SS_LG_LIFT','POST_DJM_MB_LG_LIFT') order by hotspot_id")).rows;
      const ss=lifts.find(item=>item.hotspot_id==='POST_DJM_SS_LG_LIFT');
      const mb=lifts.find(item=>item.hotspot_id==='POST_DJM_MB_LG_LIFT');
      const text='  Tiada pencerobohan. CCTV di lif LG rosak sejak 10.30 malam.  ';
      const first=await request('/api/reports/assist',3,'POST',{text,id_pos:ss.id_pos});
      assert.equal(first.status,200);assert.equal(first.data.events.length,2);
      assert.equal(first.data.events.find(event=>event.category==='Pencerobohan').status,'negated');
      const question=first.data.dialogue.questions[0];assert.equal(question.field,'location');
      assert.deepEqual(question.options.filter(option=>/^\d+$/.test(option.value)).map(option=>Number(option.value)).sort((a,b)=>a-b),lifts.map(item=>item.id_lokasi).sort((a,b)=>a-b));
      const clarifications=[{questionId:question.id,value:String(mb.id_lokasi)}];
      const context={draftHash:first.data.dialogue.draftHash,clarifications};
      const answered=await request('/api/reports/assist',3,'POST',{text,id_pos:ss.id_pos,sourceHash:context.draftHash,clarifications});
      assert.equal(answered.status,200);assert.equal(answered.data.events.find(event=>event.category==='Kerosakan Kemudahan').location.confirmed.hotspot_id,mb.hotspot_id);
      assert.equal((await request('/api/reports/assist',3,'POST',{text:text+' Changed',id_pos:ss.id_pos,sourceHash:context.draftHash,clarifications})).status,400);
      assert.equal((await request('/api/reports/assist',3,'POST',{text,id_pos:ss.id_pos,sourceHash:context.draftHash,clarifications:[{questionId:question.id,value:'999999'}]})).status,400);
      const submitted=await request('/api/reports',3,'POST',{id_pos:ss.id_pos,tajuk_laporan:'DEMO Mixed events',kandungan_laporan:text,syif:'Malam',tarikh_laporan:'2026-10-26',masa_laporan:'22:30',checklist:[],nlp_context:JSON.stringify(context)});
      assert.equal(submitted.status,201);
      const reportId=submitted.data.id_laporan;
      const stored=(await pool.query('select * from tbl_laporan_harian where id_laporan=$1',[reportId])).rows[0];
      assert.equal(stored.kandungan_laporan,text);assert.deepEqual(stored.nlp_context,context);assert.equal(stored.id_pos,ss.id_pos);
      await jobs.runOne(pool,{reviewer:async()=>jobs.unavailable('SYNTHETIC_ONLY')});
      const saved=(await request(`/api/reports/${reportId}/analysis`,3)).data;
      assert.equal(saved.job.status,'completed');assert.equal(saved.analysis.metadata.schemaVersion,3);assert.equal(saved.analysis.metadata.events.length,2);
      assert.equal(saved.analysis.metadata.eventsTruncated,false);assert.equal(saved.analysis.metadata.eventCount,2);assert.equal(saved.analysis.metadata.eventLimit,64);
      assert.equal(saved.analysis.metadata.events.find(event=>event.category==='Kerosakan Kemudahan').location.confirmed.hotspot_id,mb.hotspot_id);
      assert.equal(saved.analysis.metadata.dialogue.answers[0].source,'clarification');
      for(const event of saved.analysis.metadata.events)assert.equal(text.slice(event.source.start,event.source.end),event.source.text);
      assert.equal((await request(`/api/reports/${reportId}/analysis`,4)).status,403);
      const count=(await pool.query('select count(*)::int n from tbl_laporan_harian')).rows[0].n;
      const invalid=await request('/api/reports',3,'POST',{id_pos:ss.id_pos,tajuk_laporan:'Invalid stale clarification',kandungan_laporan:text+' new',syif:'Malam',tarikh_laporan:'2026-10-26',masa_laporan:'22:30',checklist:[],nlp_context:JSON.stringify(context)});
      assert.equal(invalid.status,400);assert.equal((await pool.query('select count(*)::int n from tbl_laporan_harian')).rows[0].n,count);
    });
    await t.test('legacy leased jobs also reject selected-post races during provider review',async()=>{
      const source=(await pool.query("select * from tbl_laporan_harian where tajuk_laporan='DEMO Mixed events'")).rows[0];
      const copy=(await pool.query(`insert into tbl_laporan_harian(id_pengguna,id_pos,tajuk_laporan,syif,tarikh_laporan,masa_laporan,kandungan_laporan) values(3,$1,'DEMO Legacy race','Malam','2026-10-26','22:30',$2) returning *`,[source.id_pos,source.kandungan_laporan])).rows[0];
      const job=(await pool.query("insert into tbl_job_nlp(id_laporan,input_hash,pipeline_version,requested_by) values($1,$2,'penjaga-nlp-v2',3) returning *",[copy.id_laporan,jobs.hash(copy.kandungan_laporan)])).rows[0];
      const other=(await pool.query("select id_pos from tbl_lokasi_3d where hotspot_id='POST_DJM_MB_LG_LIFT'")).rows[0].id_pos;
      const before=(await pool.query('select count(*)::int n from tbl_hasil_nlp where id_laporan=$1',[copy.id_laporan])).rows[0].n;
      await jobs.runOne(pool,{reviewer:async()=>{await pool.query('update tbl_laporan_harian set id_pos=$1 where id_laporan=$2',[other,copy.id_laporan]);return jobs.unavailable('SYNTHETIC_RACE');}});
      assert.equal((await pool.query('select count(*)::int n from tbl_hasil_nlp where id_laporan=$1',[copy.id_laporan])).rows[0].n,before);
      assert.equal((await pool.query('select last_error from tbl_job_nlp where id_job=$1',[job.id_job])).rows[0].last_error,'STALE_INPUT');
    });
  }finally{
    if(server)await new Promise(resolve=>server.close(resolve));
    await pool.end();
    if(/^penjaga_nlp_test_\d+_\d+$/.test(schema))await admin.query(`drop schema if exists ${schema} cascade`);
    await admin.end();
  }
});
