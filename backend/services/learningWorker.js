const {parentPort,workerData}=require('node:worker_threads');
const crypto=require('node:crypto');
const {trainModel,evaluate}=require('../ml/textModel');
const {analyzeText}=require('../ml/reportAnalysis');
const splits=require('../ml/data/classification-splits.json');
const categories=[{name:'Kebakaran',priority:'Critical',keywords:['kebakaran','api','asap']},{name:'Pencerobohan',priority:'High',keywords:['pencerobohan','tanpa pas']},{name:'Pergaduhan',priority:'High',keywords:['pergaduhan']},{name:'Rondaan Biasa',priority:'Low',keywords:['rondaan','selamat']}];
function passes(candidate,baseline){
  return candidate.macroF1+1e-12>=baseline.macroF1&&candidate.categoryAccuracy+1e-12>=baseline.categoryAccuracy&&candidate.perCategory.every(row=>row.recall+1e-12>=(baseline.perCategory.find(item=>item.category===row.category)?.recall||0));
}
function buildCandidate({base,incumbent,train,validation,source}){
  const candidate=trainModel([...splits.train,...train],{language:base.language,excludedWords:base.excludedWords||[],trainedAt:new Date().toISOString()});
  candidate.inference={...base.inference};
  candidate.version='nb-auto-'+crypto.createHash('sha256').update(candidate.trainingChecksum+JSON.stringify(candidate.inference)+JSON.stringify(candidate.excludedWords)).digest('hex').slice(0,16);
  candidate.trainingSet={scope:'synthetic_plus_chief_confirmed',sourceDigest:source,syntheticTraining:splits.train.length,confirmedTraining:train.length,confirmedValidation:validation.length,limitations:['Small development regression checks are not proof of operational accuracy.','No model predictions are used as training labels.']};
  const metrics={synthetic:{candidate:evaluate(candidate,splits.test),incumbent:evaluate(incumbent,splits.test)},confirmed:{candidate:evaluate(candidate,validation),incumbent:evaluate(incumbent,validation)}};
  const safety=['Tiada kebakaran dikesan semasa rondaan.','Latihan kebakaran selesai tanpa kejadian sebenar.','Simulasi pencerobohan telah dijalankan.','Tiada pergaduhan berlaku di kawasan ini.'].every(text=>!['High','Critical'].includes(analyzeText({text,categories,model:candidate}).riskLevel));
  const accepted=passes(metrics.synthetic.candidate,metrics.synthetic.incumbent)&&passes(metrics.confirmed.candidate,metrics.confirmed.incumbent)&&safety;
  return {candidate,metrics:{...metrics,safety,notice:'Development regression gates; not an independent operational accuracy estimate.'},accepted,reason:accepted?'GATES_PASSED':'REGRESSION_GATE'};
}
if(parentPort){try{parentPort.postMessage(buildCandidate(workerData));}catch{parentPort.postMessage({error:'TRAINING_FAILED'});}}
module.exports={buildCandidate,passes};
