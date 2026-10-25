const path=require('node:path');
require('dotenv').config({path:path.join(__dirname,'../.env')});
const {reviewAnalysis,configuration}=require('../ml/geminiReviewer');
async function main(){
  const config=configuration();
  if(!config.configured){console.log(JSON.stringify({provider:config.provider,model:config.model,status:'unavailable',reason:config.enabled?'NOT_CONFIGURED':'DISABLED'}));process.exitCode=2;return;}
  const text='Tiada kebakaran dikesan pada 11:20 di Sayap Kiri. Pemeriksaan selesai.';
  const result=await reviewAnalysis({text,categories:[{name:'Kebakaran',priority:'Critical'},{name:'Rondaan Biasa',priority:'Low'}],locations:[{id_lokasi:3,nama_paparan:'Sayap Kiri'}],analysis:{topCategory:'Kebakaran',riskLevel:'Critical',riskScore:95,eventStatus:'reported',summary:'Kebakaran dikesan.',extraction:{}}});
  // Synthetic deliberate mismatch only; no stored operational report is sent.
  console.log(JSON.stringify({provider:result.provider,model:result.model,status:result.status,reason:result.reason,findings:result.findings,synthetic:true},null,2));
  if(result.status!=='needs_review'||!result.findings.length)process.exitCode=1;
}
main().catch(()=>{console.error('Gemini synthetic check failed; no credentials or provider body printed.');process.exitCode=1;});
