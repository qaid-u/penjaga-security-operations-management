import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

export function classificationMetrics(rows, labels) {
  const confusion = Object.fromEntries(labels.map(label => [label, {}]));
  for (const { expected, actual } of rows) {
    confusion[expected] ??= {};
    confusion[expected][actual] = (confusion[expected][actual] || 0) + 1;
  }
  const perClass = labels.map(label => {
    const truePositive = rows.filter(row => row.expected === label && row.actual === label).length;
    const falsePositive = rows.filter(row => row.expected !== label && row.actual === label).length;
    const falseNegative = rows.filter(row => row.expected === label && row.actual !== label).length;
    const support = rows.filter(row => row.expected === label).length;
    const precision = truePositive + falsePositive ? truePositive / (truePositive + falsePositive) : 0;
    const recall = truePositive + falseNegative ? truePositive / (truePositive + falseNegative) : 0;
    const f1 = precision + recall ? 2 * precision * recall / (precision + recall) : 0;
    return { label, support, precision, recall, f1 };
  });
  return {
    samples: rows.length,
    labels,
    accuracy: rows.length ? rows.filter(row => row.expected === row.actual).length / rows.length : null,
    macroF1: rows.length && labels.length ? perClass.reduce((sum, row) => sum + row.f1, 0) / labels.length : null,
    perClass,
    confusion,
    unknownPredictions: rows.filter(row => !labels.includes(row.actual)).length,
  };
}

export function inspectSourceSpans(text, value, prefix = '$') {
  const checked = [];
  const seen = new Set();
  function walk(item, location) {
    if (!item || typeof item !== 'object') return;
    if (!Array.isArray(item) && ('start' in item || 'end' in item || 'text' in item)) {
      const identity = `${item.start}:${item.end}:${item.text}`;
      if (!seen.has(identity)) {
        seen.add(identity);
        const valid = Number.isInteger(item.start) && Number.isInteger(item.end) && typeof item.text === 'string' && item.start >= 0 && item.end > item.start && item.end <= text.length && text.slice(item.start, item.end) === item.text;
        checked.push({ path: location, start: item.start, end: item.end, text: item.text, valid });
      }
    }
    for (const [key, child] of Object.entries(item)) {
      if (child && typeof child === 'object') walk(child, `${location}.${key}`);
    }
  }
  walk(value, prefix);
  return checked;
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}

