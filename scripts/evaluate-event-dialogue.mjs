import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { classificationMetrics } from './evaluate-nlp.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const statuses = ['reported', 'suspected', 'negated', 'drill', 'unclear'];
const fields = ['time', 'location', 'action', 'status'];
const annotationCategories = ['Pencerobohan', 'Kebakaran', 'Pergaduhan', 'Kehilangan Aset', 'Vandalisme', 'Keselamatan Fizikal', 'Kerosakan Kemudahan', 'Rondaan Biasa'];
const sha256 = value => createHash('sha256').update(value).digest('hex');
const mean = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
const unique = values => [...new Set(values)];
const normalize = value => String(value ?? '').trim().toLocaleLowerCase().replace(/\s+/gu, ' ');
const fail = message => { throw new Error(message); };
const validSpan = (text, span) => Boolean(span && Number.isInteger(span.start) && Number.isInteger(span.end) && span.start >= 0 && span.end > span.start && span.end <= text.length && span.text === text.slice(span.start, span.end));
const overlaps = (a, b) => Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));

export function countMetrics(tp, fp, fn) {
  for (const count of [tp, fp, fn]) if (!Number.isInteger(count) || count < 0) fail('Metric counts must be nonnegative integers.');
  const precision = tp + fp ? tp / (tp + fp) : null;
  const recall = tp + fn ? tp / (tp + fn) : null;
  return { truePositive: tp, falsePositive: fp, falseNegative: fn, precision, recall, f1: 2 * tp + fp + fn ? 2 * tp / (2 * tp + fp + fn) : null };
}

function setCounts(expected, actual) {
  const gold = new Set(expected), predicted = new Set(actual);
  return { tp: [...gold].filter(value => predicted.has(value)).length, fp: [...predicted].filter(value => !gold.has(value)).length, fn: [...gold].filter(value => !predicted.has(value)).length, exact: gold.size === predicted.size && [...gold].every(value => predicted.has(value)) };
}

function eventSpans(event) {
  const evidence = (event.evidence || []).filter(span => !span.kind || span.kind === 'incident');
  return evidence.length ? evidence : event.source ? [event.source] : [];
}

// Maximum-cardinality matching uses source overlap alone, never gold category or status.
// Source anchors distinguish repeated same-category incidents in separate clauses.
export function matchEvents(text, gold, predicted) {
  const edges = gold.map(event => predicted.map((item, index) => ({ index, overlap: Math.max(0, ...eventSpans(item).filter(span => validSpan(text, span)).map(span => overlaps(event.anchor, span))) })).filter(row => row.overlap > 0).sort((a, b) => b.overlap - a.overlap || a.index - b.index).map(row => row.index));
  const assigned = new Map();
  function augment(goldIndex, visited) {
    for (const index of edges[goldIndex]) {
      if (visited.has(index)) continue;
      visited.add(index);
      if (!assigned.has(index) || augment(assigned.get(index), visited)) { assigned.set(index, goldIndex); return true; }
    }
    return false;
  }
  [...gold.keys()].sort((a, b) => edges[a].length - edges[b].length || a - b).forEach(index => augment(index, new Set()));
  return [...assigned].map(([predictedIndex, goldIndex]) => ({ goldIndex, predictedIndex })).sort((a, b) => a.goldIndex - b.goldIndex);
}

function locationValue(event) {
  const location = event.location || {};
  return { state: location.state || 'unresolved', id: location.confirmed?.id_lokasi == null ? null : Number(location.confirmed.id_lokasi) };
}

function values(event, field) {
  const plural = { time: 'times', action: 'actions', asset: 'assets' }[field];
  const clarified = field === 'time' ? event.clarifiedTime : field === 'action' ? event.clarifiedAction : null;
  return unique((clarified ? [clarified] : event[plural] || []).map(item => {
    const value = normalize(typeof item === 'string' ? item : field === 'time' ? item.normalizedTime || item.normalized || item.value || item.text : item.text || item.value);
    return value && field === 'time' && item?.role === 'action' ? `action:${value}` : value;
  }).filter(Boolean));
}

