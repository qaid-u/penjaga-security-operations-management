const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { analyzeText } = require('../ml/reportAnalysis');
const { buildDialogue } = require('../ml/eventDialogue');
const { buildingCatalogue } = require('../services/securityPostCatalogue');

const categories = [
  { name: 'Rondaan Biasa', priority: 'Low', keywords: ['rondaan'] },
  { name: 'Kebakaran', priority: 'Critical', keywords: ['api', 'asap', 'kebakaran'] },
  { name: 'Pencerobohan', priority: 'High', keywords: ['pencerobohan', 'intrusion'] },
  { name: 'Kerosakan Kemudahan', priority: 'Medium', keywords: ['rosak', 'tidak berfungsi'] },
  { name: 'Keselamatan Fizikal', priority: 'Medium', keywords: ['tidak berkunci', 'pagar terbuka'] },
];
const locations = buildingCatalogue.buildings.flatMap((building, buildingIndex) => building.posts.map((post, index) => ({
  id_lokasi: 100 + buildingIndex * 10 + index, id_pos: 1000 + buildingIndex * 10 + index,
  hotspot_id: post.id, nama_paparan: post.name,
})));
const ref = hotspot => locations.find(location => location.hotspot_id === hotspot);
const ssLift = ref('POST_DJM_SS_LG_LIFT');
const mbLift = ref('POST_DJM_MB_LG_LIFT');
const lobby = ref('POST_DJM_MAIN_LOBBY');
const control = ref('POST_DJM_CCTV_CONTROL');
const analyze = (text, overrides = {}) => analyzeText({ text, categories, locations, ...overrides });
const dialogue = (text, clarifications = [], overrides = {}) => buildDialogue({ text, analysis: analyze(text, overrides), locations, clarifications, ...overrides });
const answer = (question, value) => ({ questionId: question.id, value });
function exactSpans(text, events) {
  for (const event of events) {
    for (const item of [event.source, ...event.evidence, ...event.times, ...event.locations, ...event.assets, ...event.actions, ...event.location.candidates.flatMap(candidate => candidate.evidence)]) {
      assert.equal(text.slice(item.start, item.end), item.text, `Invalid source span ${JSON.stringify(item)}`);
    }
  }
}

test('one category and clause form one event despite several keywords and a patrol mention', () => {
  const text = 'Rondaan mendapati asap dan api dikesan di LG pada jam 9 malam.';
  const result = analyze(text);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].category, 'Kebakaran');
  assert.equal(result.events[0].status, 'reported');
  assert.deepEqual(result.events[0].evidence.filter(item => item.kind === 'incident').map(item => item.text), ['asap', 'api']);
  assert.deepEqual(result.events[0].times.map(item => item.value), ['21:00']);
  exactSpans(text, result.events);
});

test('different event clauses retain opposite statuses and their own times and approved locations', () => {
  const text = 'Tiada kebakaran di Pos Lobi Utama pada 20:10 tetapi asap sebenar dikesan di Pos Bilik Kawalan CCTV pada 21:30. Ketua dimaklumkan.';
  const result = analyze(text);
  assert.equal(result.events.length, 2);
  const [absent, actual] = result.events;
  assert.deepEqual([absent.status, actual.status], ['negated', 'reported']);
  assert.deepEqual(absent.times.map(item => item.value), ['20:10']);
  assert.deepEqual(actual.times.map(item => item.value), ['21:30']);
  assert.equal(absent.location.confirmed.id_lokasi, lobby.id_lokasi);
  assert.equal(actual.location.confirmed.id_lokasi, control.id_lokasi);
  assert.equal(absent.actions.length, 0);
  assert.equal(actual.actions[0].text, 'Ketua dimaklumkan');
  assert.ok(absent.evidence.some(item => item.kind === 'context' && item.text.startsWith('Tiada')));
  exactSpans(text, result.events);
});

test('conjunctions with independent predicates bind assets and facts conservatively', () => {
  const text = 'Kamera CCTV tidak berfungsi pada 22:10 di Pos Bilik Kawalan CCTV dan pagar terbuka pada 22:45 di Pos Lobi Utama.';
  const result = analyze(text);
  assert.equal(result.events.length, 2);
  assert.deepEqual(result.events.map(event => event.status), ['reported', 'reported']);
  assert.deepEqual(result.events[0].times.map(item => item.value), ['22:10']);
  assert.deepEqual(result.events[1].times.map(item => item.value), ['22:45']);
  assert.deepEqual(result.events[0].assets.map(item => item.text), ['Kamera CCTV']);
  assert.deepEqual(result.events[1].assets.map(item => item.text), ['pagar']);
  exactSpans(text, result.events);
});

