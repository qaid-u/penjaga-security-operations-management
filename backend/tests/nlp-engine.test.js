const { test } = require('node:test');
const assert = require('node:assert/strict');
const { tokenize, trainModel, predict, validateModel } = require('../ml/textModel');
const { analyzeText, extractTimes, extractLocations } = require('../ml/reportAnalysis');
const { splitSamples } = require('../scripts/train-nlp-model');
const model = require('../ml/model/nlp-model.json');

const categories = [
  { name: 'Rondaan Biasa', priority: 'Low', keywords: ['rondaan', 'selamat'] },
  { name: 'Kebakaran', priority: 'Critical', keywords: ['kebakaran', 'api', 'asap'] },
  { name: 'Pencerobohan', priority: 'High', keywords: ['pencerobohan', 'tanpa pas'] },
  { name: 'Kerosakan Kemudahan', priority: 'Medium', keywords: ['rosak', 'tidak berfungsi'] },
  { name: 'Keselamatan Fizikal', priority: 'Medium', keywords: ['tidak berkunci', 'pagar terbuka'] },
];
const locations = [
  { id_lokasi: 1, hotspot_id: 'HOTSPOT_MAIN_ENTRANCE', nama_paparan: 'Pintu Masuk Utama', id_pos: 8 },
  { id_lokasi: 3, hotspot_id: 'HOTSPOT_LEFT_WING', nama_paparan: 'Sayap Kiri', id_pos: null },
];
const run = text => analyzeText({ text, categories, locations, model });

test('official DJM post names are recognized as records without inferring spatial coordinates', () => {
  const { catalogue } = require('../services/securityPostCatalogue');
  const official = catalogue.posts.map((post,i) => ({id_lokasi:100+i,hotspot_id:post.id,nama_paparan:post.name,id_pos:i+1}));
  for (const location of official) {
    const found = extractLocations(`Rondaan selesai di ${location.nama_paparan}.`, official);
    assert.equal(found.length,1); assert.equal(found[0].hotspot_id,location.hotspot_id); assert.equal(found[0].id_pos,location.id_pos);
    assert.equal(found[0].position,undefined);
  }
  assert.deepEqual(extractLocations('Rondaan di tingkat 4.',official),[]);
});

test('all modeled buildings recognize only stated post names and keep shared-model records distinct', () => {
  const { buildingCatalogue } = require('../services/securityPostCatalogue');
  const official = buildingCatalogue.buildings.flatMap(building=>building.posts.map((post,index)=>({
    id_lokasi:200+buildingCatalogue.buildings.indexOf(building)*10+index,hotspot_id:post.id,
    nama_paparan:post.name,id_pos:200+buildingCatalogue.buildings.indexOf(building)*10+index,
  })));
  for (const location of official) {
    const text=`Pemeriksaan selesai di ${location.nama_paparan}.`;
    const found=extractLocations(text,official);
    assert.equal(found.length,1);assert.equal(found[0].hotspot_id,location.hotspot_id);
    assert.equal(found[0].text,location.nama_paparan);assert.equal(text.slice(found[0].start,found[0].end),location.nama_paparan);
    assert.equal(found[0].position,undefined);assert.equal(found[0].floor,undefined);
  }
  for (const text of ['Rondaan di BSI.','Pemeriksaan Bangunan Sultan Ismail.','Rondaan di rumah.','Kaunter di tingkat 2.']) assert.deepEqual(extractLocations(text,official),[]);
  for (const [name,id] of [['Pos BDMSP','POST_BDMSP'],['Pos BDMIM','POST_BDMIM'],['Pos Rumah SS','POST_RUMAH_SS'],['Pos Rumah VIP','POST_RUMAH_VIP']]) {
    assert.deepEqual(extractLocations(`Rondaan ${name}.`,official).map(item=>item.hotspot_id),[id]);
  }
  assert.deepEqual(extractLocations('Pos BSI Johor Bahru diperiksa.',official),[]);
});