export function scoreEventOutput(text, gold, predicted, labels) {
  const pairs = matchEvents(text, gold, predicted);
  const paired = new Map(pairs.map(pair => [pair.goldIndex, predicted[pair.predictedIndex]]));
  const category = classificationMetrics(gold.map((event, index) => ({ expected: event.category, actual: paired.get(index)?.category || 'Unknown' })), labels);
  const status = classificationMetrics(gold.map((event, index) => ({ expected: event.status, actual: paired.get(index)?.status || 'missing' })), statuses);
  const jointCorrect = pairs.filter(pair => gold[pair.goldIndex].category === predicted[pair.predictedIndex].category && gold[pair.goldIndex].status === predicted[pair.predictedIndex].status).length;
  const extraction = {};
  for (const field of ['time', 'asset', 'action']) {
    let tp = 0, fp = 0, fn = 0;
    for (const [index, event] of gold.entries()) {
      const expected = values(event, field), actual = paired.has(index) ? values(paired.get(index), field) : [];
      const counts = setCounts(expected, actual); tp += counts.tp; fp += counts.fp; fn += counts.fn;
    }
    predicted.forEach((event, index) => { if (!pairs.some(pair => pair.predictedIndex === index)) fp += values(event, field).length; });
    extraction[field] = countMetrics(tp, fp, fn);
  }
  const locationRows = gold.map((event, index) => ({ expected: locationValue(event), actual: paired.has(index) ? locationValue(paired.get(index)) : { state: 'missing', id: null } }));
  const unknown = locationRows.filter(row => row.expected.id == null);
  const confirmations = predicted.filter(event => locationValue(event).id != null);
  const unsupportedLocationConfirmations = predicted.filter((event, index) => {
    const actual = locationValue(event); if (actual.id == null) return false;
    const pair = pairs.find(row => row.predictedIndex === index);
    return !pair || actual.id !== locationValue(gold[pair.goldIndex]).id;
  }).length;
  const spans = predicted.flatMap(event => [event.source, ...(event.evidence || []), ...(event.times || []), ...(event.assets || []), ...(event.actions || [])]).filter(span => span && typeof span === 'object' && span.source !== 'clarification');
  const distinct = [...new Map(spans.map(span => [`${span.start}:${span.end}:${span.text}`, span])).values()];
  const unsupportedAffirmations = predicted.filter((event, index) => {
    if (!['reported', 'suspected'].includes(event.status)) return false;
    const pair = pairs.find(row => row.predictedIndex === index);
    return !pair || event.category !== gold[pair.goldIndex].category || !['reported', 'suspected'].includes(gold[pair.goldIndex].status);
  }).length;
  return {
    detection: countMetrics(pairs.length, predicted.length - pairs.length, gold.length - pairs.length),
    category, status,
    jointCategoryStatus: countMetrics(jointCorrect, predicted.length - jointCorrect, gold.length - jointCorrect),
    extraction,
    location: { samples: locationRows.length, exactStateAndIdentityAccuracy: mean(locationRows.map(row => Number(row.expected.state === row.actual.state && row.expected.id === row.actual.id))), confirmedIdentityAccuracy: mean(locationRows.filter(row => row.expected.id != null).map(row => Number(row.expected.id === row.actual.id))), unknownGoldEvents: unknown.length, unknownPreservationRate: mean(unknown.map(row => Number(row.actual.state !== 'missing' && row.actual.id == null))), predictedConfirmations: confirmations.length, unsupportedLocationConfirmations },
    sourceGrounding: { distinctSpans: distinct.length, invalidSpans: distinct.filter(span => !validSpan(text, span)).length, limitation: 'Verbatim offsets support source provenance, not external truth or semantic entailment.' },
    unsupportedClaims: { unsupportedAffirmations, predictedAffirmations: predicted.filter(event => ['reported', 'suspected'].includes(event.status)).length, basis: 'An affirmative incident category lacks overlapping gold support, or its matching gold mention is negated/drill/unclear. Gold labels are provisional synthetic annotations.' },
    counts: { gold: gold.length, predicted: predicted.length, matchedBySource: pairs.length },
  };
}

