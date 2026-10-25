import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classificationMetrics, inspectSourceSpans } from '../../scripts/evaluate-nlp.mjs';

test('evaluation reports minority-class errors rather than hiding them in aggregate accuracy', () => {
  const rows = [...Array.from({ length: 9 }, () => ({ expected: 'routine', actual: 'routine' })), { expected: 'fire', actual: 'routine' }];
  const metrics = classificationMetrics(rows, ['routine', 'fire']);
  assert.equal(metrics.accuracy, .9);
  assert.equal(metrics.perClass.find(row => row.label === 'fire').recall, 0);
  assert.ok(metrics.macroF1 < .5);
  assert.equal(classificationMetrics([], ['routine']).macroF1, null);
});

test('unknown predictions count against their gold class and remain visible', () => {
  const metrics = classificationMetrics([{ expected: 'fire', actual: 'Unknown' }], ['fire']);
  assert.equal(metrics.unknownPredictions, 1);
  assert.equal(metrics.macroF1, 0);
  assert.equal(metrics.confusion.fire.Unknown, 1);
});

test('source audit detects invented text and invalid offsets while counting duplicate evidence once', () => {
  const text = 'Pintu Sayap Kiri terbuka.';
  const location = { text: 'Sayap Kiri', start: 6, end: 16 };
  const spans = inspectSourceSpans(text, { evidence: [location], extraction: { locations: [location], actions: [{ text: 'Ketua dimaklumkan', start: 0, end: 17 }] } });
  assert.equal(spans.length, 2);
  assert.equal(spans.filter(row => row.valid).length, 1);
  assert.equal(spans.filter(row => !row.valid).length, 1);
  assert.equal(inspectSourceSpans(text, { evidence: [{ text: 'Sayap Kiri' }] })[0].valid, false);
});
