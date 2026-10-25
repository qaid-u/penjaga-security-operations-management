const { cleanText, predict } = require('./textModel');

const policyVersion = 'context-evidence-v2';
const { buildingCatalogue, legacyHotspots } = require('../services/securityPostCatalogue');
const approvedHotspots = new Set([...legacyHotspots, ...buildingCatalogue.buildings.flatMap(building => building.posts.map(post => post.id))]);
const priorityScore = { Low: 10, Medium: 35, High: 65, Critical: 85 };
const scoreFor = priority => Object.hasOwn(priorityScore, priority) ? priorityScore[priority] : 10;
const canonicalName = name => cleanText(String(name || '').replace(/^DEMO\s+/iu, ''));
const escape = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const patterns = {
  'rondaan biasa': ['rondaan', 'keadaan terkawal', 'semua pintu berkunci', 'routine patrol', 'all clear', 'patrol completed'],
  pencerobohan: ['pencerobohan', 'ceroboh', 'masuk tanpa izin', 'masuk tanpa pas', 'masuk tanpa kebenaran', 'tanpa pas keselamatan', 'gagal menunjukkan pas', 'unauthorised entry', 'unauthorized entry', 'intrusion', 'trespass', 'without an access pass', 'without permission'],
  kebakaran: ['kebakaran', 'api', 'asap', 'bau hangit', 'bau terbakar', 'fire', 'flames', 'smoke', 'burning smell'],
  pergaduhan: ['pergaduhan', 'kekecohan', 'pertengkaran', 'agresif', 'saling menolak', 'fight', 'fighting', 'brawl', 'assault'],
  'kehilangan aset': ['hilang', 'dicuri', 'kecurian', 'stolen', 'missing asset', 'theft', 'lost access card'],
  vandalisme: ['vandalisme', 'diconteng', 'dirosakkan', 'vandalism', 'graffiti', 'vandalised', 'vandalized'],
  'keselamatan fizikal': ['tidak berkunci', 'pintu terbuka', 'pagar terbuka', 'laluan kecemasan terhalang', 'unlocked', 'door left open', 'blocked emergency exit'],
  'kerosakan kemudahan': ['rosak', 'tidak berfungsi', 'tidak beroperasi', 'tersekat', 'broken', 'not working', 'out of order', 'malfunction'],
};
const suspectedPattern = /\b(?:disyaki|mengesyaki|syak|dipercayai|mungkin|kemungkinan|mencurigakan|suspect|suspects|suspected|suspecting|possibly|possible|suspicious)\b|\b(?:belum|tidak)\s+(?:(?:dapat|boleh)\s+)?(?:dipastikan|disahkan)\b|\bnot\s+(?:yet\s+)?(?:confirmed|verified|certain)\b/iu;