function mergeMetrics(rows, labels) {
  const sumCounts = selector => {
    const counts = rows.map(selector);
    return countMetrics(counts.reduce((sum, item) => sum + item.truePositive, 0), counts.reduce((sum, item) => sum + item.falsePositive, 0), counts.reduce((sum, item) => sum + item.falseNegative, 0));
  };
  const aggregateClass = (key, allLabels) => {
    const cases = rows.flatMap(row => Object.entries(row[key].confusion).flatMap(([expected, actuals]) => Object.entries(actuals).flatMap(([actual, count]) => Array.from({ length: count }, () => ({ expected, actual })))));
    return classificationMetrics(cases, allLabels);
  };
  const weighted = (key, weight) => { const available = rows.filter(row => key(row) != null); const total = available.reduce((sum, row) => sum + weight(row), 0); return total ? available.reduce((sum, row) => sum + key(row) * weight(row), 0) / total : null; };
  return {
    eventDetection: sumCounts(row => row.detection), category: aggregateClass('category', labels), eventStatus: aggregateClass('status', statuses), jointCategoryStatus: sumCounts(row => row.jointCategoryStatus),
    extraction: Object.fromEntries(['time', 'asset', 'action'].map(field => [field, sumCounts(row => row.extraction[field])])),
    location: { events: rows.reduce((sum, row) => sum + row.location.samples, 0), exactStateAndIdentityAccuracy: weighted(row => row.location.exactStateAndIdentityAccuracy, row => row.location.samples), confirmedIdentityAccuracy: weighted(row => row.location.confirmedIdentityAccuracy, row => row.location.samples - row.location.unknownGoldEvents), unknownGoldEvents: rows.reduce((sum, row) => sum + row.location.unknownGoldEvents, 0), unknownPreservationRate: weighted(row => row.location.unknownPreservationRate, row => row.location.unknownGoldEvents), unsupportedLocationConfirmations: rows.reduce((sum, row) => sum + row.location.unsupportedLocationConfirmations, 0) },
    sourceGrounding: { distinctSpans: rows.reduce((sum, row) => sum + row.sourceGrounding.distinctSpans, 0), invalidSpans: rows.reduce((sum, row) => sum + row.sourceGrounding.invalidSpans, 0) },
    unsupportedClaims: { unsupportedAffirmations: rows.reduce((sum, row) => sum + row.unsupportedClaims.unsupportedAffirmations, 0), predictedAffirmations: rows.reduce((sum, row) => sum + row.unsupportedClaims.predictedAffirmations, 0) },
  };
}

export function validateFixture(fixture) {
  if (!fixture || !Array.isArray(fixture.categories) || !fixture.categories.length || !Array.isArray(fixture.locations) || !Array.isArray(fixture.cases) || !fixture.cases.length) fail('Fixture requires categories, locations and nonempty cases.');
  const labels = fixture.categories.map(category => category.name), ids = new Set();
  for (const row of fixture.cases) {
    if (!row.id || ids.has(row.id) || typeof row.text !== 'string' || !row.text.trim() || !labels.concat('Unknown').includes(row.expectedReportCategory) || !Array.isArray(row.events)) fail(`Invalid or duplicate fixture case: ${row.id}`);
    ids.add(row.id);
    for (const event of row.events) {
      if (!labels.includes(event.category) || !statuses.includes(event.status) || !validSpan(row.text, event.anchor) || !['confirmed', 'ambiguous', 'unresolved'].includes(event.location?.state) || !Array.isArray(event.times) || !Array.isArray(event.assets) || !Array.isArray(event.actions)) fail(`Invalid event annotation: ${row.id}`);
      if (event.location.state === 'confirmed' && !fixture.locations.some(location => Number(location.id_lokasi) === Number(event.location.confirmed?.id_lokasi))) fail(`Unknown gold location: ${row.id}`);
      if (event.location.state !== 'confirmed' && event.location.confirmed != null) fail(`Unconfirmed location must have confirmed=null: ${row.id}`);
    }
    for (const need of row.clarificationNeeds || []) if (!Number.isInteger(need.eventIndex) || !row.events[need.eventIndex] || !fields.includes(need.field)) fail(`Invalid clarification need: ${row.id}`);
    for (const answer of row.syntheticReplies || []) {
      if (!Number.isInteger(answer.eventIndex) || !row.events[answer.eventIndex] || !fields.includes(answer.field) || typeof answer.value !== 'string') fail(`Invalid synthetic clarification: ${row.id}`);
      if (['skip', 'unknown'].includes(answer.value)) continue;
      if (answer.field === 'status' && !statuses.filter(status => status !== 'unclear').includes(answer.value)) fail(`Invalid synthetic status: ${row.id}`);
      if (answer.field === 'location' && !fixture.locations.some(location => String(location.id_lokasi) === answer.value)) fail(`Invalid synthetic location: ${row.id}`);
      if (['time', 'action'].includes(answer.field) && (!answer.value.trim() || answer.value.length > (answer.field === 'time' ? 120 : 500))) fail(`Invalid synthetic field text: ${row.id}`);
    }
  }
  return fixture;
}

