import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { countMetrics, matchEvents, scoreEventOutput, validateFixture, validateProviderPredictions, buildProviderInput, parseAnnotationJSONL, validateAnnotations, splitAnnotations, evaluateEventDialogue } from './evaluate-event-dialogue.mjs';

const text = 'Api di LG; lampu rosak.';
const span = (value, source = text) => ({ text: value, start: source.indexOf(value), end: source.indexOf(value) + value.length });
const location = (state = 'unresolved', id = null) => ({ state, confirmed: id == null ? null : { id_lokasi: id } });
const goldEvent = (anchor = 'Api', category = 'Kebakaran') => ({ category, status: 'reported', anchor: span(anchor), location: location(), times: [], assets: [], actions: [] });
const predictedEvent = (value = 'Api', category = 'Kebakaran') => ({ category, status: 'reported', source: span(value), evidence: [span(value)], location: location(), times: [], assets: [], actions: [] });
const labels = ['Kebakaran', 'Kerosakan Kemudahan'];
const fixture = { categories: labels.map(name => ({ name })), locations: [{ id_lokasi: 1 }], cases: [{ id: 'X1', text, expectedReportCategory: 'Kebakaran', events: [goldEvent()] }] };

test('precision/recall/F1 use real counts and distinguish empty denominators from zero success', () => {
  const result = countMetrics(2, 1, 3);
  assert.equal(result.precision, 2 / 3);
  assert.equal(result.recall, .4);
  assert.equal(result.f1, .5);
  assert.equal(countMetrics(0, 0, 0).f1, null);
  assert.equal(countMetrics(0, 0, 3).recall, 0);
  assert.equal(countMetrics(0, 0, 3).precision, null);
  assert.throws(() => countMetrics(-1, 0, 0), /nonnegative/u);
});

test('event matching uses source anchors, never gold category or assertion to improve pairing', () => {
  const gold = [goldEvent(), goldEvent('rosak', 'Kerosakan Kemudahan')];
  const predicted = [predictedEvent('Api', 'Kerosakan Kemudahan'), predictedEvent('rosak', 'Kebakaran')];
  assert.deepEqual(matchEvents(text, gold, predicted), [{ goldIndex: 0, predictedIndex: 0 }, { goldIndex: 1, predictedIndex: 1 }]);
  const result = scoreEventOutput(text, gold, predicted, labels);
  assert.equal(result.detection.f1, 1);
  assert.equal(result.category.accuracy, 0);
  assert.equal(result.jointCategoryStatus.f1, 0);
});

test('omissions and duplicated predictions lower event and field scores', () => {
  const gold = [goldEvent(), { ...goldEvent('rosak', 'Kerosakan Kemudahan'), times: ['21:10'] }];
  const result = scoreEventOutput(text, gold, [predictedEvent(), predictedEvent()], labels);
  assert.deepEqual(result.detection, countMetrics(1, 1, 1));
  assert.deepEqual(result.jointCategoryStatus, countMetrics(1, 1, 1));
  assert.equal(result.category.accuracy, .5);
  assert.equal(result.extraction.time.falseNegative, 1);
  assert.equal(result.unsupportedClaims.unsupportedAffirmations, 1);
});

test('denied incidents and unresolved locations cannot silently become supported confirmations', () => {
  const predicted = { ...predictedEvent(), location: location('confirmed', 1) };
  const result = scoreEventOutput(text, [{ ...goldEvent(), status: 'negated' }], [predicted], labels);
  assert.equal(result.unsupportedClaims.unsupportedAffirmations, 1);
  assert.equal(result.location.unknownPreservationRate, 0);
  assert.equal(result.location.unsupportedLocationConfirmations, 1);
  assert.equal(result.status.accuracy, 0);
});

test('source audit catches invented extraction text and ungrounded offsets', () => {
  const result = scoreEventOutput(text, [goldEvent()], [{ ...predictedEvent(), actions: [{ text: 'Police called', start: 0, end: 12 }], assets: [{ text: 'laptop' }] }], labels);
  assert.equal(result.sourceGrounding.invalidSpans, 2);
  assert.equal(result.extraction.action.falsePositive, 1);
});

test('missing provider predictions are not-run without numeric zero accuracy', () => {
  const result = validateProviderPredictions(null, fixture, 'a'.repeat(64));
  assert.equal(result.status, 'not-run');
  assert.equal(Object.hasOwn(result, 'accuracy'), false);
  assert.equal(result.predictions.length, 0);
});