function span(text, start, end, extra = {}) { return { text: text.slice(start, end), start, end, ...extra }; }
function matches(text, pattern, extra = {}) {
  const regex = typeof pattern === 'string' ? new RegExp(`(?<![\\p{L}\\p{N}])${pattern.split(/\s+/u).map(escape).join('\\s+')}(?![\\p{L}\\p{N}])`, 'giu') : new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  return [...text.matchAll(regex)].filter(match => match[0].length).map(match => span(text, match.index, match.index + match[0].length, extra));
}
function uniqueSpans(items) {
  return items.filter((item, index) => items.findIndex(other => other.start === item.start && other.end === item.end && other.category === item.category) === index).sort((a, b) => a.start - b.start || b.end - a.end);
}
function clauses(text) {
  const result = [];
  let start = 0;
  const separators = /[;\n]+|[.!?](?=\s|$)|\b(?:tetapi|namun|but|however)\b/giu;
  for (const match of text.matchAll(separators)) {
    if (match.index > start) result.push({ start, end: match.index, text: text.slice(start, match.index) });
    start = match.index + match[0].length;
  }
  if (start < text.length) result.push({ start, end: text.length, text: text.slice(start) });
  return result;
}
function contextOf(text, item, parts) {
  const clause = parts.find(part => item.start >= part.start && item.start < part.end) || { start: 0, end: text.length, text };
  const before = text.slice(Math.max(clause.start, item.start - 65), item.start);
  const after = text.slice(item.end, Math.min(clause.end, item.end + 65));
  // Negation belongs to a predicate in this clause. Do not let a previous fault
  // ("tidak berfungsi") negate another incident joined later in the sentence.
  const negationBefore = /\b(?:tiada|tidak ada|tak ada|tanpa sebarang|tidak berlaku|tidak dikesan|tidak ditemui|bukan|no evidence of|no sign of|nothing|none|neither|no)\b[^,;.!?]{0,55}$/iu.test(before)
    || /\b(?:tidak|tak|belum|not|never)\s+(?:(?:langsung|pernah|lagi|juga|sebenarnya|akan|really|actually|ever|yet|see|seen|observe|observed|detect|detected|find|found|any)\s+){0,3}$/iu.test(before);
  const negationAfter = /^\s*(?:(?:itu|tersebut|ini|was|were|is|are|telah|sudah|langsung|sebenarnya)\s+){0,3}(?:tidak|tak|not)\s+(?:berlaku|dikesan|ditemui|dilihat|dilaporkan|observed|detected|seen|found|reported|present)\b/iu.test(after);
  // Two negatives do not safely establish either occurrence or absence.
  const doubleNegative = /\b(?:bukan|tidak|tak|not)\s+(?:[\p{L}]+\s+){0,4}(?:tiada|tidak|tak|bukan|no|not)\b/iu.test(`${before}${item.text}${after}`);
  const actual = /\b(?:sebenar|actual|real)\b/iu.test(clause.text);
  const drill = /\b(?:simulasi|latihan|drill|simulation|exercise)\b/iu.test(clause.text) || (!actual && /^\s*(?:simulasi|latihan|drill|simulation|exercise)\b/iu.test(text));
  const hypothetical = /\b(?:jika|sekiranya|seandainya|andaian|hypothetical|if|would)\b/iu.test(clause.text);
  const suspected = suspectedPattern.test(clause.text);
  return { ...item, status: doubleNegative ? 'unclear' : negationBefore || negationAfter ? 'negated' : drill && !actual ? 'drill' : hypothetical ? 'unclear' : suspected ? 'suspected' : 'reported' };
}

function keywordBaseline(text, categories) {
  const clean = cleanText(text);
  const rows = categories.map(category => {
    const words = [...new Set((category.keywords || []).map(word => cleanText(word)).filter(Boolean))].filter(word => clean.includes(word));
    return { category: category.name, words, score: words.length ? scoreFor(category.priority) + words.length * 10 : 0, confidence: words.length / Math.max(1, (category.keywords || []).length) };
  });
  rows.sort((a, b) => b.score - a.score);
  const top = rows[0]?.score ? rows[0] : { category: categories.find(category => canonicalName(category.name) === 'rondaan biasa')?.name || 'Rondaan Biasa', words: [], score: 0, confidence: 0 };
  const riskScore = Math.min(100, top.score);
  return { topCategory: top.category, riskScore, riskLevel: level(riskScore), matchedKeywords: top.words, confidence: Math.min(1, top.confidence), scoreType: 'keyword_coverage' };
}
function level(score) { return score > 80 ? 'Critical' : score > 60 ? 'High' : score > 30 ? 'Medium' : 'Low'; }