export function validateProviderPredictions(input, fixture, fixtureSha256) {
  if (input == null) return { status: 'not-run', reason: 'No external Gemini-only predictions supplied.', predictions: [] };
  const provenance = input.provenance;
  if (!provenance || provenance.provider !== 'Google Gemini' || !provenance.model || !provenance.generatedAt || Number.isNaN(Date.parse(provenance.generatedAt)) || !/^[a-f0-9]{64}$/u.test(provenance.promptSha256 || '') || provenance.fixtureSha256 !== fixtureSha256 || provenance.mode !== 'gemini-only' || provenance.humanEdited !== false || !Array.isArray(input.predictions)) fail('Provider import requires Gemini-only provenance, model/date, prompt SHA-256, matching fixture SHA-256 and humanEdited=false.');
  const ids = new Set();
  for (const prediction of input.predictions) {
    const row = fixture.cases.find(item => item.id === prediction.id);
    if (!row || ids.has(prediction.id) || !fixture.categories.map(category => category.name).concat('Unknown').includes(prediction.reportCategory) || !Array.isArray(prediction.events)) fail(`Malformed or duplicate provider prediction: ${prediction.id}`);
    ids.add(prediction.id);
    for (const event of prediction.events) {
      if (!fixture.categories.some(category => category.name === event.category) || !statuses.includes(event.status) || !validSpan(row.text, event.source) || !Array.isArray(event.evidence) || !Array.isArray(event.times) || !Array.isArray(event.assets) || !Array.isArray(event.actions) || !['confirmed', 'ambiguous', 'unresolved'].includes(event.location?.state)) fail(`Malformed provider event: ${prediction.id}`);
      const identity = event.location.confirmed?.id_lokasi;
      if (identity != null && !fixture.locations.some(location => Number(location.id_lokasi) === Number(identity))) fail(`Provider location outside fixture catalogue: ${prediction.id}`);
      if ((event.location.state === 'confirmed') !== (identity != null)) fail(`Provider location state and identity disagree: ${prediction.id}`);
      for (const span of [...event.evidence, ...event.times, ...event.assets, ...event.actions]) if (!validSpan(row.text, span)) fail(`Invalid provider extraction/evidence offsets: ${prediction.id}`);
    }
  }
  return { status: ids.size === fixture.cases.length ? 'run' : 'partial', provenance, predictions: input.predictions, suppliedCases: ids.size, totalCases: fixture.cases.length };
}

export function buildProviderInput(fixture, fixtureSha256) {
  validateFixture(fixture);
  const inputs = { categories: fixture.categories, locations: fixture.locations, reports: fixture.cases.map(row => ({ id: row.id, text: row.text, selectedPostId: row.selectedPostId ?? null })) };
  const instructions = 'Return JSON predictions only, using the supplied taxonomy and location catalogue. Do not invent facts. Return one reportCategory (taxonomy label or Unknown) and events for every report. Each event has category, status (reported/suspected/negated/drill/unclear), source and evidence with exact zero-based JavaScript UTF-16 {text,start,end} offsets, times/assets/actions arrays of exact source spans (time spans may include normalizedTime HH:mm), and location {state:confirmed/ambiguous/unresolved,confirmed:null or {id_lokasi}}. Treat negation, drills, suspicion and separate clauses independently. An alias, floor shorthand or selected post is a candidate context, not sufficient confirmation; use confirmed only for a unique explicit official display name. Do not include explanations, gold labels, external lookup, human clarification answers or model-specific assistance. Response shape: {predictions:[{id,reportCategory,events:[...]}]}.';
  const promptText = `${instructions}\n${JSON.stringify(inputs)}`;
  return { status: 'prepared-only', fixtureSha256, promptSha256: sha256(promptText), promptText, warning: 'No report was sent to any provider. The operator must authorize any external disclosure, run the same frozen prompt independently and record truthful provider provenance. This packet contains no gold annotations or synthetic replies.' };
}

function legacyEvent(text, analysis, keyword = false) {
  const category = keyword ? analysis.baseline.topCategory : analysis.topCategory;
  if (category === 'Unknown') return [];
  const locations = analysis.extraction.locations || [], ids = unique(locations.map(location => location.id_lokasi));
  const confirmed = ids.length === 1 && !locations.some(location => location.ambiguous) ? locations[0] : null;
  const keywords = keyword ? analysis.baseline.matchedKeywords : analysis.matchedKeywords;
  const evidence = unique(keywords || []).flatMap(word => {
    const start = text.toLocaleLowerCase().indexOf(String(word).toLocaleLowerCase());
    return start < 0 ? [] : [{ text: text.slice(start, start + word.length), start, end: start + word.length, kind: 'incident' }];
  });
  return [{ category, status: keyword ? 'reported' : analysis.eventStatus, source: { text, start: 0, end: text.length }, evidence, times: keyword ? [] : analysis.extraction.times, assets: keyword ? [] : analysis.extraction.assets, actions: keyword ? [] : analysis.extraction.actions, location: { state: keyword ? 'unresolved' : confirmed ? 'confirmed' : locations.length ? 'ambiguous' : 'unresolved', confirmed: keyword ? null : confirmed } }];
}

