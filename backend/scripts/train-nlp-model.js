const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { cleanText, trainModel, evaluate } = require('../ml/textModel');
const dataPath = path.join(__dirname, '../ml/data/nlp-training-samples.json');
const modelPath = path.join(__dirname, '../ml/model/nlp-model.json');

const operationProfiles = {
  'Rondaan Biasa': {
    risk: 'Low',
    locations: ['pos lobi utama', 'pos bilik kawalan cctv', 'tingkat 3 pejabat suk', 'pos lif lg', 'pos utc', 'pos rumah vip'],
    events: ['rondaan selesai', 'keadaan terkawal', 'tiada insiden', 'buku laporan dikemas kini', 'semua pintu diperiksa', 'kawasan selamat'],
    actions: ['rekod syif dikemas kini', 'laluan diperiksa', 'pelawat direkodkan', 'pos diserahkan kepada syif berikutnya'],
  },
  Pencerobohan: {
    risk: 'High',
    locations: ['pintu belakang bangunan', 'koridor pejabat', 'kawasan larangan', 'bilik kawalan cctv', 'pos rumah vip', 'lif pejabat'],
    events: ['masuk tanpa izin', 'individu mencurigakan', 'orang asing tanpa pas', 'cubaan ceroboh', 'gagal menunjukkan pas', 'mengikuti kakitangan masuk'],
    actions: ['individu ditahan untuk semakan', 'ketua dimaklumkan', 'rakaman cctv disemak', 'akses ditolak dan kawasan dikawal'],
  },
  Kebakaran: {
    risk: 'Critical',
    locations: ['bilik utiliti', 'ruang elektrik', 'kawasan parkir', 'laluan tangga kecemasan', 'stor pejabat', 'lobi utama'],
    events: ['asap tebal', 'bau hangit', 'percikan api', 'alarm kebakaran berbunyi', 'api kecil', 'bau terbakar'],
    actions: ['pemadam api disediakan', 'kawasan dikosongkan', 'bomba dimaklumkan', 'laluan kecemasan dikawal'],
  },
  Pergaduhan: {
    risk: 'High',
    locations: ['ruang lobi', 'kaunter pelawat', 'kawasan parkir', 'pintu masuk dun', 'lif pejabat', 'ruang menunggu'],
    events: ['pergaduhan antara pelawat', 'kekecohan berlaku', 'individu bertindak agresif', 'pertengkaran kuat', 'saling menolak', 'enggan mematuhi arahan'],
    actions: ['pihak terlibat dileraikan', 'ketua dimaklumkan', 'keadaan dikawal', 'laporan dibuat kepada pentadbiran'],
  },
  'Kehilangan Aset': {
    risk: 'High',
    locations: ['bilik mesyuarat', 'stor pejabat', 'ruang menunggu', 'pos kawalan', 'tingkat 4', 'bilik fail'],
    events: ['aset hilang', 'barang dicuri', 'kad akses hilang', 'kunci tidak dapat dikesan', 'radio komunikasi hilang', 'dokumen rasmi hilang'],
    actions: ['rekod pinjaman disemak', 'rakaman cctv disemak', 'ketua dimaklumkan', 'laporan kehilangan direkodkan'],
  },
  Vandalisme: {
    risk: 'Medium',
    locations: ['tandas awam', 'papan tanda parkir', 'lobi utama', 'pintu stor', 'papan notis', 'kamera cctv luar'],
    events: ['dinding diconteng', 'cermin pecah', 'kerusi dirosakkan', 'papan tanda rosak', 'poster rasmi diconteng', 'kabel kamera dirosakkan'],
    actions: ['gambar bukti diambil', 'unit fasiliti dimaklumkan', 'kawasan ditanda untuk pembaikan', 'laporan vandalisme direkodkan'],
  },
  'Keselamatan Fizikal': {
    risk: 'Medium',
    locations: ['pintu belakang pejabat', 'pagar parkir', 'stor keselamatan', 'laluan kecemasan', 'bilik fail', 'tangga kecemasan'],
    events: ['pintu tidak berkunci', 'pagar terbuka', 'kunci mangga tidak dipasang', 'laluan kecemasan terhalang', 'pintu boleh dibuka tanpa kad', 'kawasan gelap'],
    actions: ['pintu dikunci semula', 'pegawai bertanggungjawab dimaklumkan', 'pemeriksaan keselamatan dibuat', 'catatan dibuat dalam buku laporan'],
  },
  'Kerosakan Kemudahan': {
    risk: 'Medium',
    locations: ['kawasan parkir', 'pos kawalan cctv', 'lif lg', 'lobi utama', 'koridor tingkat 3', 'pintu masuk'],
    events: ['lampu rosak', 'cctv tidak berfungsi', 'lif tidak beroperasi', 'interkom gagal berfungsi', 'sensor pintu rosak', 'pintu automatik tersekat'],
    actions: ['unit fasiliti dimaklumkan', 'aduan pembaikan direkodkan', 'laluan alternatif digunakan', 'pemantauan manual dibuat sementara'],
  },
};


