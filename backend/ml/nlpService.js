const fs=require('node:fs');
const path=require('node:path');
const pool=require('../config/db');
const {analyzeText}=require('./reportAnalysis');
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
  try{locations=(await db.query('select id_lokasi,hotspot_id,nama_paparan from tbl_lokasi_3d where status_aktif order by id_lokasi')).rows;}
  catch(error){if(error.code!=='42P01')throw error;}
  return {categories,locations};
}
async function processNLP(text,options={}){
  if(typeof text!=='string'||!text.trim()||text.length>20000){const error=new Error('Teks laporan mesti antara 1 dan 20000 aksara');error.status=400;throw error;}
  const refs=options.context||await context(options.db||pool);
  return analyzeText({text,...refs,model:loadModel()});
}
module.exports={processNLP,context,loadModel};