test('saved model and runtime share a validated count format and preprocessing version', () => {
  assert.equal(validateModel(model), true);
  assert.equal(model.weights, undefined);
  assert.ok(tokenize('Tiada kebakaran, NOT detected!').includes('tiada_kebakaran'));
  assert.ok(tokenize('CCTV tidak berfungsi').includes('tidak_berfungsi'));
  const prediction = predict(model, 'Asap tebal dan api kecil di bilik utiliti.')[0];
  assert.equal(prediction.category, 'Kebakaran');
  assert.equal(prediction.scoreType, 'uncalibrated_relative_score');
});

test('count validation rejects incompatible, corrupted and all-unknown inference inputs safely', () => {
  assert.throws(() => validateModel({ ...model, formatVersion: 999 }));
  const bad = structuredClone(model);
  Object.values(bad.categories)[0].tokenCount += 1;
  assert.throws(() => validateModel(bad));
  assert.deepEqual(predict(model, 'qxzv zzzqv qqqz'), []);
  assert.deepEqual(predict(model, ''), []);
});

test('trained counts change classification without fabricating compatibility weights', () => {
  const samples = [
    { text: 'bara panas memancar tinggi', category: 'Kebakaran' },
    { text: 'bara panas memancar merah', category: 'Kebakaran' },
    { text: 'rondaan lengkap kawasan selamat', category: 'Rondaan Biasa' },
    { text: 'rondaan lengkap syif selesai', category: 'Rondaan Biasa' },
  ];
  const trained = trainModel(samples);
  assert.equal(predict(trained, 'bara panas memancar')[0].category, 'Kebakaran');
  const result = analyzeText({ text: 'bara panas memancar', categories, model: trained });
  assert.equal(result.topCategory, 'Kebakaran');
  assert.equal(result.model.decisionSource, 'trained_model');
  assert.equal(result.model.calibrated, false);
  assert.equal(result.model.trainedInferenceRan, true);
  assert.equal(result.riskLevel, 'Unknown');
  assert.equal(result.eventStatus, 'unclear');
  assert.ok(result.sourceChecks.findings.some(item => item.code === 'unclear_event'));
});

test('training coefficients and model version are reproducible across input order', () => {
  const samples = [{text:'Api dan asap tebal',category:'Kebakaran'},{text:'Rondaan selesai selamat',category:'Rondaan Biasa'}];
  const left = trainModel(samples);
  const right = trainModel([...samples].reverse());
  assert.deepEqual(left, right);
});

test('prototype-like words and custom category names remain ordinary text', () => {
  const trained = trainModel([{text:'constructor api panas',category:'Kebakaran'},{text:'rondaan selamat tenang',category:'Rondaan Biasa'}]);
  assert.ok(predict(trained,'constructor api').every(item => Number.isFinite(item.confidence)));
  const result = analyzeText({text:'constructor disebut',categories:[{name:'constructor',priority:'constructor',keywords:['constructor']}]});
  assert.equal(result.topCategory,'constructor');
  assert.ok(Number.isFinite(result.riskScore));
});

test('generated event variants remain together in a deterministic train/test split', () => {
  const samples = Array.from({ length: 12 }, (_, index) => ({ text: `Contoh ${index}`, category: 'DEMO', group: `family-${Math.floor(index / 2)}` }));
  const {train,test:holdout} = splitSamples(samples);
  assert.ok(train.length && holdout.length);
  const trainGroups = new Set(train.map(item => item.group));
  assert.ok(holdout.every(item => !trainGroups.has(item.group)));
  assert.deepEqual(splitSamples(samples), {train,test:holdout});
  assert.equal(model.metrics.operationalAccuracy, null);
  assert.ok(model.trainingSet.testGroups.every(group => !model.trainingSet.trainGroups.includes(group)));
});