test('coordinated categories sharing one predicate retain the shared location and time', () => {
  const text = 'Asap dan pencerobohan dikesan di Pos Lobi Utama pada pukul 04:30.';
  const result = analyze(text);
  assert.equal(result.events.length, 2);
  for (const event of result.events) {
    assert.equal(event.status, 'reported');
    assert.equal(event.location.confirmed.id_lokasi, lobby.id_lokasi);
    assert.deepEqual(event.times.map(item => item.value), ['04:30']);
  }
  assert.deepEqual(result.events[0].source, result.events[1].source);
  exactSpans(text, result.events);
});

test('adjacent actions stay unbound after multiple events or denied events and action times do not become occurrence times', () => {
  const shared = analyze('Asap dan pencerobohan dikesan di Pos Lobi Utama. Ketua dimaklumkan.');
  assert.ok(shared.events.every(event => !event.actions.length));
  const denied = analyze('Tiada kebakaran. Ketua dimaklumkan pada 22:10.');
  assert.equal(denied.events[0].actions.length, 0);
  assert.equal(denied.events[0].times.length, 0);
  const text = 'Asap dikesan di Pos Lobi Utama. Ketua dimaklumkan pada 22:10.';
  const result = dialogue(text);
  assert.equal(result.events[0].actions[0].text, 'Ketua dimaklumkan');
  assert.equal(result.events[0].times[0].role, 'action');
  assert.equal(result.questions[0].field, 'time');
  exactSpans(text, result.events);
});

test('Malay and English negation, drills, suspicion and actual events remain separate', () => {
  const cases = [
    ['No fire was observed and suspected intrusion at Pos Lobi Utama.', ['negated', 'suspected']],
    ['Latihan kebakaran selesai; asap sebenar dikesan di Pos Lobi Utama.', ['drill', 'reported']],
    ['Tiada kebakaran dan pencerobohan berlaku di Pos Lobi Utama.', ['negated', 'reported']],
    ['Bukan tiada kebakaran di LG.', ['unclear']],
    ['Latihan kebakaran selesai; pencerobohan dikesan di Pos Lobi Utama.', ['drill', 'reported']],
    ['Drill fire and actual intrusion at Pos Lobi Utama.', ['drill', 'reported']],
    ['No fire, CCTV broken in LG.', ['negated', 'reported']],
    ['Not a real fire. Maybe intrusion at Pos Lobi Utama.', ['negated', 'suspected']],
    ['Tak pasti pencerobohan di LG.', ['suspected']],
    ['Jika kebakaran berlaku dan CCTV rosak di LG.', ['unclear', 'unclear']],
    ['Maybe intrusion occurred and CCTV broken in LG.', ['suspected', 'suspected']],
  ];
  for (const [text, statuses] of cases) {
    const result = analyze(text);
    assert.deepEqual(result.events.map(event => event.status), statuses, text);
    exactSpans(text, result.events);
  }
});

test('LG context yields exactly the two allowed DJM lift candidates and confirms neither', () => {
  const text = 'Lif rosak di LG.';
  const result = analyze(text);
  const event = result.events[0];
  assert.equal(event.location.state, 'ambiguous');
  assert.equal(event.location.confirmed, null);
  assert.deepEqual(event.location.candidates.map(candidate => candidate.id_lokasi), [ssLift.id_lokasi, mbLift.id_lokasi]);
  assert.ok(event.location.candidates.every(candidate => candidate.buildingId === 'DJM'));
  exactSpans(text, result.events);
  const question = dialogue(text).questions[0];
  assert.equal(question.field, 'location');
  assert.deepEqual(question.options.map(option => option.value), [String(ssLift.id_lokasi), String(mbLift.id_lokasi), 'unknown', 'skip']);
  const unrelatedSelected = dialogue(text, [], { selectedPostId: lobby.id_pos });
  assert.deepEqual(unrelatedSelected.questions[0].options.map(option => option.value), question.options.map(option => option.value));
});

test('Malay and English conjunctions do not let a denied intrusion suppress a separate equipment fault', () => {
  for (const text of ['Tiada pencerobohan dan CCTV rosak di LG.', 'No intrusion and CCTV broken in LG.']) {
    const result = analyze(text);
    assert.deepEqual(result.events.map(event => [event.category, event.status]), [['Pencerobohan', 'negated'], ['Kerosakan Kemudahan', 'reported']], text);
    assert.equal(result.events[0].assets.length, 0);
    assert.deepEqual(result.events[1].assets.map(item => item.text), ['CCTV']);
    exactSpans(text, result.events);
  }
});