test('manual provider packet excludes gold labels and supplied clarification facts', () => {
  const input = buildProviderInput({ ...fixture, cases: [{ ...fixture.cases[0], syntheticReplies: [{ eventIndex: 0, field: 'action', value: 'SECRET_USER_FACT' }] }] }, 'a'.repeat(64));
  assert.equal(input.status, 'prepared-only');
  assert.match(input.promptSha256, /^[a-f0-9]{64}$/u);
  assert.equal(input.promptText.includes('expectedReportCategory'), false);
  assert.equal(input.promptText.includes('SECRET_USER_FACT'), false);
  assert.equal(input.promptText.includes('"anchor"'), false);
});

test('an action time cannot be credited as the occurrence time', () => {
  const result = scoreEventOutput(text, [{ ...goldEvent(), times: ['21:10'] }], [{ ...predictedEvent(), times: [{ value: '21:10', role: 'action' }] }], labels);
  assert.equal(result.extraction.time.truePositive, 0);
  assert.equal(result.extraction.time.falsePositive, 1);
  assert.equal(result.extraction.time.falseNegative, 1);
});

function providerPrediction() {
  return { provenance: { provider: 'Google Gemini', model: 'EXTERNAL_MODEL_ID', generatedAt: '2026-01-01T00:00:00Z', promptSha256: 'b'.repeat(64), fixtureSha256: 'a'.repeat(64), mode: 'gemini-only', humanEdited: false }, predictions: [{ id: 'X1', reportCategory: 'Kebakaran', events: [predictedEvent()] }] };
}

test('external import requires truthful provenance, unique IDs, grounded fields and approved identities', () => {
  assert.equal(validateProviderPredictions(providerPrediction(), fixture, 'a'.repeat(64)).status, 'run');
  const partialFixture = { ...fixture, cases: [...fixture.cases, { ...fixture.cases[0], id: 'X2' }] };
  assert.equal(validateProviderPredictions(providerPrediction(), partialFixture, 'a'.repeat(64)).status, 'partial');
  assert.throws(() => validateProviderPredictions({ predictions: [] }, fixture, 'a'.repeat(64)), /provenance/u);
  const mismatched = providerPrediction(); mismatched.provenance.fixtureSha256 = 'c'.repeat(64);
  assert.throws(() => validateProviderPredictions(mismatched, fixture, 'a'.repeat(64)), /matching fixture/u);
  const edited = providerPrediction(); edited.provenance.humanEdited = true;
  assert.throws(() => validateProviderPredictions(edited, fixture, 'a'.repeat(64)), /humanEdited/u);
  const duplicated = providerPrediction(); duplicated.predictions.push(duplicated.predictions[0]);
  assert.throws(() => validateProviderPredictions(duplicated, fixture, 'a'.repeat(64)), /duplicate/u);
  const invented = providerPrediction(); invented.predictions[0].events[0].times = [{ text: '21:10', start: 0, end: 5 }];
  assert.throws(() => validateProviderPredictions(invented, fixture, 'a'.repeat(64)), /offsets/u);
  const outside = providerPrediction(); outside.predictions[0].events[0].location = location('confirmed', 999);
  assert.throws(() => validateProviderPredictions(outside, fixture, 'a'.repeat(64)), /outside fixture/u);
});

test('malformed fixture anchors, duplicate report IDs and incorrect unknown labels fail early', () => {
  assert.equal(validateFixture(fixture), fixture);
  assert.throws(() => validateFixture({ ...fixture, cases: [fixture.cases[0], fixture.cases[0]] }), /duplicate/u);
  const wrongSpan = structuredClone(fixture); wrongSpan.cases[0].events[0].anchor.end++;
  assert.throws(() => validateFixture(wrongSpan), /annotation/u);
  const wrongLabel = structuredClone(fixture); wrongLabel.cases[0].expectedReportCategory = 'a guessed class';
  assert.throws(() => validateFixture(wrongLabel), /Invalid/u);
});

function annotation(reportId = 'R001', incidentGroup = 'INC_A', sourceGroup = 'SRC_A') {
  return { recordType: 'annotation', isTemplate: false, reportId, incidentGroup, sourceGroup, annotatorId: 'ANN_A', annotationVersion: 'v1', annotationState: 'adjudicated', deidentified: true, catalogueVersion: 'synthetic-v1', text: 'Rondaan bersama [PERSON_1].', reportCategory: 'Rondaan Biasa', events: [], clarificationNeeds: [], redactions: ['PERSON_1'], notes: '' };
}