test('negated fire is not presented as an asserted Critical incident', () => {
  const result = run('Tiada kebakaran dikesan semasa rondaan.');
  assert.equal(result.eventStatus, 'negated');
  assert.equal(result.riskLevel, 'Unknown');
  assert.equal(result.baseline.riskLevel, 'Critical');
  assert.equal(result.sourceChecks.method, 'deterministic_source_checks');
  assert.equal(result.sourceChecks.status, 'needs_review');
});

test('negation does not cancel a separate affirmative incident or a real event after a drill', () => {
  const mixed = run('Tiada kebakaran tetapi pencerobohan berlaku di Pintu Masuk Utama.');
  assert.equal(mixed.eventStatus, 'reported');
  assert.equal(mixed.topCategory, 'Pencerobohan');
  assert.equal(mixed.riskLevel, 'High');
  const actual = run('Latihan kebakaran selesai; tetapi asap sebenar dikesan di Sayap Kiri.');
  assert.equal(actual.eventStatus, 'reported');
  assert.equal(actual.riskLevel, 'Critical');
});

test('explicit drills and suspected events retain their distinct context', () => {
  const drill = run('Simulasi pencerobohan di Pintu Masuk Utama.');
  assert.equal(drill.eventStatus, 'drill');
  assert.equal(drill.riskLevel, 'Unknown');
  const suspected = run('Pencerobohan disyaki di Pintu Masuk Utama.');
  assert.equal(suspected.eventStatus, 'suspected');
  assert.equal(suspected.riskLevel, 'High');
});

test('fault wording such as tidak berfungsi and tidak berkunci is affirmative condition evidence', () => {
  const fault = run('CCTV tidak berfungsi semasa pemeriksaan.');
  assert.equal(fault.eventStatus, 'reported');
  assert.equal(fault.topCategory, 'Kerosakan Kemudahan');
  const unlocked = run('Pintu tidak berkunci semasa pemeriksaan.');
  assert.equal(unlocked.eventStatus, 'reported');
  assert.equal(unlocked.topCategory, 'Keselamatan Fizikal');
});

test('direct negative predicates and negative indefinites deny an event without denying a counterclause', () => {
  const theft = { name:'Kehilangan Aset',priority:'High',keywords:['hilang','dicuri','stolen'] };
  const cases = ['Kad akses tersebut tidak hilang.','Nothing has been stolen from the office.','Komputer itu tidak dicuri semalam.'];
  for(const text of cases){
    const result=analyzeText({text,categories:[...categories,theft],locations,model});
    assert.equal(result.eventStatus,'negated',text);
    assert.equal(result.riskLevel,'Unknown',text);
  }
  const mixed=run('Kamera tidak berfungsi dan asap dikesan di Sayap Kiri.');
  assert.equal(mixed.eventStatus,'reported');
  assert.equal(mixed.riskLevel,'Critical');
  const denied=run('Kebakaran itu tidak berlaku tetapi pencerobohan berlaku.');
  assert.equal(denied.topCategory,'Pencerobohan');
  assert.equal(denied.eventStatus,'reported');
});

test('postposed uncertainty and verbal suspicion remain suspected rather than confirmed or safe', () => {
  for(const text of ['Asap kelihatan di koridor namun puncanya belum dipastikan.','Pengawal mengesyaki pencerobohan di Sayap Kiri.','Smoke was observed but a fire was not yet confirmed.']){
    const result=run(text);
    // A separate affirmative clause still remains reported; uncertainty applies
    // to its own incident clause, not indiscriminately to the whole narrative.
    assert.ok(['reported','suspected'].includes(result.eventStatus),text);
    if(!/namun|but/iu.test(text))assert.equal(result.eventStatus,'suspected');
  }
  const uncertain=run('Asap di koridor itu belum dapat dipastikan.');
  assert.equal(uncertain.eventStatus,'suspected');
  assert.equal(uncertain.riskLevel,'Critical');
  assert.ok(uncertain.sourceChecks.findings.some(item=>item.code==='suspected_event'));
  const unknown=run('Pengawal mengesyaki sesuatu tetapi keterangannya belum dipastikan.');
  assert.equal(unknown.eventStatus,'suspected');
  assert.ok(unknown.evidence.some(item=>item.text==='mengesyaki'));
});