function applyGoldReplies(row) {
  const gold = structuredClone(row.events);
  for (const answer of row.syntheticReplies || []) {
    if (['skip', 'unknown'].includes(answer.value)) continue;
    const event = gold[answer.eventIndex];
    if (answer.field === 'location') event.location = { state: 'confirmed', confirmed: { id_lokasi: Number(answer.value) } };
    else if (answer.field === 'status') event.status = answer.value;
    else event[answer.field === 'time' ? 'times' : 'actions'] = [{ text: answer.value, value: answer.value, source: 'clarification' }];
  }
  return gold;
}

export async function evaluateEventDialogue({ fixturePath = 'tests/phase8/evaluation-fixtures.json', modelPath = 'backend/ml/model/nlp-model.json', providerPath } = {}) {
  const fixtureText = await fs.readFile(path.resolve(root, fixturePath), 'utf8');
  const fixture = validateFixture(JSON.parse(fixtureText)), fixtureSha256 = sha256(fixtureText);
  const modelText = await fs.readFile(path.resolve(root, modelPath), 'utf8'), model = JSON.parse(modelText);
  const { analyzeText } = require('../backend/ml/reportAnalysis');
  const { buildDialogue } = require('../backend/ml/eventDialogue');
  const { validateModel } = require('../backend/ml/textModel');
  if (validateModel(model) === false) fail('Model artifact failed validation.');
  const provider = validateProviderPredictions(providerPath ? JSON.parse(await fs.readFile(path.resolve(root, providerPath), 'utf8')) : null, fixture, fixtureSha256);
  const labels = fixture.categories.map(category => category.name), cases = [];
  for (const row of fixture.cases) {
    const analysis = analyzeText({ text: row.text, categories: fixture.categories, locations: fixture.locations, model });
    const base = { text: row.text, analysis, locations: fixture.locations, selectedPostId: row.selectedPostId ?? null };
    let dialogue = buildDialogue(base);
    const initial = dialogue, clarifications = [], asked = [], usedReplies = new Set(), replyOutcomes = [];
    while (dialogue.questions.length && asked.length < 100) {
      const question = dialogue.questions[0], pairs = matchEvents(row.text, row.events, dialogue.events);
      const pair = pairs.find(item => dialogue.events[item.predictedIndex]?.id === question.eventId);
      const replyIndex = (row.syntheticReplies || []).findIndex((reply, index) => !usedReplies.has(index) && reply.eventIndex === pair?.goldIndex && reply.field === question.field);
      if (replyIndex < 0) break;
      const reply = row.syntheticReplies[replyIndex];
      usedReplies.add(replyIndex);
      asked.push(question.id);
      clarifications.push({ questionId: question.id, value: reply.value });
      dialogue = buildDialogue({ ...base, clarifications });
      replyOutcomes.push({ ...reply, replayed: !dialogue.errors?.length });
      if (dialogue.errors?.length) break;
    }
    (row.syntheticReplies || []).forEach((reply, index) => { if (!usedReplies.has(index)) replyOutcomes.push({ ...reply, replayed: false, reason: 'The adaptive sequence did not reach this supplied reply.' }); });
    const required = row.clarificationNeeds || [], initialPairs = matchEvents(row.text, row.events, initial.events);
    const activeCandidates = initial.candidateQuestions.filter(question => { const event = initial.events.find(item => item.id === question.eventId); return event && !['negated', 'drill'].includes(event.status) && !(normalize(event.category) === 'rondaan biasa' && question.field === 'action'); });
    const relevantQuestions = activeCandidates.filter(question => { const pair = initialPairs.find(item => initial.events[item.predictedIndex]?.id === question.eventId); return pair && required.some(need => need.eventIndex === pair.goldIndex && need.field === question.field); }).length;
    const external = provider.predictions.find(prediction => prediction.id === row.id);
    cases.push({ id: row.id, tags: row.tags, expectedReportCategory: row.expectedReportCategory, analysisModel: analysis.model, predictions: { keyword: analysis.baseline.topCategory, reportHybrid: analysis.topCategory, eventDialogue: analysis.topCategory, ...(external ? { geminiOnly: external.reportCategory } : {}) },
      keyword: scoreEventOutput(row.text, row.events, legacyEvent(row.text, analysis, true), labels), reportHybrid: scoreEventOutput(row.text, row.events, legacyEvent(row.text, analysis), labels), eventDialogue: scoreEventOutput(row.text, row.events, initial.events, labels),
      ...(external ? { geminiOnly: scoreEventOutput(row.text, row.events, external.events, labels) } : {}),
      afterClarification: (row.syntheticReplies || []).length ? scoreEventOutput(row.text, applyGoldReplies(row), dialogue.events, labels) : null,
      dialogue: { initialVisibleQuestions: initial.questions.length, initialCandidateQuestions: activeCandidates.length, dormantValidationCandidates: initial.candidateQuestions.length - activeCandidates.length, relevantCandidateQuestions: relevantQuestions, unnecessaryCandidateQuestions: activeCandidates.length - relevantQuestions, annotatedNeeds: required.length, legacyStaticQuestions: analysis.quality.questions.length, replayedReplies: replyOutcomes.filter(reply => reply.replayed).length, suppliedSyntheticReplies: replyOutcomes.length, askedQuestionIds: asked, replyOutcomes, answers: dialogue.answers, errors: dialogue.errors, initialQuestions: initial.questions },
    });
  }
  const reportCategory = method => classificationMetrics(cases.filter(row => row.predictions[method] != null).map(row => ({ expected: row.expectedReportCategory, actual: row.predictions[method] })), labels.concat('Unknown'));
  const methods = Object.fromEntries(['keyword', 'reportHybrid', 'eventDialogue'].map(method => [method, { status: 'run', reports: cases.length, reportCategory: reportCategory(method), ...mergeMetrics(cases.map(row => row[method]), labels) }]));
  methods.geminiOnly = { status: provider.status, reason: provider.reason || null, provenance: provider.provenance || null, reports: provider.predictions.length, ...(provider.predictions.length ? { reportCategory: reportCategory('geminiOnly'), ...mergeMetrics(cases.filter(row => row.geminiOnly).map(row => row.geminiOnly), labels), matchedLocalReportCategory: Object.fromEntries(['keyword', 'reportHybrid', 'eventDialogue'].map(method => [method, classificationMetrics(cases.filter(row => row.geminiOnly).map(row => ({ expected: row.expectedReportCategory, actual: row.predictions[method] })), labels.concat('Unknown'))])), matchedLocalEventMetrics: Object.fromEntries(['keyword', 'reportHybrid', 'eventDialogue'].map(method => [method, mergeMetrics(cases.filter(row => row.geminiOnly).map(row => row[method]), labels)])) } : {}) };
  const after = cases.filter(row => row.afterClarification), dialogue = cases.map(row => row.dialogue);
  return { evaluatedAt: new Date().toISOString(), scope: fixture.provenance, fixture: { version: fixture.version, sha256: fixtureSha256, reports: cases.length, events: fixture.cases.reduce((sum, row) => sum + row.events.length, 0) }, runtime: { node: process.version, modelSha256: sha256(modelText), modelVersion: model.version, analysisSourceSha256: sha256(await fs.readFile(path.join(root, 'backend/ml/reportAnalysis.js'))), dialogueSourceSha256: sha256(await fs.readFile(path.join(root, 'backend/ml/eventDialogue.js'))), decisionSources: cases.reduce((counts, row) => { const key = row.analysisModel?.decisionSource || 'unspecified'; counts[key] = (counts[key] || 0) + 1; return counts; }, {}), trainedInferenceReports: cases.filter(row => row.analysisModel?.trainedInferenceRan).length, interpretation: 'Hybrid metrics combine contextual rules and saved-model inference; they are not accuracy results for the trained model alone.' }, methods,
    clarification: { status: after.length ? 'synthetic-replay' : 'not-run', reportsWithSuppliedReplies: after.length, beforeOnSameReports: after.length ? mergeMetrics(after.map(row => row.eventDialogue), labels) : null, afterWithAdditionalUserFacts: after.length ? mergeMetrics(after.map(row => row.afterClarification), labels) : null, interpretation: 'After scores use additional explicitly supplied synthetic user facts and changed gold labels. They do not measure improved extraction of the original text or human benefit.' },
    questionBurden: { reports: cases.length, initialVisibleMean: mean(dialogue.map(row => row.initialVisibleQuestions)), maximumInitialVisible: Math.max(...dialogue.map(row => row.initialVisibleQuestions)), candidateMean: mean(dialogue.map(row => row.initialCandidateQuestions)), legacyStaticMean: mean(dialogue.map(row => row.legacyStaticQuestions)), annotatedNeeds: dialogue.reduce((sum, row) => sum + row.annotatedNeeds, 0), relevantCandidates: dialogue.reduce((sum, row) => sum + row.relevantCandidateQuestions, 0), unnecessaryCandidates: dialogue.reduce((sum, row) => sum + row.unnecessaryCandidateQuestions, 0), suppliedReplies: dialogue.reduce((sum, row) => sum + row.suppliedSyntheticReplies, 0), replayedReplies: dialogue.reduce((sum, row) => sum + row.replayedReplies, 0), limitation: 'Question counts and synthetic answer replay are structural measurements; no participant time, satisfaction or usability data.' },
    limitations: ['Synthetic developer-authored regression set; expected labels are provisional, not expert-adjudicated.', 'Report category uses the same report-level hybrid projection for both reportHybrid and eventDialogue; do not claim a separate classifier improvement from that comparison.', 'Singleton legacy adapters expose their actual lack of event segmentation; keyword status=reported is its occurrence assumption and field output is empty.', 'Source-overlap matching ignores category/status when pairing events. Event recall and joint F1 include omissions; extra events count as false positives.', 'Gemini import is optional. Missing predictions are not zero scores. Partial imports are compared only with the same local subset.', 'Unknown preservation and unsupported location counts assess annotated catalogue identity; source spans alone cannot establish factual truth.', 'No operational, expert or participant records were collected by this script. No network or provider calls occur.'], cases };
}