test('annotation collector rejects template rows, malformed JSON and obvious direct identifiers', () => {
  assert.equal(validateAnnotations([annotation()]).length, 1);
  assert.throws(() => parseAnnotationJSONL('{bad json}\n'), /line 1/u);
  assert.throws(() => validateAnnotations([{ ...annotation(), isTemplate: true }]), /template/u);
  for (const unsafeText of ['Hubungi ali@example.com.', 'ID 010101-01-1234.', 'Telefon 012-3456789.', 'Nama: Ali', 'Rondaan [Ali].']) {
    assert.throws(() => validateAnnotations([{ ...annotation(), text: unsafeText }]), /identifier|placeholder/u);
  }
  assert.throws(() => validateAnnotations([{ ...annotation(), redactions: [] }]), /Redaction/u);
  assert.throws(() => validateAnnotations([{ ...annotation(), personalName: 'someone' }]), /Unexpected/u);
});

test('grouped split joins incident/source links transitively and never leaks connected reports', () => {
  const records = [annotation('R001', 'INC_A', 'SRC_A'), annotation('R002', 'INC_B', 'SRC_A'), annotation('R003', 'INC_B', 'SRC_B'), annotation('R004', 'INC_C', 'SRC_C')];
  const first = splitAnnotations(records), second = splitAnnotations([...records].reverse());
  assert.equal(first.groups, 2);
  const partitions = Object.values(first.splits);
  const related = partitions.find(ids => ids.includes('R001'));
  assert.ok(related.includes('R002') && related.includes('R003'));
  assert.equal(partitions.flat().length, 4);
  for (const key of Object.keys(first.splits)) assert.deepEqual([...first.splits[key]].sort(), [...second.splits[key]].sort());
  assert.throws(() => splitAnnotations([{ ...annotation(), annotationState: 'independent' }]), /adjudicated/u);
});

test('blank annotation template cannot be mistaken for collected data', async () => {
  const template = parseAnnotationJSONL(await fs.readFile(new URL('../docs/psm-evaluation/EVENT_ANNOTATION_TEMPLATE.jsonl', import.meta.url), 'utf8'));
  assert.equal(template.length, 1);
  assert.equal(template[0].isTemplate, true);
  assert.equal(template[0].text, '');
  assert.throws(() => validateAnnotations(template), /template/u);
});

test('disclosed synthetic benchmark runs locally, keeps provider absent and separates extra clarification facts', async () => {
  const report = await evaluateEventDialogue();
  assert.equal(report.fixture.reports, 24);
  assert.equal(report.fixture.events, 29);
  assert.equal(report.scope.kind, 'synthetic_development_regression');
  assert.equal(report.methods.geminiOnly.status, 'not-run');
  assert.equal(Object.hasOwn(report.methods.geminiOnly, 'reportCategory'), false);
  for (const method of ['keyword', 'reportHybrid', 'eventDialogue']) {
    assert.equal(report.methods[method].status, 'run');
    assert.equal(report.methods[method].reportCategory.samples, 24);
  }
  assert.deepEqual(report.methods.reportHybrid.reportCategory, report.methods.eventDialogue.reportCategory);
  assert.equal(report.questionBurden.maximumInitialVisible, 1);
  assert.equal(report.questionBurden.suppliedReplies, 11);
  assert.equal(report.questionBurden.replayedReplies, 11);
  assert.equal(report.clarification.status, 'synthetic-replay');
  assert.equal(report.clarification.reportsWithSuppliedReplies, 4);
  assert.ok(report.clarification.afterWithAdditionalUserFacts.extraction.action.truePositive > report.clarification.beforeOnSameReports.extraction.action.truePositive);
  assert.equal(report.methods.eventDialogue.location.unsupportedLocationConfirmations, 0);
  assert.equal(report.cases.find(row => row.id === 'F19').eventDialogue.counts.predicted, 0);
  for (const id of ['F09', 'F10']) assert.equal(report.cases.find(row => row.id === id).dialogue.initialVisibleQuestions, 0);
  assert.ok(report.cases.every(row => row.dialogue.errors.length === 0));
});
