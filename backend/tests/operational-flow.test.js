// Real authentication + HTTP + automatic worker, confined to a disposable PostgreSQL schema.
process.env.NLP_WORKER_ENABLED='true';
process.env.NLP_AI_REVIEW_ENABLED='false';
process.env.PORT='0';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {setTimeout:delay}=require('node:timers/promises');
const bcrypt=require('bcrypt');
const {configureDemo}=require('../scripts/phase5-demo-config');
configureDemo();
const {Pool}=require('pg');
const {dbOptions}=require('../config/dbOptions');
const {migrate}=require('../database/migrate');
const model=require('../ml/model/nlp-model.json');
const {categories}=require('../../tests/phase7/fixtures/independent-challenges.json');

test('a submitted report is automatically classified, reviewed and resolved through real role APIs',async()=>{
  const schema=`penjaga_operational_test_${process.pid}_${Date.now()}`;
  const admin=new Pool(dbOptions());
  const pool=require('../config/db');
  pool.options.options=`-c search_path=${schema} -c timezone=Asia/Kuala_Lumpur`;
  let server;
  try{
    await admin.query(`create schema ${schema}`);
    await migrate(pool,{initialize:true});
    const password='Synthetic-flow-password-2026!';
    const hash=await bcrypt.hash(password,10);
    for(const [id,role,username] of [[1,1,'flow_admin'],[2,2,'flow_chief'],[3,3,'flow_guard'],[4,3,'flow_other']])await pool.query('insert into tbl_pengguna(id_pengguna,id_peranan,nama_penuh,nama_pengguna,emel,kata_laluan) values($1,$2,$3,$3,$4,$5)',[id,role,username,username+'@example.invalid',hash]);
    for(const category of categories)await pool.query('insert into tbl_kategori_insiden(nama_kategori,tahap_keutamaan,kata_kunci_rujukan) values($1,$2,$3)',[category.name,category.priority,category.keywords]);
    await pool.query("insert into tbl_checklist(nama_checklist) values('Synthetic inspection')");
    const post=(await pool.query('select min(id_pos)::int as id from tbl_pos_kawalan')).rows[0].id;
    const checklist=(await pool.query('select id_checklist from tbl_checklist')).rows[0].id_checklist;
    server=require('../server');if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));
    const base=`http://127.0.0.1:${server.address().port}/api`;
    const request=async(path,token,method='GET',body)=>{
      const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
      const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}return {status:response.status,data};
    };
    const tokens={};
    for(const username of ['flow_admin','flow_chief','flow_guard','flow_other']){
      const login=await request('/auth/login',null,'POST',{username,password});assert.equal(login.status,200);tokens[username]=login.data.token;
    }
    const today=(await pool.query("select current_date::text as date")).rows[0].date;
    const original='Asap tebal dan api kecil dikesan di bilik utiliti. Pengawal menghubungi bomba dan mengosongkan kawasan.';
    const sent=await request('/reports',tokens.flow_guard,'POST',{id_pos:post,tajuk_laporan:'SYNTHETIC background classification flow',kandungan_laporan:original,syif:'Pagi',tarikh_laporan:today,masa_laporan:'09:00',checklist:[{id_checklist:checklist,jawapan:'Ya'}]});
    assert.equal(sent.status,201);const reportId=sent.data.id_laporan;
    assert.ok(reportId);assert.equal(sent.data.analysis,null);
    let classified;
    const deadline=Date.now()+12000;
    do{
      classified=await request(`/reports/${reportId}/analysis`,tokens.flow_guard);
      assert.equal(classified.status,200);
      if(classified.data.job?.status==='completed')break;
      assert.notEqual(classified.data.job?.status,'failed');await delay(100);
    }while(Date.now()<deadline);
    assert.equal(classified.data.job?.status,'completed','The actual background worker must complete without calling runOne manually');
    assert.equal(classified.data.analysis.kategori_dikesan,'Kebakaran');
    assert.equal(classified.data.analysis.tahap_risiko,'Critical');
    assert.equal(classified.data.analysis.metadata.model.version,model.version);
    assert.equal(classified.data.analysis.metadata.model.trainedInferenceRan,true);
    assert.equal((await request(`/reports/${reportId}`,tokens.flow_other)).status,403);
    let detail=await request(`/reports/${reportId}`,tokens.flow_chief);
    assert.equal(detail.data.report.kandungan_laporan,original);assert.equal(detail.data.report.status_laporan,'Dihantar');assert.equal(detail.data.actions.length,0);
    assert.equal((await pool.query("select count(*)::int n from tbl_notifikasi where id_laporan=$1 and id_pengguna=2 and jenis_notifikasi='Risiko Tinggi'",[reportId])).rows[0].n,1);
    assert.equal((await request(`/reports/${reportId}/review`,tokens.flow_admin,'PATCH',{status:'approved',comment:'Not authorized',requiresFollowUp:true})).status,403);
    assert.equal((await request(`/reports/${reportId}/review`,tokens.flow_chief,'PATCH',{status:'approved',comment:'Synthetic chief review',requiresFollowUp:true})).status,200);
    assert.equal((await pool.query('select count(*)::int n from tbl_tindakan_susulan where id_laporan=$1',[reportId])).rows[0].n,0,'Chief review requests follow-up; only admin creates the action');
    const candidates=await request('/reports?follow_up=pending',tokens.flow_admin);
    assert.ok(candidates.data.data.some(row=>row.id_laporan===reportId));
    assert.equal((await pool.query("select count(*)::int n from tbl_notifikasi where id_laporan=$1 and id_pengguna=1 and jenis_notifikasi='Tindakan Susulan'",[reportId])).rows[0].n,1);
    assert.equal((await request('/actions',tokens.flow_chief,'POST',{id_laporan:reportId,pegawai_bertanggungjawab:'Synthetic officer',tindakan_diambil:'Synthetic follow-up'})).status,403);
    const action=await request('/actions',tokens.flow_admin,'POST',{id_laporan:reportId,pegawai_bertanggungjawab:'Synthetic officer',tindakan_diambil:'Inspect and repair synthetic equipment',tahap_keutamaan:'Critical'});
    assert.equal(action.status,201);const actionId=action.data.id_tindakan;
    assert.equal((await request('/actions',tokens.flow_admin,'POST',{id_laporan:reportId,pegawai_bertanggungjawab:'Duplicate',tindakan_diambil:'Duplicate'})).status,409);
    assert.equal((await request(`/actions/${actionId}`,tokens.flow_admin,'PATCH',{status_tindakan:'Dalam Tindakan'})).status,200);
    assert.equal((await request(`/actions/${actionId}/progress`,tokens.flow_chief,'POST',{catatan_progress:'Synthetic inspection completed; repair verified.'})).status,201);
    assert.equal((await request(`/actions/${actionId}`,tokens.flow_admin,'PATCH',{status_tindakan:'Selesai'})).status,200);
    detail=await request(`/reports/${reportId}`,tokens.flow_guard);
    assert.equal(detail.data.report.status_laporan,'Diluluskan');assert.equal(detail.data.reviews.length,1);assert.equal(detail.data.actions[0].status_tindakan,'Selesai');
    const dashboard=await request(`/dashboard?from=${today}&to=${today}`,tokens.flow_admin);
    assert.equal(dashboard.status,200);assert.equal(dashboard.data.insights.current.total,1);assert.equal(dashboard.data.insights.current.reviewed,1);
    assert.equal((await request('/reports/export.csv',tokens.flow_guard)).status,200);
    assert.ok((await request('/notifications/unread-count',tokens.flow_admin)).data.unread>0);
    const unclassified=(await pool.query("insert into tbl_laporan_harian(id_pengguna,id_pos,tajuk_laporan,syif,tarikh_laporan,masa_laporan,kandungan_laporan) values(3,$1,'SYNTHETIC pending classification','Pagi',current_date,'10:00','Human review can proceed when classification is unavailable.') returning id_laporan",[post])).rows[0].id_laporan;
    assert.equal((await request(`/reports/${unclassified}/review`,tokens.flow_chief,'PATCH',{status:'approved',requiresFollowUp:true})).status,200,'Unknown AI risk must not block a human follow-up decision');
    assert.equal((await pool.query('select count(*)::int n from tbl_tindakan_susulan where id_laporan=$1',[unclassified])).rows[0].n,0);
  }finally{
    if(server)await new Promise(resolve=>server.close(resolve));
    await pool.end();
    if(/^penjaga_operational_test_\d+_\d+$/.test(schema))await admin.query(`drop schema if exists ${schema} cascade`);
    await admin.end();
  }
});