export function parseAnnotationJSONL(text) {
  return text.split(/\r?\n/u).filter(line => line.trim()).map((line, index) => { try { return JSON.parse(line); } catch { fail(`Invalid annotation JSON on line ${index + 1}.`); } });
}

export function validateAnnotations(records) {
  if (!Array.isArray(records) || !records.length) fail('No annotation records supplied.');
  const ids = new Set();
  for (const row of records) {
    if (row.recordType !== 'annotation' || row.isTemplate !== false || !/^R\d{3,8}$/u.test(row.reportId || '') || ids.has(row.reportId) || !/^INC_[A-Z0-9_]+$/u.test(row.incidentGroup || '') || !/^SRC_[A-Z0-9_]+$/u.test(row.sourceGroup || '') || !/^ANN_[A-Z0-9_]+$/u.test(row.annotatorId || '') || row.deidentified !== true || typeof row.text !== 'string' || !row.text.trim() || !annotationCategories.concat('Unknown').includes(row.reportCategory) || !Array.isArray(row.events) || !Array.isArray(row.clarificationNeeds) || !row.catalogueVersion || !row.annotationVersion || !['draft', 'independent', 'adjudicated'].includes(row.annotationState) || !Array.isArray(row.redactions)) fail(`Invalid annotation schema or template row: ${row.reportId || 'unknown'}`);
    ids.add(row.reportId);
    const knownKeys = new Set(['recordType', 'isTemplate', 'reportId', 'incidentGroup', 'sourceGroup', 'annotatorId', 'annotationVersion', 'annotationState', 'deidentified', 'catalogueVersion', 'text', 'reportCategory', 'events', 'clarificationNeeds', 'redactions', 'notes']);
    if (Object.keys(row).some(key => !knownKeys.has(key))) fail(`Unexpected annotation field (possible identifier): ${row.reportId}`);
    const serialized = JSON.stringify(row);
    if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu.test(serialized) || /\b\d{6}[- ]?\d{2}[- ]?\d{4}\b/u.test(serialized) || /(?:\+?60[- .]?|\b0)1\d(?:[- .]?\d){7,9}\b/u.test(serialized) || /\b(?:nama|name|telefon|phone|nombor kad|plate)\s*:\s*(?!\[)[^\s]/iu.test(row.text)) fail(`Potential direct identifier remains: ${row.reportId}`);
    const placeholders = [...row.text.matchAll(/\[([^\]]+)\]/gu)].map(match => match[1]);
    if (placeholders.some(value => !/^(?:PERSON|PHONE|EMAIL|ID|VEHICLE|ADDRESS|DATE)_[1-9]\d*$/u.test(value))) fail(`Unapproved de-identification placeholder: ${row.reportId}`);
    if (row.redactions.some(value => !placeholders.includes(value)) || placeholders.some(value => !row.redactions.includes(value))) fail(`Redaction list and placeholders disagree: ${row.reportId}`);
    for (const event of row.events) {
      if (!annotationCategories.includes(event.category) || !statuses.includes(event.status) || !validSpan(row.text, event.anchor) || !['confirmed', 'ambiguous', 'unresolved'].includes(event.location?.state) || !Array.isArray(event.times) || !Array.isArray(event.assets) || !Array.isArray(event.actions) || Object.keys(event).some(key => !['category', 'status', 'anchor', 'location', 'times', 'assets', 'actions'].includes(key))) fail(`Invalid annotated event: ${row.reportId}`);
      if ((event.location.state === 'confirmed') !== (Number.isSafeInteger(event.location.confirmed?.id_lokasi) && event.location.confirmed.id_lokasi > 0)) fail(`Annotated location state/identity mismatch: ${row.reportId}`);
      if (event.location.state !== 'confirmed' && event.location.confirmed != null) fail(`Unresolved annotated location must be null: ${row.reportId}`);
    }
    for (const need of row.clarificationNeeds) if (!Number.isInteger(need.eventIndex) || !row.events[need.eventIndex] || !fields.includes(need.field) || Object.keys(need).some(key => !['eventIndex', 'field'].includes(key))) fail(`Invalid clarification-need annotation: ${row.reportId}`);
  }
  return records;
}