test('aliases and selected report posts provide candidates without inventing occurrence locations', () => {
  const aliases = locations.map(location => ({ ...location, aliases: location.id_lokasi === lobby.id_lokasi ? ['Ruang Hadapan'] : [] }));
  const text = 'Asap dikesan di Ruang Hadapan.';
  const aliasResult = analyze(text, { locations: aliases });
  assert.equal(aliasResult.events[0].location.confirmed, null);
  assert.equal(aliasResult.events[0].location.candidates[0].source, 'alias');
  const selected = dialogue('Asap dikesan.', [], { selectedPostId: lobby.id_pos });
  assert.equal(selected.events[0].location.confirmed, null);
  assert.equal(selected.events[0].location.candidates[0].source, 'selected_context');
  assert.equal(selected.events[0].location.candidates[0].evidence.length, 0);
  assert.equal(selected.questions[0].field, 'location');
});

test('an explicit location conflicting with the selected post prompts a choice without erasing source evidence', () => {
  const text = 'Asap dikesan di Pos Lobi Utama pada 22:10.';
  const result = dialogue(text, [], { selectedPostId: control.id_pos });
  assert.equal(result.events[0].location.confirmed.id_lokasi, lobby.id_lokasi);
  assert.equal(result.events[0].location.conflict, true);
  assert.equal(result.questions[0].field, 'location');
  assert.deepEqual(result.questions[0].options.filter(option => !['unknown', 'skip'].includes(option.value)).map(option => option.value), [String(lobby.id_lokasi), String(control.id_lokasi)]);
  const resolved = dialogue(text, [answer(result.questions[0], String(control.id_lokasi))], { selectedPostId: control.id_pos });
  assert.equal(resolved.events[0].location.confirmed.id_lokasi, control.id_lokasi);
  assert.equal(resolved.events[0].location.confirmed.source, 'clarification');
  assert.equal(resolved.events[0].locations[0].id_lokasi, lobby.id_lokasi);
  exactSpans(text, resolved.events);
});

test('unknown names, unprovided references and selected nonexistent posts cannot establish a location', () => {
  const text = 'Asap dikesan di Bilik Rahsia.';
  const invalidLocation = { id_lokasi: 999, id_pos: 9999, hotspot_id: 'SECRET_ROOM', nama_paparan: 'Bilik Rahsia' };
  const result = dialogue(text, [], { locations: [ssLift, invalidLocation], selectedPostId: invalidLocation.id_pos });
  assert.equal(result.events[0].location.confirmed, null);
  assert.deepEqual(result.events[0].location.candidates, []);
  assert.deepEqual(result.questions[0].options.map(option => option.value), [String(ssLift.id_lokasi), 'unknown', 'skip']);
  const omitted = analyze('Asap di Pos Lobi Utama.', { locations: [ssLift] });
  assert.equal(omitted.events[0].location.confirmed, null);
  assert.deepEqual(omitted.events[0].locations, []);
});

test('draft and question identifiers are stable, event-bound and expose only one current question', () => {
  const text = 'Lif rosak di LG.';
  const result = dialogue(text, [], { selectedPostId: ssLift.id_pos });
  assert.equal(result.draftHash, createHash('sha256').update(`${text}\0${ssLift.id_pos}`).digest('hex'));
  assert.deepEqual(result, dialogue(text, [], { selectedPostId: ssLift.id_pos }));
  assert.equal(result.questions.length, 1);
  assert.equal(result.candidateQuestions.length, 3);
  assert.ok(result.candidateQuestions.every(question => question.eventId === result.events[0].id));
  assert.equal(new Set(result.candidateQuestions.map(question => question.id)).size, result.candidateQuestions.length);
});

test('stale drafts, selected-post edits, source hashes and forged questions reject answer history', () => {
  const text = 'Lif rosak di LG.';
  const first = dialogue(text);
  const clarification = answer(first.questions[0], String(ssLift.id_lokasi));
  assert.equal(dialogue(`${text} Pemeriksaan lanjut.`, [clarification]).errors[0].code, 'unknown_question');
  assert.equal(dialogue(text, [clarification], { selectedPostId: ssLift.id_pos }).errors[0].code, 'unknown_question');
  assert.equal(dialogue(text, [{ ...clarification, sourceHash: 'wrong' }]).errors[0].code, 'stale_draft');
  assert.equal(dialogue(text, [{ questionId: 'q-invented', value: 'reported' }]).errors[0].code, 'unknown_question');
});