function eventGroup(sample) {
  const profile = operationProfiles[sample.category];
  const normalized = cleanText(sample.text);
  const eventIndex = profile?.events.findIndex(event => normalized.includes(cleanText(event)));
  return eventIndex >= 0 ? `event:${sample.category}:${eventIndex}` : `source:${sample.category}:authored-seeds`;
}

function generateSyntheticSamples() {
  const shifts = ['syif pagi', 'syif petang', 'syif malam'];
  const guards = ['pengawal bertugas', 'anggota pos', 'ketua syif', 'petugas keselamatan'];
  const samples = [];
  for (const [category, profile] of Object.entries(operationProfiles)) {
    profile.locations.forEach((location, locationIndex) => profile.events.forEach((event, eventIndex) => {
      const action = profile.actions[(locationIndex + eventIndex) % profile.actions.length];
      const shift = shifts[(locationIndex + eventIndex) % shifts.length];
      const guard = guards[(locationIndex * 2 + eventIndex) % guards.length];
      samples.push({text:`${guard} melaporkan ${event} di ${location} semasa ${shift}. ${action}.`,category,risk:profile.risk,synthetic:true,group:`event:${category}:${eventIndex}`});
    }));
  }
  return samples;
}

function uniqueSamples(samples) {
  const seen = new Set();
  return samples.filter(sample => {
    const key = `${sample.category}|${cleanText(sample.text)}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

function splitSamples(samples) {
  const byCategory = new Map();
  for (const sample of samples) {
    const group = sample.group || eventGroup(sample);
    const groups = byCategory.get(sample.category) || new Map();
    groups.set(group,[...(groups.get(group) || []),{...sample,group}]);
    byCategory.set(sample.category,groups);
  }
  const train = [], test = [];
  for (const groups of byCategory.values()) {
    const ordered = [...groups].sort(([a],[b]) => crypto.createHash('sha256').update(a).digest('hex').localeCompare(crypto.createHash('sha256').update(b).digest('hex')));
    ordered.forEach(([, members],index) => (ordered.length > 1 && index % 5 === 0 ? test : train).push(...members));
  }
  return {train,test};
}

function main() {
  const seeds = JSON.parse(fs.readFileSync(dataPath,'utf8')).map(sample => ({...sample,synthetic:true,source:'hand-authored-synthetic-seed'}));
  const library = JSON.parse(fs.readFileSync(path.join(__dirname,'../ml/data/classification-scenarios.json'),'utf8'));
  const expanded = Object.entries(library).flatMap(([category,scenarios])=>scenarios.flatMap((text,index)=>[
    text,
    `Catatan petugas syif pagi: ${text}`,
    `Semasa pemantauan syif malam, perkara berikut direkodkan. ${text} Catatan diserahkan kepada penyelia.`,
    `Laporan pemeriksaan kawasan. ${text} Maklumat dimasukkan dalam buku tugas untuk rujukan.`,
  ].map((text,variant)=>({id:`authored-${Object.keys(library).indexOf(category)+1}-${index+1}-${variant+1}`,text,category,synthetic:true,source:'authored-scenario-variants',group:`authored:${category}:${index}`}))));
  const baseSamples = uniqueSamples([...seeds,...generateSyntheticSamples(),...expanded]);
  const additional = JSON.parse(fs.readFileSync(path.join(__dirname,'../ml/data/classification-expansion.json'),'utf8'));
  const places=['kawasan pejabat','laluan utama','ruang perkhidmatan','kawasan pentadbiran'];
  const samples=Object.keys(operationProfiles).flatMap((category,categoryIndex)=>{
    const existing=baseSamples.filter(row=>row.category===category);
    const variants=(additional[category]||[]).flatMap((text,index)=>[
      text,
      `Catatan syif pagi: ${text}`,
      `Laporan petugas di ${places[index%places.length]}. ${text}`,
      `Butiran pemeriksaan syif petang. ${text} Catatan telah diserahkan kepada penyelia.`,
      `Rekod syif malam di ${places[(index+1)%places.length]}: ${text}`,
      `Security duty log. ${text} Details recorded for the next shift.`,
      `Nota petugas bertugas. ${text} Maklumat ini direkodkan untuk rujukan seterusnya.`,
      `Pemerhatian semasa bertugas di ${places[(index+2)%places.length]}. ${text} Penyelia dimaklumkan tentang catatan ini.`,
    ].map((text,variant)=>({id:`expanded-${categoryIndex+1}-${index+1}-${variant+1}`,text,category,synthetic:true,source:'additional-authored-scenario-variants',group:`expanded:${category}:${index}`})));
    const selected=uniqueSamples([...existing,...variants]).slice(0,250);
    if(selected.length!==250)throw new Error(`Expected 250 distinct synthetic examples for ${category}`);
    return selected;
  });
  const labels=new Map();
  for(const row of samples){const key=cleanText(row.text);if(labels.has(key)&&labels.get(key)!==row.category)throw new Error('Conflicting labels for the same normalized text');labels.set(key,row.category);}
  const {train,test} = splitSamples(samples);
  const trainGroups = [...new Set(train.map(sample => sample.group))].sort();
  const testGroups = [...new Set(test.map(sample => sample.group))].sort();
  if(testGroups.some(group => trainGroups.includes(group))) throw new Error('Source group leaked across train/test');
  const trainTexts=new Set(train.map(row=>cleanText(row.text)));
  if(test.some(row=>trainTexts.has(cleanText(row.text))))throw new Error('Duplicate text leaked across train/test');
  const corpusPath=path.join(__dirname,'../ml/data/classification-corpus.json');
  fs.writeFileSync(corpusPath,JSON.stringify({version:'penjaga-synthetic-corpus-v2',synthetic:true,labelScope:'Incident topic only; risk and event assertion are separate contextual policies.',samples},null,2)+'\n');
  fs.writeFileSync(path.join(__dirname,'../ml/data/classification-splits.json'),JSON.stringify({version:'penjaga-synthetic-split-v2',synthetic:true,train,test,notes:'Scenario families stay together. The test partition is a development benchmark, not real-world validation.'},null,2)+'\n');
  // Neutral report boilerplate must not become evidence for a particular incident category.
  const excludedWords=['catatan','syif','pagi','petang','malam','laporan','nota','butiran','petugas','pengawal','bertugas','direkodkan','maklumat','rujukan','seterusnya','penyelia','diserahkan','duty','log','details','recorded','next','shift'];
  const model = trainModel(train,{language:'ms-MY',trainedAt:new Date().toISOString(),excludedWords});
  const candidates=[];
  let best=null;
  // Fixed development-only search. The separate challenge fixture is never loaded here.
  for(const alpha of [1,.05,.1,.5,2,5])for(const bigramWeight of [1,.5,0])for(const classPrior of ['empirical','uniform']){
    model.inference={alpha,bigramWeight,classPrior};
    const metrics=evaluate(model,test);
    candidates.push({inference:{...model.inference},macroF1:metrics.macroF1,categoryAccuracy:metrics.categoryAccuracy});
    if(!best||metrics.macroF1>best.metrics.macroF1)best={inference:{...model.inference},metrics};
  }
  model.inference=best.inference;
  model.version='nb-v2-'+crypto.createHash('sha256').update(model.trainingChecksum+JSON.stringify(model.inference)+JSON.stringify(model.excludedWords)).digest('hex').slice(0,12);
  model.metrics=best.metrics;
  model.selection={scope:'Development-only hyperparameter selection; metrics are not an unbiased holdout estimate.',selected:best.inference,candidates};
  model.trainingSet = {
    source:'data/classification-corpus.json',scope:'synthetic_only',
    corpusSha256:crypto.createHash('sha256').update(fs.readFileSync(corpusPath)).digest('hex'),
    authoredScenarios:Object.values(library).reduce((n,rows)=>n+rows.length,0),
    additionalAuthoredScenarios:Object.values(additional).reduce((n,rows)=>n+rows.length,0),
    corpusSamples:samples.length,examplesPerCategory:250,
    seedSamples:seeds.length,syntheticSamples:samples.length-seeds.length,
    trainSamples:train.length,testSamples:test.length,
    split:'deterministic_category_stratified_event_source_groups',trainGroups,testGroups,
    limitations:['Generated variants sharing an event family stay in one split.','Authored seeds without a recognized generated event are kept together by category.','Variants are not independent incidents; a larger synthetic corpus does not establish operational accuracy.','This is an internal synthetic benchmark, not an independent operational holdout.','No risk accuracy is reported: urgency is a separate contextual policy.'],
  };
  fs.mkdirSync(path.dirname(modelPath),{recursive:true});
  fs.writeFileSync(modelPath,`${JSON.stringify(model,null,2)}\n`);
  fs.writeFileSync(path.join(__dirname,'../ml/model/classification-training-report.json'),JSON.stringify({modelVersion:model.version,scope:'Synthetic development evaluation only',trainingSet:model.trainingSet,selection:model.selection,categoryMetrics:model.metrics,limitations:model.trainingSet.limitations},null,2)+'\n');
  console.log(`Saved ${model.version}: ${train.length} synthetic training reports; ${test.length} grouped synthetic development reports.`);
  console.log(`Synthetic category macro-F1: ${(model.metrics.macroF1*100).toFixed(1)}%; operational accuracy: not measured.`);
}

if(require.main===module)main();
module.exports={generateSyntheticSamples,splitSamples,uniqueSamples,eventGroup};