test('double negatives stay unclear while explicit affirmative counterclauses survive', () => {
  for(const text of ['Bukan tiada kebakaran di sini.','Bukan tidak berlaku pencerobohan.','It is not true that no fire was observed.']){
    const result=run(text);
    assert.equal(result.eventStatus,'unclear',text);
    assert.equal(result.riskLevel,'Unknown',text);
  }
  const result=run('Bukan tidak berlaku kebakaran tetapi pencerobohan sebenar berlaku.');
  assert.equal(result.eventStatus,'reported');
  assert.equal(result.topCategory,'Pencerobohan');
  assert.ok(result.sourceChecks.findings.some(item=>item.code==='mixed_context'));
});

test('DEMO category aliases preserve active names while using compatible trained labels', () => {
  const result = analyzeText({text:'Pencerobohan berlaku di Pintu Masuk Utama.',categories:[{name:'DEMO Pencerobohan',priority:'High',keywords:['pencerobohan']}],locations,model});
  assert.equal(result.topCategory, 'DEMO Pencerobohan');
  assert.equal(result.riskLevel, 'High');
});

test('time extraction validates calendar-independent numerals and preserves exact spans', () => {
  const text = 'Pada 11.45 malam, pintu diperiksa. Pukul 12 malam ketua dimaklumkan. Tingkat 3; 25:99 tidak sah.';
  const values = extractTimes(text);
  assert.deepEqual(values.map(item => item.value), ['23:45','00:00']);
  for (const value of values) assert.equal(text.slice(value.start, value.end), value.text);
});

test('only approved known locations are suggested and ambiguous aliases remain explicit', () => {
  const text = 'Pintu Masuk Utama diperiksa. Bilik Rahsia tidak disenaraikan.';
  const result = extractLocations(text, [...locations,{id_lokasi:99,hotspot_id:'SECRET_ROOM',nama_paparan:'Bilik Rahsia'}]);
  assert.equal(result.length, 1);
  assert.equal(result[0].hotspot_id, 'HOTSPOT_MAIN_ENTRANCE');
  assert.equal(result[0].id_pos, 8);
  const ambiguous = extractLocations('Ruang A diperiksa.', locations.map(location => ({...location,aliases:['Ruang A']})));
  assert.equal(ambiguous.length, 2);
  assert.ok(ambiguous.every(item => item.ambiguous));
});

test('extracted actions and evidence preserve source wording including explicit negative actions', () => {
  const text = 'Pada 23:15, asap dikesan di Sayap Kiri. Ketua belum dimaklumkan.';
  const result = run(text);
  assert.equal(result.extraction.actions[0].text, 'Ketua belum dimaklumkan');
  assert.equal(result.extraction.actions[0].status, 'negated');
  assert.equal(result.extraction.locations[0].hotspot_id, 'HOTSPOT_LEFT_WING');
  for (const item of [...result.evidence,...Object.values(result.extraction).flat()]) assert.equal(text.slice(item.start,item.end),item.text);
  assert.ok(text.includes(result.summary));
});

test('unknown text, missing facts and invalid model produce honest review states', () => {
  const result = analyzeText({text:'qxzz qvkk',categories,locations,model:{weights:{}}});
  assert.equal(result.topCategory, 'Unknown');
  assert.equal(result.riskLevel, 'Unknown');
  assert.equal(result.confidence, 0);
  assert.equal(result.model.trainedInferenceRan, false);
  assert.ok(result.sourceChecks.findings.some(item => item.code === 'model_unavailable'));
  assert.ok(result.quality.questions.length);
  assert.deepEqual(result.extraction.times, []);
  assert.deepEqual(result.extraction.locations, []);
});