export function splitAnnotations(records, seed = 'penjaga-holdout-v1') {
  validateAnnotations(records);
  if (records.some(row => row.annotationState !== 'adjudicated')) fail('Freeze splits only from adjudicated reports; keep independent annotator drafts separately.');
  const parent = records.map((_, index) => index);
  const find = index => parent[index] === index ? index : (parent[index] = find(parent[index]));
  for (let i = 0; i < records.length; i++) for (let j = 0; j < i; j++) if (records[i].incidentGroup === records[j].incidentGroup || records[i].sourceGroup === records[j].sourceGroup) parent[find(i)] = find(j);
  const groups = new Map();
  records.forEach((row, index) => { const key = find(index); groups.set(key, [...(groups.get(key) || []), row]); });
  const split = { train: [], development: [], holdout: [] };
  for (const group of groups.values()) {
    const key = unique(group.flatMap(row => [row.incidentGroup, row.sourceGroup])).sort().join('|');
    const bucket = Number.parseInt(sha256(`${seed}:${key}`).slice(0, 8), 16) / 0x100000000;
    split[bucket < .6 ? 'train' : bucket < .8 ? 'development' : 'holdout'].push(...group.map(row => row.reportId));
  }
  return { seed, ratios: { train: .6, development: .2, holdout: .2 }, groups: groups.size, records: records.length, splits: split, caution: 'Group hashing gives approximate proportions; small or linked corpora can yield empty partitions. Freeze the manifest before training. This utility does not make a synthetic corpus an independent expert holdout.' };
}

