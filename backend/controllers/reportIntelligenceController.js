const pool=require('../config/db');
const roles=require('../config/roles');
const {processNLP}=require('../ml/nlpService');
const {tokenize}=require('../ml/textModel');
const {enqueue,wakeWorker,schemaReady}=require('../services/nlpJobs');
const {logAudit}=require('../utils/audit');
const bursts=new Map();
function id(value){if(!/^[1-9]\d*$/.test(String(value))||Number(value)>2147483647)throw Object.assign(new Error('ID tidak sah'),{status:400});return Number(value);}
function limit(req,key,max,windowMs){
  const now=Date.now();const name=`${key}:${req.user.id_pengguna}`;let entry=bursts.get(name);
  if(!entry||entry.until<=now){entry={count:0,until:now+windowMs};bursts.set(name,entry);}
  if(bursts.size>5000)for(const [k,v]of bursts)if(v.until<=now)bursts.delete(k);
  if(++entry.count>max)throw Object.assign(new Error('Terlalu banyak permintaan. Cuba sebentar lagi.'),{status:429});
}
async function ownedReport(req,db=pool){
  const result=await db.query('select * from tbl_laporan_harian where id_laporan=$1',[id(req.params.id)]);
  if(!result.rowCount)throw Object.assign(new Error('Laporan tidak ditemui'),{status:404});
  const report=result.rows[0];
  if(req.user.nama_peranan===roles.guard&&report.id_pengguna!==req.user.id_pengguna)throw Object.assign(new Error('Anda tidak dibenarkan melihat laporan ini'),{status:403});
  return report;
}
const handle=fn=>async(req,res)=>{try{await fn(req,res);}catch(error){if(!error.status)console.error('Report intelligence error:',error.code||error.name);res.status(error.status||503).json({message:error.status?error.message:'Maklumat analisis belum tersedia. Semak sambungan dan migrasi NLP.'});}};
const assist=handle(async(req,res)=>{
  limit(req,'assist',40,60000);
  if(typeof req.body.text!=='string'||req.body.text.trim().length<5||req.body.text.length>20000)throw Object.assign(new Error('Tulis antara 5 dan 20000 aksara untuk menyemak draf'),{status:400});
  const selectedPostId=req.body.id_pos===undefined?undefined:id(req.body.id_pos);
  if(selectedPostId&&!((await pool.query("select 1 from tbl_pos_kawalan where id_pos=$1 and status_pos='Aktif'",[selectedPostId])).rowCount))throw Object.assign(new Error('Pos tidak tersedia'),{status:400});
  const result=await processNLP(req.body.text,{selectedPostId,sourceHash:req.body.sourceHash,clarifications:req.body.clarifications});
  res.set('Cache-Control','no-store').json(result);
});
const analysis=handle(async(req,res)=>{
  const report=await ownedReport(req);
  const result=await pool.query('select * from tbl_hasil_nlp where id_laporan=$1 order by tarikh_analisis desc,id_nlp desc limit 1',[report.id_laporan]);
  const job=await pool.query('select id_job,status,attempts,last_error,created_at,completed_at from tbl_job_nlp where id_laporan=$1 order by id_job desc limit 1',[report.id_laporan]);
  res.set('Cache-Control','no-store').json({analysis:result.rows[0]||null,job:job.rows[0]||null});
});
const reanalyse=handle(async(req,res)=>{
  limit(req,'reanalyse',6,3600000);
  const client=await pool.connect();let job;
  try{
    await client.query('begin');const report=await ownedReport(req,client);
    job=await enqueue(client,report,req.user.id_pengguna,{retry:true,force:true});
    await logAudit(client,req.user.id_pengguna,'REQUEST_NLP_REVIEW',`Laporan #${report.id_laporan}`,'Analisis semula diminta; keputusan rasmi dikekalkan');
    await client.query('commit');
  }catch(error){await client.query('rollback');throw error;}finally{client.release();}
  wakeWorker(pool);res.status(202).json({job});
});
const feedback=handle(async(req,res)=>{
  const report=await ownedReport(req);const analysisId=id(req.body.id_nlp);
  if(!['helpful','needs_correction'].includes(req.body.decision)||req.body.comment!==undefined&&(typeof req.body.comment!=='string'||req.body.comment.length>1000))throw Object.assign(new Error('Maklum balas tidak sah'),{status:400});
  const client=await pool.connect();
  try{
    await client.query('begin');
    const row=await client.query('select id_nlp from tbl_hasil_nlp where id_nlp=$1 and id_laporan=$2',[analysisId,report.id_laporan]);
    if(!row.rowCount)throw Object.assign(new Error('Analisis tidak ditemui'),{status:404});
    await client.query(`insert into tbl_maklum_balas_nlp(id_nlp,id_pengguna,decision,comment) values($1,$2,$3,$4)
      on conflict(id_nlp,id_pengguna) do update set decision=excluded.decision,comment=excluded.comment,created_at=now()`,[analysisId,req.user.id_pengguna,req.body.decision,req.body.comment?.trim()||'']);
    await logAudit(client,req.user.id_pengguna,'NLP_FEEDBACK',`Laporan #${report.id_laporan}`,req.body.decision);
    await client.query('commit');res.status(201).json({message:'Maklum balas disimpan untuk semakan penyelenggara. Peraturan dan model tidak diubah.'});
  }catch(error){await client.query('rollback');throw error;}finally{client.release();}
});
function rank(text,rows){
  const documentTokens=rows.map(row=>tokenize(`${row.tajuk_laporan} ${row.kandungan_laporan}`));
  const query=tokenize(text);const vocabulary=new Set(query);const frequencies=new Map();
  for(const tokens of documentTokens)for(const word of new Set(tokens))frequencies.set(word,(frequencies.get(word)||0)+1);
  const vector=tokens=>{const counts=new Map();for(const word of tokens)counts.set(word,(counts.get(word)||0)+1);const out=new Map();for(const [word,count]of counts)out.set(word,(1+Math.log(count))*Math.log(1+(rows.length+1)/((frequencies.get(word)||0)+1)));return out;};
  const q=vector(query);const magnitude=v=>Math.sqrt([...v.values()].reduce((sum,n)=>sum+n*n,0));const qm=magnitude(q);
  return rows.map((row,index)=>{const d=vector(documentTokens[index]);const dot=[...vocabulary].reduce((sum,word)=>sum+(q.get(word)||0)*(d.get(word)||0),0);const dm=magnitude(d);const similarity=qm&&dm?dot/(qm*dm):0;const {kandungan_laporan:_text,...safe}=row;return {...safe,similarity:Number(similarity.toFixed(4))};}).filter(row=>row.similarity>0).sort((a,b)=>b.similarity-a.similarity||b.id_laporan-a.id_laporan).slice(0,5);
}
async function candidates(req,exclude=null){
  const owner=req.user.nama_peranan===roles.guard?req.user.id_pengguna:null;
  return (await pool.query(`select l.id_laporan,l.tajuk_laporan,l.kandungan_laporan,l.tarikh_laporan::text,l.status_laporan,p.nama_pos,n.kategori_dikesan,n.tahap_risiko
    from tbl_laporan_harian l left join tbl_pos_kawalan p using(id_pos)
    left join lateral(select kategori_dikesan,tahap_risiko from tbl_hasil_nlp where id_laporan=l.id_laporan order by tarikh_analisis desc,id_nlp desc limit 1)n on true
    where ($1::int is null or l.id_pengguna=$1) and ($2::int is null or l.id_laporan<>$2)
    order by l.tarikh_laporan desc,l.id_laporan desc limit 500`,[owner,exclude])).rows;
}
const similar=handle(async(req,res)=>{
  const report=await ownedReport(req);const rows=await candidates(req,report.id_laporan);
  res.set('Cache-Control','no-store').json({items:rank(`${report.tajuk_laporan} ${report.kandungan_laporan}`,rows),method:'tfidf',candidateLimit:500,notice:'Padanan teks berkaitan; bukan pengesahan kejadian berulang atau carian semantik.'});
});
const search=handle(async(req,res)=>{
  limit(req,'search',30,60000);const q=req.query.q;
  if(typeof q!=='string'||q.trim().length<2||q.length>500)throw Object.assign(new Error('Carian mesti antara 2 dan 500 aksara'),{status:400});
  res.set('Cache-Control','no-store').json({items:rank(q,await candidates(req)),method:'tfidf',candidateLimit:500});
});
const briefing=handle(async(req,res)=>{
  const date=req.query.date||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const parsed=new Date(`${date}T00:00:00Z`);
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(parsed.valueOf())||parsed.toISOString().slice(0,10)!==date)throw Object.assign(new Error('Tarikh ringkasan tidak sah'),{status:400});
  const reports=await pool.query(`select l.id_laporan,l.tajuk_laporan,l.tarikh_laporan::text,l.status_laporan,p.nama_pos,n.ringkasan_automatik,n.tahap_risiko,n.metadata->'review'->>'status' as review_status,
    (select count(*)::int from tbl_tindakan_susulan a where a.id_laporan=l.id_laporan and a.status_tindakan<>'Selesai') as open_actions
    from tbl_laporan_harian l left join tbl_pos_kawalan p using(id_pos)
    left join lateral(select * from tbl_hasil_nlp where id_laporan=l.id_laporan order by tarikh_analisis desc,id_nlp desc limit 1)n on true
    where l.tarikh_laporan=$1::date order by l.id_laporan desc limit 50`,[date]);
  res.set('Cache-Control','no-store').json({date,timezone:'Asia/Kuala_Lumpur',method:'extractive_records',items:reports.rows,limit:50,notice:'Ringkasan rekod tersimpan; semak laporan asal. Tiada kesimpulan keselamatan atau pengesahan lokasi fizikal.'});
});
const status=handle(async(_req,res)=>{
  const cfg=require('../ml/geminiReviewer').configuration();const ready=await schemaReady(pool);
  const counts=ready?(await pool.query('select status,count(*)::int as count from tbl_job_nlp group by status')).rows:[];
  const model=require('../ml/nlpService').loadModel();
  res.set('Cache-Control','no-store').json({ready,provider:cfg.provider,model:cfg.model,configured:cfg.configured,enabled:cfg.enabled,promptVersion:cfg.promptVersion,localModel:{type:model?.modelType||null,version:model?.version||null},queue:counts});
});
module.exports={assist,analysis,reanalyse,feedback,similar,search,briefing,status,rank,ownedReport};
