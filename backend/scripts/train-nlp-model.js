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
  const samples = uniqueSamples([...seeds,...generateSyntheticSamples()]);
  const {train,test} = splitSamples(samples);
  const trainGroups = [...new Set(train.map(sample => sample.group))].sort();
  const testGroups = [...new Set(test.map(sample => sample.group))].sort();
  if(testGroups.some(group => trainGroups.includes(group))) throw new Error('Source group leaked across train/test');
  const model = trainModel(train,{language:'ms-MY',trainedAt:new Date().toISOString()});
  model.metrics = evaluate(model,test);
  model.trainingSet = {
    source:'data/nlp-training-samples.json',scope:'synthetic_only',
    seedSamples:seeds.length,syntheticSamples:samples.length-seeds.length,
    trainSamples:train.length,testSamples:test.length,
    split:'deterministic_category_stratified_event_source_groups',trainGroups,testGroups,
    limitations:['Generated variants sharing an event family stay in one split.','Authored seeds without a recognized generated event are kept together by category.','This is an internal synthetic benchmark, not an independent operational holdout.','No risk accuracy is reported: urgency is a separate contextual policy.'],
  };
  fs.mkdirSync(path.dirname(modelPath),{recursive:true});
  fs.writeFileSync(modelPath,`${JSON.stringify(model,null,2)}\n`);
  console.log(`Saved ${model.version}: ${train.length} synthetic training reports; ${test.length} grouped synthetic holdout reports.`);
  console.log(`Synthetic category macro-F1: ${(model.metrics.macroF1*100).toFixed(1)}%; operational accuracy: not measured.`);
}

if(require.main===module)main();
module.exports={generateSyntheticSamples,splitSamples,uniqueSamples,eventGroup};