export async function evaluateNlp({ fixturePath, modelPath } = {}) {
  const fixtureFile = path.resolve(root, fixturePath || 'tests/phase7/fixtures/independent-challenges.json');
  const modelFile = path.resolve(root, modelPath || 'backend/ml/model/nlp-model.json');
  const fixtureText = await fs.readFile(fixtureFile, 'utf8');
  const modelText = await fs.readFile(modelFile, 'utf8');
  const engineSource = await fs.readFile(path.join(root, 'backend/ml/reportAnalysis.js'), 'utf8');
  const fixture = JSON.parse(fixtureText);
  const model = JSON.parse(modelText);
  const { analyzeText } = require('../backend/ml/reportAnalysis');
  const { validateModel } = require('../backend/ml/textModel');
  if (validateModel(model) === false) throw new Error('The model artifact failed validation.');
  if (!fixture.cases?.length || !fixture.categories?.length) throw new Error('The evaluation fixture requires cases and category definitions.');
  if (new Set(fixture.cases.map(row => row.id)).size !== fixture.cases.length) throw new Error('Evaluation case IDs must be unique.');

  const cases = fixture.cases.map(row => {
    const started = performance.now();
    const result = analyzeText({ text: row.text, categories: fixture.categories, locations: fixture.locations, model });
    const durationMs = performance.now() - started;
    const spans = inspectSourceSpans(row.text, { evidence: result.evidence, extraction: result.extraction });
    const baseline = result.baseline || {};
    const allowedLocations = new Map(fixture.locations.map(location => [location.id_lokasi, location.hotspot_id]));
    const locationIds = [...new Set((result.extraction?.locations || []).map(location => location.hotspot_id || allowedLocations.get(location.id_lokasi)).filter(Boolean))];
    const expectedCategory = row.expectedCategory || null;
    return {
      id: row.id,
      tags: row.tags,
      text: row.text,
      expectedCategory,
      expectedEventStatus: row.expectedEventStatus,
      predictedCategory: result.topCategory,
      predictedEventStatus: result.eventStatus,
      riskLevel: result.riskLevel,
      riskScore: result.riskScore,
      baselineCategory: baseline.topCategory ?? baseline.category ?? null,
      baselineRiskLevel: baseline.riskLevel ?? null,
      durationMs,
      categoryCorrect: expectedCategory ? result.topCategory === expectedCategory : null,
      eventCorrect: result.eventStatus === row.expectedEventStatus,
      shouldAvoidHighAlert: Boolean(row.expectNoHighAlert),
      highAlertFalsePositive: Boolean(row.expectNoHighAlert && ['High', 'Critical'].includes(result.riskLevel)),
      conservativePolicyFalseAlert: Boolean(row.expectNoHighAlert && (['High', 'Critical'].includes(baseline.riskLevel) || ['High', 'Critical'].includes(result.riskLevel))),
      sourceSpans: spans.length,
      invalidSourceSpans: spans.filter(span => !span.valid),
      expectedLocationIds: row.expectedLocationIds ?? null,
      extractedLocations: result.extraction?.locations || [],
      predictedLocationIds: locationIds,
      sourceCheckStatus: result.sourceChecks?.status ?? null,
      model: result.model,
    };
  });
  const categoryRows = cases.filter(row => row.expectedCategory).map(row => ({ expected: row.expectedCategory, actual: row.predictedCategory }));
  const baselineRows = cases.filter(row => row.expectedCategory && row.baselineCategory).map(row => ({ expected: row.expectedCategory, actual: row.baselineCategory }));
  const eventRows = cases.map(row => ({ expected: row.expectedEventStatus, actual: row.predictedEventStatus }));
  const labels = fixture.categories.map(row => row.name);
  const negativeCases = cases.filter(row => row.shouldAvoidHighAlert);
  const durations = cases.map(row => row.durationMs);
  const spanTotal = cases.reduce((sum, row) => sum + row.sourceSpans, 0);
  const spanInvalid = cases.reduce((sum, row) => sum + row.invalidSourceSpans.length, 0);
  const locationRows = cases.filter(row => Array.isArray(row.expectedLocationIds));
  const locationTruePositive = locationRows.reduce((sum, row) => sum + row.predictedLocationIds.filter(id => row.expectedLocationIds.includes(id)).length, 0);
  const locationFalsePositive = locationRows.reduce((sum, row) => sum + row.predictedLocationIds.filter(id => !row.expectedLocationIds.includes(id)).length, 0);
  const locationFalseNegative = locationRows.reduce((sum, row) => sum + row.expectedLocationIds.filter(id => !row.predictedLocationIds.includes(id)).length, 0);
  const locationPrecision = locationTruePositive + locationFalsePositive ? locationTruePositive / (locationTruePositive + locationFalsePositive) : 0;
  const locationRecall = locationTruePositive + locationFalseNegative ? locationTruePositive / (locationTruePositive + locationFalseNegative) : 0;
  return {
    evaluatedAt: new Date().toISOString(),
    scope: 'Synthetic development challenge only; no Gemini calls, operational records, human participants or calibrated probability claims.',
    fixture: { version: fixture.version, sha256: createHash('sha256').update(fixtureText).digest('hex'), ...fixture.provenance },
    model: { type: model.modelType || model.type, version: model.version, sha256: createHash('sha256').update(modelText).digest('hex'), trainingSet: model.trainingSet || null },
    analysisRuntime: {
      sourceSha256: createHash('sha256').update(engineSource).digest('hex'),
      policyVersions: [...new Set(cases.map(row => row.model?.policyVersion).filter(Boolean))],
      decisionSources: cases.reduce((counts, row) => { const key = row.model?.decisionSource || 'unspecified'; counts[key] = (counts[key] || 0) + 1; return counts; }, {}),
      interpretation: 'The evaluated output combines trained inference with contextual rules. Do not attribute the aggregate score to the Naive Bayes model alone.',
    },
    conditions: { node: process.version, platform: process.platform, inference: 'Pure local analysis in one process; model-file loading excluded; first-call/JIT effects retained.' },
    category: classificationMetrics(categoryRows, labels),
    keywordBaselineCategory: baselineRows.length ? classificationMetrics(baselineRows, labels) : null,
    eventStatus: classificationMetrics(eventRows, ['reported', 'suspected', 'negated', 'drill', 'unclear']),
    falseHighAlerts: { samples: negativeCases.length, count: negativeCases.filter(row => row.highAlertFalsePositive).length, rate: negativeCases.length ? negativeCases.filter(row => row.highAlertFalsePositive).length / negativeCases.length : null, basis: 'Analysis risk output only. This legacy metric key does not count actual notification events.' },
    simulatedConservativeAlertPolicy: { samples: negativeCases.length, count: negativeCases.filter(row => row.conservativePolicyFalseAlert).length, basis: 'Simulated baseline High/Critical OR analysis High/Critical policy; no database notifications were emitted by this evaluator. Gemini review cannot suppress this policy.' },
    sourceEvidence: { distinctSpansChecked: spanTotal, invalidSpans: spanInvalid, validFraction: spanTotal ? (spanTotal - spanInvalid) / spanTotal : null, limitation: 'Checks verbatim span provenance only, not semantic completeness or factual truth.' },
    approvedLocationSuggestions: {
      samples: locationRows.length,
      exactSetAccuracy: locationRows.length ? locationRows.filter(row => row.predictedLocationIds.length === row.expectedLocationIds.length && row.predictedLocationIds.every(id => row.expectedLocationIds.includes(id))).length / locationRows.length : null,
      precision: locationPrecision,
      recall: locationRecall,
      f1: locationPrecision + locationRecall ? 2 * locationPrecision * locationRecall / (locationPrecision + locationRecall) : 0,
      limitation: 'Only annotated approved-zone identity suggestions are scored. This is not a full named-entity extraction or architectural-location accuracy result; aliases and provisional labels require domain review.',
    },
    localLatencyMs: { samples: durations.length, median: percentile(durations, .5), p95: percentile(durations, .95), maximum: Math.max(...durations) },
    cases,
    limitations: [
      'Expected labels are provisional synthetic author annotations and require domain-expert adjudication.',
      'This fixture is excluded from training; repeated inspection can still make it a development set. Obtain a fresh independently labelled holdout before final claims.',
      'Category macro-F1 uses the fixed eight-category taxonomy and only explicitly category-labelled rows. Event assertion and urgency are separate tasks.',
      'No inference about Gemini reviewer accuracy, user benefit, operational deployment quality or unseen-language performance is justified.',
    ],
  };
}

