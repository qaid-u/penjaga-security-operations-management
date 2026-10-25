const fs=require('node:fs');
const path=require('node:path');
const pool=require('../config/db');
const {analyzeText}=require('./reportAnalysis');
const {buildDialogue,draftHashFor}=require('./eventDialogue');
const {parseClarificationInput,invalid}=require('./clarificationInput');
const {buildingCatalogue,matchesOfficialPost}=require('../services/securityPostCatalogue');
const aliases=require('../config/securityLocationAliases.json');
let cachedModel=null;let cachedStamp='';
function loadModel(){
  const filename=process.env.NLP_MODEL_PATH||path.join(__dirname,'model/nlp-model.json');
  try{
    const stat=fs.statSync(filename);const stamp=`${filename}:${stat.mtimeMs}:${stat.size}`;
    if(stamp!==cachedStamp){cachedModel=JSON.parse(fs.readFileSync(filename,'utf8'));cachedStamp=stamp;}
    return cachedModel;
  }catch{cachedModel=null;cachedStamp='';return null;}
}
async function context(db=pool){
  const result=await db.query("select id_kategori_insiden,nama_kategori,tahap_keutamaan,kata_kunci_rujukan from tbl_kategori_insiden where status_kategori='Aktif' order by id_kategori_insiden");
  const categories=result.rows.map(r=>({id:r.id_kategori_insiden,name:r.nama_kategori,priority:r.tahap_keutamaan,keywords:Array.isArray(r.kata_kunci_rujukan)?r.kata_kunci_rujukan:[]}));
  let locations=[];
  try{locations=(await db.query(`select l.id_lokasi,l.hotspot_id,l.nama_paparan,l.id_pos,p.nama_pos,p.nama_bangunan from tbl_lokasi_3d l left join tbl_pos_kawalan p using(id_pos) where l.status_aktif and (p.id_pos is null or p.status_pos='Aktif') order by l.id_lokasi`)).rows.map(row=>{
    const building=buildingCatalogue.buildings.find(item=>item.posts.some(post=>post.id===row.hotspot_id));
    const official=building?.posts.find(post=>post.id===row.hotspot_id);
    const mapped=!official||matchesOfficialPost(row,official,building.id);
    return {...row,id_pos:mapped?row.id_pos:null,aliases:aliases[row.hotspot_id]||[],buildingId:building?.id||null,building_id:building?.id||null,buildingName:building?.name||null};
  });}
  catch(error){if(error.code!=='42P01')throw error;}
  return {categories,locations};
}
async function processNLP(text,options={}){
  if(typeof text!=='string'||!text.trim()||text.length>20000){const error=new Error('Teks laporan mesti antara 1 dan 20000 aksara');error.status=400;throw error;}
  const refs=options.context||await context(options.db||pool);
  const input=parseClarificationInput({...(options.sourceHash?{draftHash:options.sourceHash}:{}),...(options.clarifications?{clarifications:options.clarifications}:{})});
  const expectedHash=draftHashFor(text,options.selectedPostId);
  if(options.sourceHash&&options.sourceHash!==expectedHash)throw invalid();
  const analysis=analyzeText({text,...refs,model:loadModel()});
  const resolved=buildDialogue({text,analysis,locations:refs.locations,selectedPostId:options.selectedPostId,clarifications:input.clarifications||[]});
  if(resolved.errors?.length)throw invalid();
  const {events,candidateQuestions:_candidates,errors:_errors,...dialogue}=resolved;
  return {...analysis,events,dialogue};
}
module.exports={processNLP,context,loadModel};
