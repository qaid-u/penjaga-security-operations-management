const crypto=require('node:crypto');
const {processNLP,context}=require('../ml/nlpService');
const {reviewAnalysis,configuration,VERSION:REVIEW_VERSION}=require('../ml/geminiReviewer');
const {logAudit}=require('../utils/audit');
const PIPELINE_VERSION='penjaga-nlp-events-v3';
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
const inputHash=report=>hash(JSON.stringify({text:report.kandungan_laporan,post:report.id_pos||null,clarifications:report.nlp_context||{}}));
const jobInputHash=(report,job)=>String(job.pipeline_version||'').startsWith('penjaga-nlp-events-v3')?inputHash(report):hash(report.kandungan_laporan);
const workers=new WeakMap();
const unavailable=reason=>({status:'unavailable',provider:'gemini',model:configuration().model,promptVersion:REVIEW_VERSION,findings:[],reason});
async function schemaReady(db){return Boolean((await db.query("select to_regclass('tbl_job_nlp') is not null and exists(select 1 from pg_attribute where attrelid=to_regclass('tbl_laporan_harian') and attname='nlp_context' and not attisdropped) as ready")).rows[0]?.ready);}
async function enqueue(db,report,userId,{retry=false,force=false}={}){
  await db.query('select pg_advisory_xact_lock(7417,$1::int)',[report.id_laporan]);
  const active=await db.query("select id_job,id_laporan,status,attempts,created_at,completed_at from tbl_job_nlp where id_laporan=$1 and input_hash=$2 and status in ('pending','processing') order by id_job desc limit 1",[report.id_laporan,inputHash(report)]);
  if(active.rowCount)return active.rows[0];
  const pipeline=force?`${PIPELINE_VERSION}:${crypto.randomUUID()}`:PIPELINE_VERSION;
  const result=await db.query(`insert into tbl_job_nlp(id_laporan,input_hash,pipeline_version,requested_by)
    values($1,$2,$3,$4) on conflict(id_laporan,input_hash,pipeline_version) do update
    set status=case when $5::boolean and tbl_job_nlp.status='failed' then 'pending' else tbl_job_nlp.status end,
        attempts=case when $5::boolean and tbl_job_nlp.status='failed' then 0 else tbl_job_nlp.attempts end,
        available_at=case when $5::boolean and tbl_job_nlp.status='failed' then now() else tbl_job_nlp.available_at end
    returning id_job,id_laporan,status,attempts,created_at,completed_at`,
  [report.id_laporan,inputHash(report),pipeline,userId,retry]);
  return result.rows[0];
}
async function alertOnce(client,report,analysis){
  // The AI review cannot suppress the existing conservative keyword alert policy.
  const baseline=analysis.baseline||analysis;
  const alert=['High','Critical'].includes(baseline.riskLevel)?baseline:analysis;
  if(!['High','Critical'].includes(alert.riskLevel))return;
  const historical=await client.query("select 1 from tbl_notifikasi where id_laporan=$1 and jenis_notifikasi='Risiko Tinggi' limit 1",[report.id_laporan]);
  const marker=await client.query('insert into tbl_amaran_nlp(id_laporan) values($1) on conflict do nothing returning id_laporan',[report.id_laporan]);
  if(historical.rowCount||!marker.rowCount)return;
  await client.query(`insert into tbl_notifikasi(id_pengguna,id_laporan,tajuk_notifikasi,mesej_notifikasi,jenis_notifikasi,tahap_keutamaan)
    select p.id_pengguna,$1,$2,$3,'Risiko Tinggi',$4 from tbl_pengguna p join tbl_peranan r using(id_peranan)
    where r.nama_peranan='Ketua Pengawal' and p.status_akaun='Aktif'`,
  [report.id_laporan,`Insiden ${alert.riskLevel}`,`Laporan #${report.id_laporan} memerlukan semakan. Amaran konservatif dikekalkan walaupun analisis atau semakan AI berbeza.`,alert.riskLevel]);
}
async function saveAnalysis(client,report,result,review,{jobId=null,inputHash:sourceHash=inputHash(report)}={}){
  const metadata={schemaVersion:3,pipelineVersion:PIPELINE_VERSION,inputHash:sourceHash,model:result.model,eventStatus:result.eventStatus,title:result.title,summary:result.summary,evidence:result.evidence||[],events:result.events||[],eventsTruncated:Boolean(result.eventsTruncated),eventCount:result.eventCount,eventLimit:result.eventLimit,dialogue:result.dialogue||{},extraction:result.extraction||{},quality:result.quality||{},sourceChecks:result.sourceChecks||{},alternatives:result.alternatives||[],baseline:result.baseline||null,review,alertPolicy:'conservative-keyword-or-analysis; reviewer cannot suppress alerts'};
  const score=Number.isFinite(result.riskScore)?Math.max(0,Math.min(100,Math.round(result.riskScore))):0;
  const confidence=Number.isFinite(result.confidence)?Math.max(0,Math.min(1,result.confidence)):0;
  const risk=['Low','Medium','High','Critical','Unknown'].includes(result.riskLevel)?result.riskLevel:'Unknown';
  const saved=await client.query(`insert into tbl_hasil_nlp(id_laporan,teks_diproses,kata_kunci_dikesan,kategori_dikesan,skor_risiko,tahap_risiko,ringkasan_automatik,tahap_keyakinan,metadata)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,[report.id_laporan,result.cleanText,result.matchedKeywords||[],result.topCategory||'Unknown',score,risk,result.summary||'',confidence,metadata]);
  await client.query('update tbl_laporan_harian set tahap_risiko=$1 where id_laporan=$2',[risk,report.id_laporan]);
  await alertOnce(client,report,result);
  if(jobId)await client.query("update tbl_job_nlp set status='completed',id_nlp=$1,completed_at=now(),locked_at=null,lease_token=null,last_error=null where id_job=$2",[saved.rows[0].id_nlp,jobId]);
  return saved.rows[0];
}
async function runOne(pool,{reviewer=reviewAnalysis}={}){
  // Atomic lease. No connection remains checked out while Gemini is responding.
  const lease=crypto.randomUUID();
  const job=(await pool.query(`update tbl_job_nlp set status='processing',attempts=attempts+1,locked_at=now(),lease_token=$1
    where id_job=(select id_job from tbl_job_nlp where status='pending' and available_at<=now() order by id_job for update skip locked limit 1) returning *`,[lease])).rows[0];
  if(!job)return false;
  try{
    const report=(await pool.query('select * from tbl_laporan_harian where id_laporan=$1',[job.id_laporan])).rows[0];
    if(!report||jobInputHash(report,job)!==job.input_hash)throw Object.assign(new Error('STALE_INPUT'),{code:'STALE_INPUT'});
    const analysisInputHash=inputHash(report);
    const refs=await context(pool);
    const result=await processNLP(report.kandungan_laporan,{context:refs,selectedPostId:report.id_pos,sourceHash:report.nlp_context?.draftHash,clarifications:report.nlp_context?.clarifications});
    const review=await reviewer({text:report.kandungan_laporan,analysis:result,...refs});
    const client=await pool.connect();
    try{
      await client.query('begin');
      const locked=(await client.query('select * from tbl_job_nlp where id_job=$1 for update',[job.id_job])).rows[0];
      const current=(await client.query('select * from tbl_laporan_harian where id_laporan=$1 for update',[job.id_laporan])).rows[0];
      if(locked?.status!=='processing'||locked.lease_token!==lease||!current||inputHash(current)!==analysisInputHash)throw Object.assign(new Error('STALE_INPUT'),{code:'STALE_INPUT'});
      await saveAnalysis(client,report,result,review,{jobId:job.id_job,inputHash:analysisInputHash});
      await logAudit(client,job.requested_by,'ANALYSE_REPORT',`Laporan #${job.id_laporan}`,'Analisis tempatan dan semakan AI direkodkan');
      await client.query('commit');
    }catch(error){await client.query('rollback');throw error;}finally{client.release();}
  }catch(error){
    const code=error.code==='STALE_INPUT'?'STALE_INPUT':'ANALYSIS_FAILED';
    await pool.query(`update tbl_job_nlp set status=case when attempts<3 and $2<>'STALE_INPUT' then 'pending' else 'failed' end,
      available_at=now()+interval '10 seconds',locked_at=null,lease_token=null,last_error=$2 where id_job=$1 and status='processing' and lease_token=$3`,[job.id_job,code,lease]);
    console.error('NLP job error:',code);
  }
  return true;
}
function startWorker(pool){
  if(workers.has(pool)||process.env.NLP_WORKER_ENABLED==='false')return ()=>{};
  let active=false;let stopped=false;
  const tick=async()=>{
    if(active||stopped)return;active=true;
    try{
      if(!await schemaReady(pool))return;
      await pool.query("update tbl_job_nlp set status=case when attempts<3 then 'pending' else 'failed' end,locked_at=null,lease_token=null,last_error='LEASE_EXPIRED' where status='processing' and locked_at<now()-interval '3 minutes'");
      await runOne(pool);
    }catch(error){if(error.code!=='42P01')console.error('NLP worker unavailable:',error.code||error.name);}finally{active=false;}
  };
  const timer=setInterval(tick,1500);timer.unref();
  const stop=()=>{stopped=true;clearInterval(timer);workers.delete(pool);};workers.set(pool,{tick,stop});return stop;
}
function wakeWorker(pool){const worker=workers.get(pool);if(worker)setImmediate(worker.tick);}
module.exports={enqueue,saveAnalysis,runOne,startWorker,wakeWorker,schemaReady,hash,inputHash,PIPELINE_VERSION,unavailable};
