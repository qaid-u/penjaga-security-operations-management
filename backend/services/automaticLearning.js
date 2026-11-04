const crypto=require('node:crypto');
const path=require('node:path');
const {Worker}=require('node:worker_threads');
const {cleanText,tokenize,validateModel}=require('../ml/textModel');
const digest=text=>crypto.createHash('sha256').update(text).digest('hex');
const family=text=>digest(cleanText(text).replace(/\d+/g,'#'));
const partition=text=>parseInt(family(text).slice(0,8),16)%5===0?'validation':'train';
const synthetic=report=>/\b(DEMO|SYNTHETIC|EKSPO|UJIAN)\b/i.test(report.tajuk_laporan||'');
const workers=new WeakMap();
function usable(text){const excluded=new Set(require('../ml/nlpService').loadModel()?.excludedWords||[]);return tokenize(text).some(token=>!token.split('_').some(word=>excluded.has(word)));}
async function ready(db){return Boolean((await db.query("select to_regclass('tbl_model_labels') is not null and to_regclass('tbl_model_training_runs') is not null as ready")).rows[0].ready);}
async function confirmedCategory(db,id){
  if(!await ready(db))return null;
  return (await db.query('select category,confirmed_at from tbl_model_labels where id_laporan=$1',[id])).rows[0]||null;
}
async function captureLabel(db,report,category,reviewer){
  if(!await ready(db))throw Object.assign(new Error('Kemas kini pangkalan data diperlukan untuk menyimpan kategori disahkan.'),{status:503});
  const base=require('../ml/nlpService').loadModel();
  const active=await db.query("select 1 from tbl_kategori_insiden where nama_kategori=$1 and status_kategori='Aktif'",[category]);
  if(!active.rowCount||!base?.categories||!Object.hasOwn(base.categories,category))throw Object.assign(new Error('Kategori disahkan tidak sah.'),{status:400});
  const demo=await db.query("select 1 from tbl_hasil_nlp where id_laporan=$1 and metadata->>'synthetic'='true' limit 1",[report.id_laporan]);
  if(synthetic(report)||demo.rowCount)return {eligible:false,reason:'demo'};
  await db.query(`insert into tbl_model_labels(id_laporan,reviewer_id,category,source_hash,family_hash,partition)
    values($1,$2,$3,$4,$5,$6) on conflict(id_laporan) do update set reviewer_id=excluded.reviewer_id,category=excluded.category,source_hash=excluded.source_hash,family_hash=excluded.family_hash,partition=excluded.partition,confirmed_at=now()`,
  [report.id_laporan,reviewer,category,digest(report.kandungan_laporan),family(report.kandungan_laporan),partition(report.kandungan_laporan)]);
  return usable(report.kandungan_laporan)?{eligible:true}:{eligible:false,reason:'insufficient_text'};
}
async function activeModel(db,fallback){
  if(!await ready(db))return fallback;
  const row=(await db.query('select artifact from tbl_model_training_runs where active limit 1')).rows[0];
  if(!row)return fallback;
  try{validateModel(row.artifact);return row.artifact;}catch{validateModel(fallback);return fallback;}
}
async function eligibleLabels(db){
  const rows=(await db.query(`select l.*,r.kandungan_laporan,r.tajuk_laporan from tbl_model_labels l join tbl_laporan_harian r using(id_laporan)
    join tbl_pengguna u on u.id_pengguna=l.reviewer_id join tbl_peranan p using(id_peranan)
    where r.status_laporan='Diluluskan' and p.nama_peranan='Ketua Pengawal'
      and exists(select 1 from tbl_pengesahan_laporan v where v.id_laporan=l.id_laporan and v.id_pengguna_pengesah=l.reviewer_id and v.status_pengesahan='Diluluskan')
      and not exists(select 1 from tbl_hasil_nlp n where n.id_laporan=l.id_laporan and n.metadata->>'synthetic'='true')
    order by l.confirmed_at desc,l.id_laporan desc limit 2000`)).rows;
  const corpus=require('../ml/data/classification-corpus.json');
  const excluded=new Set(corpus.samples.map(row=>family(row.text)));
  const classes=new Set(corpus.samples.map(row=>row.category));
  const grouped=new Map();
  for(const row of rows){
    if(synthetic(row)||!usable(row.kandungan_laporan)||digest(row.kandungan_laporan)!==row.source_hash||family(row.kandungan_laporan)!==row.family_hash||partition(row.kandungan_laporan)!==row.partition||!classes.has(row.category)||excluded.has(row.family_hash))continue;
    const group=grouped.get(row.family_hash)||[];group.push(row);grouped.set(row.family_hash,group);
  }
  return [...grouped.values()].filter(group=>new Set(group.map(row=>row.category)).size===1).map(group=>({text:group[0].kandungan_laporan,category:group[0].category,group:group[0].family_hash,partition:group[0].partition})).sort((a,b)=>a.group.localeCompare(b.group));
}
function buildInWorker(data){
  return new Promise((resolve,reject)=>{
    const worker=new Worker(path.join(__dirname,'learningWorker.js'),{workerData:data});
    const timer=setTimeout(()=>{worker.terminate();reject(new Error('TRAINING_TIMEOUT'));},60000);
    worker.once('message',message=>{clearTimeout(timer);message.error?reject(new Error(message.error)):resolve(message);});
    worker.once('error',error=>{clearTimeout(timer);reject(error);});
    worker.once('exit',code=>{clearTimeout(timer);if(code!==0)reject(new Error('TRAINING_WORKER_EXIT'));});
  });
}
async function runTraining(pool,{minLabels=Number(process.env.NLP_RETRAIN_MIN_LABELS)||20,build=buildInWorker}={}){
  const db=await pool.connect();let locked=false,run;
  try{
    if(!await ready(db))return {status:'not_ready'};
    locked=(await db.query('select pg_try_advisory_lock(7420,1) as locked')).rows[0].locked;
    if(!locked)return {status:'busy'};
    const labels=await eligibleLabels(db);
    const previous=(await db.query("select label_keys from tbl_model_training_runs where status in ('promoted','rejected') order by completed_at desc nulls last,id_run desc limit 1")).rows[0];
    const seen=new Set(previous?.label_keys||[]);
    const keys=labels.map(row=>row.group+':'+row.category);
    if(keys.filter(key=>!seen.has(key)).length<Math.max(20,minLabels))return {status:'waiting',labels:labels.length};
    const train=labels.filter(row=>row.partition==='train'),validation=labels.filter(row=>row.partition==='validation');
    if(new Set(train.map(row=>row.category)).size<2||validation.length<4||new Set(validation.map(row=>row.category)).size<2)return {status:'waiting_for_diverse_validation',labels:labels.length};
    const source=digest(JSON.stringify(labels.map(row=>[row.group,row.category,row.partition])));
    await db.query("update tbl_model_training_runs set status='failed',reason='INTERRUPTED',completed_at=now() where status='training' and created_at<now()-interval '5 minutes'");
    const existing=(await db.query("select *,completed_at<now()-interval '1 minute' as retry_ready from tbl_model_training_runs where source_digest=$1",[source])).rows[0];
    if(existing&&!(existing.status==='failed'&&existing.attempts<3&&existing.retry_ready))return {status:'already_evaluated'};
    const base=require('../ml/nlpService').loadModel();validateModel(base);
    const incumbent=await activeModel(db,base);
    run=existing?(await db.query("update tbl_model_training_runs set status='training',attempts=attempts+1,created_at=now(),completed_at=null,reason=null where id_run=$1 returning id_run",[existing.id_run])).rows[0].id_run:(await db.query("insert into tbl_model_training_runs(source_digest,label_count,label_keys,status) values($1,$2,$3,'training') returning id_run",[source,labels.length,JSON.stringify(keys)])).rows[0].id_run;
    const result=await build({base,incumbent,train,validation,source});validateModel(result.candidate);
    const current=await eligibleLabels(db);
    // New arrivals belong to the next batch; only changes to this snapshot invalidate it.
    const currentLabels=new Map(current.map(row=>[row.group,row.category+':'+row.partition]));
    const sameSource=labels.every(row=>currentLabels.get(row.group)===row.category+':'+row.partition);
    const sameModel=(await activeModel(db,require('../ml/nlpService').loadModel())).version===incumbent.version;
    const accepted=result.accepted===true&&sameSource&&sameModel;
    await db.query('begin');
    if(accepted)await db.query('update tbl_model_training_runs set active=false where active');
    await db.query("update tbl_model_training_runs set status=$1,active=$2,model_version=$3,artifact=$4,metrics=$5,reason=$6,completed_at=now() where id_run=$7",[accepted?'promoted':'rejected',accepted,result.candidate.version,result.candidate,result.metrics,!sameSource||!sameModel?'SOURCE_CHANGED':result.reason,run]);
    await db.query("insert into tbl_audit_trail(modul_sistem,jenis_aktiviti,penerangan_aktiviti,rekod_terlibat,status_aktiviti) values('Classification','AUTO_TRAIN_MODEL',$1,$2,'Berjaya')",[accepted?'Model disemak dan diaktifkan secara automatik.':'Calon model dikekalkan tanpa mengubah model aktif.','Training #'+run]);
    await db.query('commit');return {status:accepted?'promoted':'rejected',labels:labels.length,version:result.candidate.version};
  }catch(error){
    await db.query('rollback').catch(()=>{});
    if(run)await db.query("update tbl_model_training_runs set status='failed',active=false,reason='TRAINING_FAILED',completed_at=now() where id_run=$1 and status='training'",[run]).catch(()=>{});
    throw error;
  }finally{if(locked)await db.query('select pg_advisory_unlock(7420,1)').catch(()=>{});db.release();}
}
function startAutoTrainer(pool){
  if(workers.has(pool)||process.env.NLP_AUTO_TRAIN_ENABLED==='false')return ()=>{};
  let running=false,stopped=false;
  const tick=async()=>{if(running||stopped)return;running=true;try{await runTraining(pool);}catch(error){console.error('Automatic training unavailable:',error.code||error.name);}finally{running=false;}};
  const timer=setInterval(tick,30000);timer.unref();const stop=()=>{stopped=true;clearInterval(timer);workers.delete(pool);};workers.set(pool,{tick,stop});return stop;
}
function wakeAutoTrainer(pool){const worker=workers.get(pool);if(worker)setImmediate(worker.tick);}
module.exports={ready,confirmedCategory,captureLabel,activeModel,eligibleLabels,runTraining,startAutoTrainer,wakeAutoTrainer,digest,family,partition};