async function main() {
  const args = process.argv.slice(2);
  const allowed = new Set(['--output', '--fixture', '--model']);
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!allowed.has(args[i]) || !args[i + 1]) throw new Error('Usage: node scripts/evaluate-nlp.mjs [--output path] [--fixture path] [--model path]');
    options[args[i].slice(2)] = args[i + 1];
  }
  const report = await evaluateNlp({ fixturePath: options.fixture, modelPath: options.model });
  const output = path.resolve(root, options.output || 'docs/testing/evidence/phase7-nlp-evaluation.json');
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const display = value => value == null ? 'not available' : value.toFixed(3);
  process.stdout.write(`Synthetic cases: ${report.cases.length}\nHybrid-analysis category macro-F1: ${display(report.category.macroF1)}\nKeyword baseline macro-F1: ${display(report.keywordBaselineCategory?.macroF1)}\nEvent-status accuracy: ${display(report.eventStatus.accuracy)}\nHigh/Critical analysis outputs on denied/drill cases: ${report.falseHighAlerts.count}/${report.falseHighAlerts.samples}\nSimulated conservative-policy alerts on the same cases: ${report.simulatedConservativeAlertPolicy.count}/${report.simulatedConservativeAlertPolicy.samples}\nInvalid source spans: ${report.sourceEvidence.invalidSpans}/${report.sourceEvidence.distinctSpansChecked}\nLocal median / p95: ${display(report.localLatencyMs.median)} / ${display(report.localLatencyMs.p95)} ms\nEvidence: ${path.relative(root, output)}\nNo Gemini, participant or operational accuracy result is claimed.\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