function extractTimes(text) {
  const results = [];
  // Numeral time expressions are normalized only when an explicit valid time is present.
  const timePattern = /\b(?:(?:pukul|jam|at)\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(pagi|petang|malam|tengah\s+hari|tengah\s+malam|a\.?m\.?|p\.?m\.?)?\b/giu;
  for (const match of text.matchAll(timePattern)) {
    const marker = (match[3] || '').toLowerCase().replaceAll('.', '');
    if (!match[2] && !marker && !/^(?:pukul|jam|at)\s/iu.test(match[0])) continue;
    let hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    if (minute > 59 || hour > 23 || (marker && hour > 12) || (marker && hour < 1)) continue;
    if (/^(?:petang|pm|malam)$/u.test(marker) && hour < 12) hour += 12;
    if (marker === 'malam' && hour === 12) hour = 0;
    if ((marker === 'am' || marker === 'pagi' || marker === 'tengah malam') && hour === 12) hour = 0;
    if (marker === 'tengah hari' && hour !== 12) continue;
    const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    results.push(span(text, match.index, match.index + match[0].length, { kind: 'time', value, normalized: value, normalizedTime: value }));
  }
  return uniqueSpans(results);
}
function extractLocations(text, locations) {
  const result = [];
  for (const location of locations) {
    if (!approvedHotspots.has(location?.hotspot_id) || !Number.isSafeInteger(Number(location.id_lokasi)) || Number(location.id_lokasi) < 1) continue;
    const names = [location.nama_paparan, ...(Array.isArray(location.aliases) ? location.aliases : [])].filter(name => typeof name === 'string' && name.trim().length >= 3);
    for (const name of names) result.push(...matches(text, name.trim(), { kind: 'location', id_lokasi: Number(location.id_lokasi), hotspot_id: location.hotspot_id, name: location.nama_paparan, id_pos: location.id_pos ?? null }));
  }
  return result.filter((item, index) => result.findIndex(other => other.start === item.start && other.end === item.end && other.hotspot_id === item.hotspot_id) === index).map(item => ({ ...item, ambiguous: result.some(other => other.start === item.start && other.end === item.end && other.hotspot_id !== item.hotspot_id) }));
}
function extractActions(text) {
  const pattern = /\b(?:ketua\s+(?:(?:telah|sudah|tidak|belum)\s+)?dimaklumkan|bomba\s+dimaklumkan|polis\s+dimaklumkan|unit\s+fasiliti\s+dimaklumkan|(?:pintu|pagar)\s+(?:(?:telah|sudah)\s+)?dikunci(?:\s+semula)?|gambar\s+bukti\s+diambil|rakaman\s+cctv\s+disemak|kawasan\s+dikawal|kawasan\s+dikosongkan|individu\s+ditahan|akses\s+ditolak|supervisor\s+(?:was\s+)?(?:not\s+)?(?:informed|notified)|police\s+(?:were\s+)?notified|door\s+(?:was\s+)?locked|area\s+(?:was\s+)?secured)\b/giu;
  return matches(text, pattern, { kind: 'action' }).map(item => {
    const context = contextOf(text, item, clauses(text));
    return { ...item, status: /\b(?:tidak|belum|not)\b/iu.test(item.text) ? 'negated' : context.status };
  });
}
function extractAssets(text) {
  return uniqueSpans(matches(text, /\b(?:pintu(?:\s+(?:utama|belakang|pejabat|stor|automatik))?|pagar|kamera\s+cctv|cctv|lampu|lif|interkom|kad\s+akses|komputer\s+riba|radio\s+komunikasi|dokumen|door|gate|camera|access\s+card|laptop|elevator)\b/giu, { kind: 'asset' }));
}

function analyzeText({ text = '', categories = [], locations = [], model = null } = {}) {
  text = String(text);
  categories = categories.filter(category => category && typeof category.name === 'string' && category.name.trim()).map(category => ({ ...category, keywords: Array.isArray(category.keywords) ? category.keywords.filter(word => typeof word === 'string') : [] }));
  const clean = cleanText(text);
  const baseline = keywordBaseline(text, categories);
  const parts = clauses(text);
  const events = uniqueSpans(categories.flatMap(category => [...new Set([...(category.keywords || []), ...(Object.hasOwn(patterns, canonicalName(category.name)) ? patterns[canonicalName(category.name)] : [])])].filter(Boolean).flatMap(keyword => matches(text, keyword, { kind: 'incident', category: category.name, keyword })))).map(item => contextOf(text, item, parts));
  const incidentEvents = events.filter(item => canonicalName(item.category) !== 'rondaan biasa');
  const affirmative = incidentEvents.filter(item => item.status === 'reported' || item.status === 'suspected');
  const candidates = categories.map(category => {
    const evidence = affirmative.filter(item => item.category === category.name);
    const uniqueWords = [...new Set(evidence.map(item => cleanText(item.text)))];
    return { ...category, evidence, uniqueWords, score: uniqueWords.length ? scoreFor(category.priority) + uniqueWords.length * 10 : 0 };
  }).filter(category => category.score).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  let predictions = [], modelError = false;
  if (model) {
    try { predictions = predict(model, text); } catch { modelError = true; }
  }
  const alternatives = predictions.map(prediction => ({ ...prediction, category: categories.find(category => canonicalName(category.name) === canonicalName(prediction.category))?.name })).filter(prediction => prediction.category).slice(0, 3).map(({ category, confidence: score }) => ({ category, score, scoreType: 'uncalibrated_relative_score' }));
  const trainedTop = predictions[0];
  const mappedTrained = trainedTop && categories.find(category => canonicalName(category.name) === canonicalName(trainedTop.category));
  const strong = Boolean(mappedTrained && trainedTop.confidence >= 0.55 && trainedTop.confidence - (predictions[1]?.confidence || 0) >= 0.12 && trainedTop.knownTokens >= 2 && trainedTop.tokenCoverage >= 0.15);
  let selected = candidates[0] || null;
  let decisionSource = selected ? 'context_keyword' : 'unknown';
  if (strong && (!selected || (candidates.length === 1 && selected.name === mappedTrained.name)) && (!incidentEvents.length || affirmative.some(item => item.category === mappedTrained.name))) {
    selected = candidates.find(category => category.name === mappedTrained.name) || { ...mappedTrained, score: scoreFor(mappedTrained.priority), evidence: [], uniqueWords: [] };
    decisionSource = 'trained_model';
  }
  const routine = categories.find(category => canonicalName(category.name) === 'rondaan biasa');
  const statuses = new Set(incidentEvents.map(item => item.status));
  let eventStatus = affirmative.some(item => item.status === 'reported') ? 'reported' : affirmative.length ? 'suspected' : statuses.has('drill') ? 'drill' : statuses.has('unclear') ? 'unclear' : statuses.has('negated') ? 'negated' : 'unclear';
  const uncertaintyEvidence = matches(text, suspectedPattern, { kind: 'context' });
  if (!incidentEvents.length && events.some(item => canonicalName(item.category) === 'rondaan biasa' && item.status === 'reported')) eventStatus = 'reported';
  else if (!incidentEvents.length && uncertaintyEvidence.length) eventStatus = 'suspected';
  if (!selected && routine && events.some(item => item.category === routine.name && item.status === 'reported')) {
    selected = { ...routine, score: 10, evidence: events.filter(item => item.category === routine.name), uniqueWords: [] }; decisionSource = 'context_keyword';
  }
  const topCategory = selected?.name || (eventStatus === 'negated' && routine ? routine.name : 'Unknown');
  let riskScore = selected ? Math.min(100, Math.max(0, selected.score)) : 0;
  let riskLevel = selected ? level(riskScore) : 'Unknown';
  if (['negated', 'drill', 'unclear'].includes(eventStatus) && !affirmative.length) { riskScore = 0; riskLevel = 'Unknown'; }
  const extraction = { times: extractTimes(text), locations: extractLocations(text, locations), assets: extractAssets(text), actions: extractActions(text) };
  const findings = [];
  const add = (code, message, item) => findings.push({ code, message, ...(item ? { quote: item.text, start: item.start, end: item.end } : {}) });
  if (eventStatus === 'negated') add('negated_event', 'Sebutan insiden dinafikan dalam laporan; ia bukan pengesahan kejadian.', incidentEvents[0]);
  if (eventStatus === 'drill') add('drill_context', 'Laporan menyebut latihan atau simulasi. Sahkan konteks sebelum menetapkan keutamaan.', incidentEvents.find(item => item.status === 'drill'));
  if (eventStatus === 'suspected') add('suspected_event', 'Kejadian dinyatakan sebagai disyaki atau belum pasti.', uncertaintyEvidence[0] || affirmative[0]);
  if (eventStatus === 'unclear') add('unclear_event', 'Konteks kejadian belum dapat dipastikan daripada teks.');
  if (affirmative.length && incidentEvents.some(item => !['reported','suspected'].includes(item.status))) add('mixed_context', 'Laporan mempunyai sebutan kejadian dalam konteks berbeza. Semak petikan sebelum membuat keputusan.', incidentEvents.find(item => !['reported','suspected'].includes(item.status)));
  if (new Set(affirmative.map(item => item.category)).size > 1) add('multiple_incidents', 'Lebih daripada satu jenis kejadian disebut; kategori utama perlu disemak.');
  if (baseline.riskLevel !== riskLevel || baseline.topCategory !== topCategory) add('baseline_disagreement', 'Analisis konteks berbeza daripada padanan kata kunci asal.');
  if (extraction.locations.some(item => item.ambiguous)) add('ambiguous_location', 'Nama lokasi boleh merujuk kepada lebih daripada satu zon yang dibenarkan.', extraction.locations.find(item => item.ambiguous));
  if (modelError) add('model_unavailable', 'Model tersimpan tidak serasi; semakan sumber berasaskan peraturan digunakan.');
  if (!selected) add('unsupported_category', 'Tiada kategori aktif yang disokong dengan cukup jelas.');
  const missing = [], questions = [];
  if (!extraction.times.length) { missing.push('time'); questions.push('Pukul berapa pemeriksaan atau kejadian dilaporkan?'); }
  if (!extraction.locations.length) { missing.push('known_location'); questions.push('Adakah lokasi kejadian sepadan dengan zon yang tersedia?'); }
  if (!extraction.actions.length && affirmative.length) { missing.push('action'); questions.push('Apakah tindakan awal yang telah diambil?'); }
  const evidence = uniqueSpans([...events, ...extraction.times, ...extraction.locations, ...extraction.actions, ...uncertaintyEvidence]).map(({ start, end, kind }) => span(text, start, end, { kind }));
  const first = parts.map(part => part.text.trim()).find(Boolean) || text.trim();
  const titleSource = selected?.evidence[0] ? parts.find(part => selected.evidence[0].start >= part.start && selected.evidence[0].start < part.end)?.text.trim() || first : first;
  const title = titleSource.split(/\s+/u).slice(0, 12).join(' ').slice(0, 120);
  const summary = first.length > 320 ? `${first.slice(0, 317).trimEnd()}…` : first;
  const scoreType = decisionSource === 'trained_model' ? 'uncalibrated_relative_score' : decisionSource === 'context_keyword' ? 'keyword_coverage' : 'not_estimated';
  const configuredKeywords = new Set((selected?.keywords || []).map(keyword => cleanText(keyword)).filter(Boolean));
  const matchedConfigured = new Set((selected?.evidence || []).map(item => cleanText(item.text)).filter(keyword => configuredKeywords.has(keyword)));
  const confidence = decisionSource === 'trained_model' ? trainedTop.confidence : selected ? Math.min(1, matchedConfigured.size / Math.max(1, configuredKeywords.size)) : 0;
  return {
    schemaVersion: 1, cleanText: clean, topCategory, riskScore, riskLevel,
    matchedKeywords: [...new Set((selected?.evidence || []).map(item => cleanText(item.text)))], confidence,
    title, summary, eventStatus, evidence, extraction, quality: { missing, questions },
    sourceChecks: { status: findings.length ? 'needs_review' : 'consistent', method: 'deterministic_source_checks', findings },
    model: { type: decisionSource === 'trained_model' ? 'multinomial_naive_bayes' : 'context_rules', version: model?.version || policyVersion, policyVersion, scoreType, decisionSource, trainedInferenceRan: Boolean(model && !modelError), calibrated: false },
    alternatives, baseline,
  };
}

module.exports = { analyzeText, keywordBaseline, extractTimes, extractLocations, policyVersion };
