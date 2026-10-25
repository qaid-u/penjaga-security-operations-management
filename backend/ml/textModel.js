const crypto = require('node:crypto');

const PREPROCESSING_VERSION = 'penjaga-text-v2';
const FORMAT_VERSION = 2;
const stopwords = new Set(['ada','adalah','atau','bagi','dan','dari','dengan','di','dibuat','didapati','dikesan','dilaporkan','dalam','ini','itu','ke','kepada','kerana','oleh','pada','sebagai','semasa','serta','telah','terdapat','untuk','yang','the','a','an','and','at','by','in','on','of','to','during','was','were','is','are']);

function cleanText(text = '') {
  return String(text).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/gu, ' ').trim();
}

function tokenize(text = '') {
  const words = cleanText(text).split(' ').filter(word => word.length > 1 && !stopwords.has(word));
  return [...words, ...words.slice(1).map((word, index) => `${words[index]}_${word}`)];
}

function validateModel(model) {
  const fail = () => { throw new Error('Format model NLP tidak serasi'); };
  if (!model || model.modelType !== 'multinomial_naive_bayes' || model.formatVersion !== FORMAT_VERSION || model.preprocessingVersion !== PREPROCESSING_VERSION) fail();
  if (!Number.isSafeInteger(model.totalDocuments) || model.totalDocuments < 1 || !Array.isArray(model.vocabulary) || !model.vocabulary.length || model.vocabulary.some(token => typeof token !== 'string')) fail();
  if (new Set(model.vocabulary).size !== model.vocabulary.length || !model.categories || Array.isArray(model.categories) || typeof model.categories !== 'object') fail();
  const entries = Object.entries(model.categories);
  if (!entries.length || entries.length > 1000) fail();
  let documents = 0;
  for (const [category, data] of entries) {
    if (!category || !data || !Number.isSafeInteger(data.documentCount) || data.documentCount < 1 || !Number.isSafeInteger(data.tokenCount) || data.tokenCount < 1 || !data.tokens || typeof data.tokens !== 'object' || Array.isArray(data.tokens)) fail();
    const counts = Object.values(data.tokens);
    if (counts.some(count => !Number.isSafeInteger(count) || count < 1) || counts.reduce((sum, value) => sum + value, 0) !== data.tokenCount) fail();
    documents += data.documentCount;
  }
  if (documents !== model.totalDocuments) fail();
  return true;
}

function trainModel(samples, metadata = {}) {
  if (!Array.isArray(samples) || !samples.length) throw new Error('Training samples are required');
  const categories = Object.create(null);
  const vocabulary = new Set();
  const source = [];
  for (const sample of samples) {
    if (typeof sample.text !== 'string' || !sample.text.trim() || typeof sample.category !== 'string' || !sample.category.trim()) throw new Error('Every sample requires text and category');
    const tokens = tokenize(sample.text);
    if (!tokens.length) throw new Error('Training sample contains no usable tokens');
    const category = sample.category.trim();
    const data = categories[category] || (categories[category] = { documentCount: 0, tokenCount: 0, tokens: Object.create(null) });
    data.documentCount += 1;
    for (const token of tokens) {
      vocabulary.add(token); data.tokenCount += 1; data.tokens[token] = (data.tokens[token] || 0) + 1;
    }
    source.push(`${category}\u0000${cleanText(sample.text)}`);
  }
  const checksum = crypto.createHash('sha256').update(source.sort().join('\n')).digest('hex');
  const ordered = Object.fromEntries(Object.entries(categories).sort(([a], [b]) => a.localeCompare(b)).map(([category, data]) => [category, { ...data, tokens: Object.fromEntries(Object.entries(data.tokens).sort(([a], [b]) => a.localeCompare(b))) }]));
  const model = {
    modelType: 'multinomial_naive_bayes', formatVersion: FORMAT_VERSION, preprocessingVersion: PREPROCESSING_VERSION,
    language: 'ms-MY/en', version: `nb-v2-${checksum.slice(0, 12)}`, trainingChecksum: checksum,
    trainedAt: metadata.trainedAt || null, totalDocuments: samples.length,
    vocabulary: [...vocabulary].sort(), categories: ordered,
    scoreType: 'uncalibrated_relative_score', ...metadata,
  };
  validateModel(model);
  return model;
}

function predict(model, text) {
  validateModel(model);
  const vocabulary = new Set(model.vocabulary);
  const allTokens = tokenize(text);
  const tokens = allTokens.filter(token => vocabulary.has(token));
  // An all-unknown sentence must not turn into the largest class's prior prediction.
  if (!tokens.length) return [];
  const scores = Object.entries(model.categories).map(([category, data]) => {
    let logScore = Math.log(data.documentCount / model.totalDocuments);
    for (const token of tokens) logScore += Math.log(((Object.hasOwn(data.tokens, token) ? data.tokens[token] : 0) + 1) / (data.tokenCount + vocabulary.size));
    return { category, logScore };
  }).sort((a, b) => b.logScore - a.logScore || a.category.localeCompare(b.category));
  const max = scores[0].logScore;
  const denominator = scores.reduce((sum, row) => sum + Math.exp(row.logScore - max), 0);
  return scores.map(row => ({ ...row, confidence: Math.exp(row.logScore - max) / denominator, scoreType: 'uncalibrated_relative_score', knownTokens: tokens.length, tokenCoverage: tokens.length / Math.max(1, allTokens.length) }));
}

function evaluate(model, samples) {
  const labels = Object.keys(model.categories);
  const confusion = Object.fromEntries(labels.map(label => [label, {}]));
  let correct = 0;
  for (const sample of samples) {
    const label = predict(model, sample.text)[0]?.category || 'Unknown';
    confusion[sample.category] ||= {};
    confusion[sample.category][label] = (confusion[sample.category][label] || 0) + 1;
    if (label === sample.category) correct += 1;
  }
  const perCategory = labels.map(label => {
    const tp = confusion[label]?.[label] || 0;
    const support = Object.values(confusion[label] || {}).reduce((sum, count) => sum + count, 0);
    const predicted = Object.values(confusion).reduce((sum, row) => sum + (row[label] || 0), 0);
    const precision = predicted ? tp / predicted : 0;
    const recall = support ? tp / support : 0;
    return { category: label, support, precision, recall, f1: precision + recall ? 2 * precision * recall / (precision + recall) : 0 };
  });
  return { scope: 'synthetic_group_holdout_only', samples: samples.length, categoryAccuracy: samples.length ? correct / samples.length : null, macroF1: samples.length ? perCategory.reduce((sum, row) => sum + row.f1, 0) / labels.length : null, perCategory, confusion, operationalAccuracy: null };
}

module.exports = { FORMAT_VERSION, PREPROCESSING_VERSION, cleanText, tokenize, trainModel, predict, validateModel, evaluate };
