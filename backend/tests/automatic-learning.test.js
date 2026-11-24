process.env.NLP_WORKER_ENABLED='false';
process.env.NLP_AUTO_TRAIN_ENABLED='false';
process.env.NLP_AI_REVIEW_ENABLED='false';
process.env.PORT='0';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {configureDemo}=require('../scripts/phase5-demo-config');
configureDemo();
const {Pool}=require('pg');
const {dbOptions}=require('../config/dbOptions');
const {migrate}=require('../database/migrate');
const learning=require('../services/automaticLearning');
const {passes,buildCandidate}=require('../services/learningWorker');
const base=require('../ml/model/nlp-model.json');
const {categories}=require('../../tests/phase7/fixtures/independent-challenges.json');
const corpus=require('../ml/data/classification-corpus.json');

test('quality gates reject aggregate or class-level regression',()=>{
  const metric={macroF1:.8,categoryAccuracy:.8,perCategory:[{category:'Kebakaran',recall:.7}]};
  assert.equal(passes(metric,metric),true);
  assert.equal(passes({...metric,macroF1:.79},metric),false);
  assert.equal(passes({...metric,perCategory:[{category:'Kebakaran',recall:.6}]},metric),false);
});

test('automatic learning collects explicit chief labels and safely versions private database models',async t=>{
  const schema=`penjaga_learning_test_${process.pid}_${Date.now()}`;
  const admin=new Pool(dbOptions());const pool=require('../config/db');
  pool.options.options=`-c search_path=${schema} -c timezone=Asia/Kuala_Lumpur`;
  const artifactFile=path.join(__dirname,'../ml/model/nlp-model.json');const originalFile=fs.readFileSync(artifactFile,'utf8');
  let server;
  try{
    await admin.query(`create schema ${schema}`);await migrate(pool,{initialize:true});
    for(const [id,role]of [[1,1],[2,2],[3,3]])await pool.query("insert into tbl_pengguna(id_pengguna,id_peranan,nama_penuh,nama_pengguna,emel,kata_laluan) values($1,$2,$3,$3,$4,'unused')",[id,role,'learning_'+id,'learning_'+id+'@example.invalid']);
    for(const c of categories)await pool.query('insert into tbl_kategori_insiden(nama_kategori,tahap_keutamaan,kata_kunci_rujukan) values($1,$2,$3)',[c.name,c.priority,c.keywords]);
    const post=(await pool.query('select min(id_pos) as id from tbl_pos_kawalan')).rows[0].id;
    const create=async(text,title='Field observation')=>(await pool.query("insert into tbl_laporan_harian(id_pengguna,id_pos,tajuk_laporan,kandungan_laporan,syif,tarikh_laporan,masa_laporan) values(3,$1,$2,$3,'Pagi',current_date,'09:00') returning *",[post,title,text])).rows[0];
    server=require('../server');if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));
    const jwt=require('jsonwebtoken');const {jwtSecret}=require('../middleware/auth');
    const request=async(url,user=2,method='GET',body)=>{
      const response=await fetch(`http://127.0.0.1:${server.address().port}/api${url}`,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+jwt.sign({id:user},jwtSecret,{expiresIn:'5m'})},body:body?JSON.stringify(body):undefined});
      return {status:response.status,data:await response.json()};
    };
    const approve=(report,category,user=2)=>request(`/reports/${report.id_laporan}/review`,user,'PATCH',{status:'approved',requiresFollowUp:false,...(category?{confirmedCategory:category}:{})});
    await t.test('predictions, ordinary approval and demo records never silently become training labels',async()=>{
      const ordinary=await create('A field observation awaiting a clear category.');assert.equal((await approve(ordinary)).status,200);
      assert.equal((await pool.query('select count(*)::int n from tbl_model_labels')).rows[0].n,0);
      const demo=await create('Smoke observed near equipment.','[DEMO] Test');const result=await approve(demo,'Kebakaran');assert.equal(result.status,200);assert.equal(result.data.learning.eligible,false);
      assert.equal((await request(`/reports/${demo.id_laporan}`)).data.confirmedCategory.training_allowed, false);
      const unusable=await create('catatan syif laporan');const brief=await approve(unusable,'Kebakaran');assert.equal(brief.status,200);assert.equal(brief.data.learning.reason,'insufficient_text');
      const invalid=await create('A second report for role checks.');assert.equal((await approve(invalid,'Kebakaran',1)).status,403);assert.equal((await approve(invalid,'Kebakaran',3)).status,403);
      assert.equal((await approve(invalid,'Not a category')).status,400);
      assert.equal((await request(`/reports/${invalid.id_laporan}`,2)).data.report.status_laporan,'Dihantar');
      assert.equal((await learning.runTraining(pool)).status,'waiting');
    });
    await t.test('chief can validate independently and validation alone never becomes training data', async () => {
      const report = await create('Peralatan di pondok pemeriksaan tidak berfungsi dan penyelenggara dihubungi.');
      const url = `/reports/${report.id_laporan}/classification`;
      const body = { category: 'Kerosakan Kemudahan' };
      assert.equal((await request(url, 1, 'PATCH', body)).status, 403);
      assert.equal((await request(url, 3, 'PATCH', body)).status, 403);
      const result = await request(url, 2, 'PATCH', body);
      assert.equal(result.status, 200);
      assert.equal(result.data.confirmedCategory.category, body.category);
      assert.equal(result.data.confirmedCategory.reviewer, 'learning_2');
      assert.equal(result.data.confirmedCategory.training_allowed, false);
      const detail = await request(`/reports/${report.id_laporan}`);
      assert.equal(detail.data.report.status_laporan, 'Dihantar');
      assert.equal(detail.data.reviews.length, 0);
      assert.equal((await approve(report)).status, 200);
      assert.equal((await learning.eligibleLabels(pool)).length, 0);
      const updated = await request(url, 2, 'PATCH', { category: 'Kebakaran' });
      assert.equal(updated.status, 200);
      assert.equal(updated.data.confirmedCategory.category, 'Kebakaran');

      const optedIn = await request(url, 2, 'PATCH', { ...body, allowTraining: true });
      assert.equal(optedIn.data.confirmedCategory.training_allowed, true);
      assert.equal((await learning.eligibleLabels(pool)).length, 1);
      await request(url, 2, 'PATCH', body);
      assert.equal((await learning.eligibleLabels(pool)).length, 0);
    });
    await t.test('confirmed labels are private, immutable-source and family-separated',async()=>{
      const library=require('../ml/data/classification-scenarios.json');const extra=require('../ml/data/classification-expansion.json');
      for(const category of ['Kebakaran','Kerosakan Kemudahan'])for(const text of [...library[category],...extra[category]]){
        const report=await create('Catatan sumber lapangan tambahan: '+text);const result=await approve(report,category);assert.equal(result.status,200);assert.equal(result.data.learning.eligible,true);
        const detail=await request(`/reports/${report.id_laporan}`,2);assert.equal(detail.data.confirmedCategory.category,category);
      }
      const copied=await create(corpus.samples[0].text);await approve(copied,corpus.samples[0].category);
      const stale=await create('A distinct original observation to be edited later.');await approve(stale,'Kebakaran');await pool.query('update tbl_laporan_harian set kandungan_laporan=$1 where id_laporan=$2',['Changed narrative after confirmation',stale.id_laporan]);
      for(const [number,category]of [[17,'Kebakaran'],[18,'Kerosakan Kemudahan']]){const duplicate=await create(`Repeated field record ${number} with contradictory human classification.`);await approve(duplicate,category);}
      const eligible=await learning.eligibleLabels(pool);
      assert.equal(eligible.length,62);assert.ok(eligible.filter(row=>row.partition==='validation').length>=4);
      for(const row of eligible)assert.equal(row.partition,learning.partition(row.text));
      assert.equal(new Set(eligible.map(row=>row.group)).size,eligible.length);
    });
    await t.test('actual background computation evaluates a candidate without changing the source model file',async()=>{
      const result=await learning.runTraining(pool);assert.ok(['promoted','rejected'].includes(result.status));
      const run=(await pool.query('select * from tbl_model_training_runs order by id_run desc limit 1')).rows[0];
      assert.equal(run.label_count,62);assert.ok(run.artifact.totalDocuments>base.totalDocuments);
      assert.ok(run.metrics.synthetic);assert.ok(run.metrics.confirmed);assert.equal(run.active,result.status==='promoted');
      assert.equal(fs.readFileSync(artifactFile,'utf8'),originalFile);
      assert.equal((await learning.runTraining(pool)).status,'waiting');
    });
    await t.test('failed attempts retry and rejected candidates preserve the incumbent model',async()=>{
      const run=(await pool.query('select id_run from tbl_model_training_runs order by id_run desc limit 1')).rows[0].id_run;
      await pool.query("update tbl_model_training_runs set active=false,status='failed',completed_at=now()-interval '2 minutes' where id_run=$1",[run]);
      await pool.query("insert into tbl_model_training_runs(source_digest,label_count,label_keys,status,model_version,artifact,active) values($1,0,'[]','promoted',$2,$3,true)",[learning.digest('fixture-incumbent'),base.version,base]);
      const rejected=await learning.runTraining(pool,{build:async data=>({...buildCandidate(data),accepted:false,reason:'TEST_REJECT'})});
      assert.equal(rejected.status,'rejected');assert.equal((await learning.activeModel(pool,base)).version,base.version);
      await pool.query("update tbl_model_training_runs set status='failed',completed_at=now()-interval '2 minutes' where id_run=$1",[run]);
      const promoted=await learning.runTraining(pool,{build:async data=>{
        const result=buildCandidate(data);
        const arrival=await create('A fresh field record received during candidate evaluation.');await approve(arrival,'Kebakaran');
        return {...result,accepted:true,reason:'TEST_PROMOTE'};
      }});
      assert.equal(promoted.status,'promoted');assert.equal((await learning.activeModel(pool,base)).version,promoted.version);
      assert.equal((await pool.query('select count(*)::int n from tbl_model_training_runs where active')).rows[0].n,1);
      assert.equal((await learning.runTraining(pool)).status,'waiting');
      await pool.query("update tbl_model_training_runs set artifact=jsonb_set(artifact,'{formatVersion}','999') where active");
      assert.equal((await learning.activeModel(pool,base)).version,base.version,'An incompatible stored model falls back to the file baseline');
    });
  }finally{
    if(server)await new Promise(resolve=>server.close(resolve));await pool.end();
    await admin.query(`drop schema if exists ${schema} cascade`);await admin.end();
  }
});