test('location answers must be exact offered reference IDs even when another allowed post exists', () => {
  const text = 'Lif rosak di LG.';
  const initial = dialogue(text);
  for (const value of [String(lobby.id_lokasi), '99999', `${ssLift.id_lokasi} `, ssLift.hotspot_id]) {
    const result = dialogue(text, [answer(initial.questions[0], value)]);
    assert.equal(result.errors[0].code, 'invalid_value', value);
    assert.equal(result.events[0].location.confirmed, null);
  }
});

test('unknown and skip remain recorded, suppress repeat questions and advance to useful missing facts', () => {
  const text = 'Lif rosak di LG.';
  const initial = dialogue(text);
  const history = [answer(initial.questions[0], 'unknown')];
  const second = dialogue(text, history);
  assert.equal(second.answers[0].status, 'unknown');
  assert.equal(second.events[0].location.confirmed, null);
  assert.equal(second.questions[0].field, 'time');
  assert.ok(second.candidateQuestions.some(question => question.id === initial.questions[0].id));
  history.push(answer(second.questions[0], 'skip'));
  const third = dialogue(text, history);
  assert.equal(third.questions[0].field, 'action');
  history.push(answer(third.questions[0], 'skip'));
  const complete = dialogue(text, history);
  assert.equal(complete.complete, true);
  assert.deepEqual(complete.questions, []);
  assert.deepEqual(complete.answers.map(item => item.status), ['unknown', 'skipped', 'skipped']);
});

test('multi-turn clarifications resolve only their event and keep user additions outside source spans', () => {
  const text = 'Pencerobohan disyaki di Pos Lobi Utama. Lif rosak di LG pada 23:45.';
  const analysis = analyze(text);
  const original = structuredClone(analysis);
  let result = buildDialogue({ text, analysis, locations });
  const eventId = result.questions[0].eventId;
  const history = [answer(result.questions[0], 'reported')];
  result = buildDialogue({ text, analysis, locations, clarifications: history });
  assert.equal(result.events.find(event => event.id === eventId).status, 'reported');
  assert.equal(result.events.find(event => event.id === eventId).originalStatus, 'suspected');
  assert.equal(result.events.find(event => event.id !== eventId).status, 'reported');
  assert.equal(result.questions[0].field, 'location');
  history.push(answer(result.questions[0], String(mbLift.id_lokasi)));
  result = buildDialogue({ text, analysis, locations, clarifications: history });
  assert.equal(result.questions[0].field, 'time');
  assert.equal(result.questions[0].eventId, eventId);
  history.push(answer(result.questions[0], 'Pukul 11 malam'));
  result = buildDialogue({ text, analysis, locations, clarifications: history });
  assert.equal(result.questions[0].field, 'action');
  history.push(answer(result.questions[0], 'Pengawal menghubungi penyelia.'));
  result = buildDialogue({ text, analysis, locations, clarifications: history });
  const clarified = result.events.find(event => event.id === eventId);
  assert.equal(clarified.clarifiedTime.normalizedTime, '23:00');
  assert.equal(clarified.clarifiedAction.value, 'Pengawal menghubungi penyelia.');
  assert.deepEqual(clarified.times, []);
  assert.deepEqual(clarified.actions, []);
  assert.equal(clarified.statusSource, 'clarification');
  assert.deepEqual(analysis, original);
  exactSpans(text, result.events);
});

test('free text is bounded and status choices stay closed; duplicate answers are rejected', () => {
  const text = 'Pencerobohan disyaki di Pos Lobi Utama.';
  const initial = dialogue(text);
  assert.equal(dialogue(text, [answer(initial.questions[0], 'certainly happened')]).errors[0].code, 'invalid_value');
  const history = [answer(initial.questions[0], 'unknown')];
  const time = dialogue(text, history).questions[0];
  assert.equal(time.field, 'time');
  for (const value of ['', ' '.repeat(5), 'x'.repeat(121), '22:10\u0000']) assert.equal(dialogue(text, [...history, answer(time, value)]).errors[0].code, 'invalid_value');
  const duplicate = answer(initial.questions[0], 'unknown');
  assert.equal(dialogue(text, [duplicate, duplicate]).errors[0].code, 'duplicate_answer');
});