async function main() {
  const options = {}, allowed = new Set(['--fixture', '--model', '--output', '--gemini-predictions', '--annotations', '--split-seed', '--export-provider-input']);
  for (let index = 2; index < process.argv.length; index += 2) {
    if (!allowed.has(process.argv[index]) || !process.argv[index + 1]) fail('Usage: node scripts/evaluate-event-dialogue.mjs [--fixture file] [--model file] [--output file] [--gemini-predictions file] OR --annotations file [--split-seed value] [--output file] OR --export-provider-input file [--fixture file]');
    options[process.argv[index].slice(2)] = process.argv[index + 1];
  }
  let report;
  if (options['export-provider-input']) {
    const fixtureText = await fs.readFile(path.resolve(root, options.fixture || 'tests/phase8/evaluation-fixtures.json'), 'utf8');
    report = buildProviderInput(JSON.parse(fixtureText), sha256(fixtureText));
  } else report = options.annotations ? splitAnnotations(parseAnnotationJSONL(await fs.readFile(path.resolve(root, options.annotations), 'utf8')), options['split-seed']) : await evaluateEventDialogue({ fixturePath: options.fixture, modelPath: options.model, providerPath: options['gemini-predictions'] });
  const outputPath = options['export-provider-input'] || options.output;
  if (outputPath) { const output = path.resolve(root, outputPath); await fs.mkdir(path.dirname(output), { recursive: true }); await fs.writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8'); }
  else process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (outputPath) process.stdout.write(`${options['export-provider-input'] ? 'Provider input prepared locally; no network request' : options.annotations ? 'Validated grouped split' : 'Synthetic event/dialogue evaluation'} written to ${outputPath}.\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