test('history cannot skip ahead or answer candidates that were never offered for a denied or drill event', () => {
  const text = 'Pencerobohan disyaki di LG.';
  const initial = dialogue(text);
  assert.equal(initial.questions[0].field, 'status');
  const location = initial.candidateQuestions.find(question => question.field === 'location');
  const time = initial.candidateQuestions.find(question => question.field === 'time');
  for (const question of [location, time]) {
    const result = dialogue(text, [answer(question, 'unknown')]);
    assert.equal(result.errors[0].code, 'unoffered_question');
    assert.deepEqual(result.answers, []);
    assert.equal(result.questions[0].id, initial.questions[0].id);
  }
  const deniedHistory = [answer(initial.questions[0], 'negated'), answer(location, String(ssLift.id_lokasi))];
  const deniedAfterReply = dialogue(text, deniedHistory);
  assert.equal(deniedAfterReply.errors[0].code, 'unoffered_question');
  assert.equal(deniedAfterReply.events[0].location.confirmed, null);
  assert.equal(deniedAfterReply.answers.length, 1);
  for (const narrative of ['Tiada kebakaran di LG.', 'Latihan kebakaran di LG.']) {
    const dormant = dialogue(narrative);
    assert.equal(dormant.questions.length, 0);
    assert.equal(dormant.complete, true);
    for (const question of dormant.candidateQuestions) {
      assert.equal(dialogue(narrative, [answer(question, 'unknown')]).errors[0].code, 'unoffered_question');
    }
  }
});

test('a location conflict is legitimately offered before status and cumulative replay preserves the same sequence', () => {
  const text = 'Pencerobohan disyaki di Pos Lobi Utama.';
  const overrides = { selectedPostId: control.id_pos };
  const initial = dialogue(text, [], overrides);
  const status = initial.candidateQuestions.find(question => question.field === 'status');
  assert.equal(initial.questions[0].field, 'location');
  assert.equal(dialogue(text, [answer(status, 'reported')], overrides).errors[0].code, 'unoffered_question');
  const history = [answer(initial.questions[0], String(lobby.id_lokasi))];
  const second = dialogue(text, history, overrides);
  assert.deepEqual(second.errors, []);
  assert.equal(second.questions[0].id, status.id);
  history.push(answer(second.questions[0], 'reported'));
  const third = dialogue(text, history, overrides);
  assert.deepEqual(third.errors, []);
  assert.equal(third.questions[0].field, 'time');
  assert.deepEqual(third, dialogue(text, history, overrides));
  history.push(answer(third.questions[0], 'unknown'));
  const fourth = dialogue(text, history, overrides);
  assert.equal(fourth.questions[0].field, 'action');
  history.push(answer(fourth.questions[0], 'skip'));
  const final = dialogue(text, history, overrides);
  assert.equal(final.complete, true);
  assert.deepEqual(final.errors, []);
  assert.deepEqual(final.answers.map(item => item.field), ['location', 'status', 'time', 'action']);
});

test('one hundred accepted replies stop further questions while disclosing unresolved work', () => {
  const text = Array.from({ length: 35 }, () => 'Lif rosak di LG.').join(' ');
  const analysis = analyze(text);
  const history = [];
  let result = buildDialogue({ text, analysis, locations });
  for (let index = 0; index < 100; index++) {
    assert.equal(result.questions.length, 1, `Expected reply ${index + 1} to remain available`);
    assert.equal(result.limitReached, false);
    history.push(answer(result.questions[0], index % 2 ? 'skip' : 'unknown'));
    result = buildDialogue({ text, analysis, locations, clarifications: history });
    assert.deepEqual(result.errors, []);
  }
  assert.equal(result.answers.length, 100);
  assert.equal(result.questions.length, 0);
  assert.equal(result.complete, false);
  assert.equal(result.limitReached, true);
  assert.equal(result.unresolved, 5);
  assert.deepEqual(result, buildDialogue({ text, analysis, locations, clarifications: history }));
});

test('explicitly negated and drill contexts do not crowd out questions for a separate real incident', () => {
  const text = 'Tiada kebakaran. Latihan pencerobohan selesai. Lif rosak di LG.';
  const result = dialogue(text);
  assert.equal(result.questions[0].eventId, result.events.find(event => event.category === 'Kerosakan Kemudahan').id);
  assert.equal(result.questions[0].field, 'location');
  const onlyDrill = dialogue('Latihan pencerobohan selesai.');
  assert.equal(onlyDrill.complete, true);
  assert.deepEqual(onlyDrill.questions, []);
});

test('very long incident lists bound event work and disclose the number omitted', () => {
  const text = Array.from({ length: 90 }, (_, index) => `Asap dikesan pada ${String(index % 24).padStart(2, '0')}:15 di LG.`).join(' ');
  const result = analyze(text);
  assert.equal(result.events.length, result.eventLimit);
  assert.equal(result.eventsTruncated, true);
  assert.equal(result.eventCount, 90);
  assert.ok(result.eventLimit <= 100);
  assert.ok(new Set(result.events.map(event => event.id)).size === result.events.length);
  exactSpans(text, result.events);
});
