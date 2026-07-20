const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const nlpModelPath = process.env.NLP_MODEL_PATH || path.join(__dirname, 'model', 'nlp-model.json');

async function processNLP(text) {
  let modelData = null;
  if (fs.existsSync(nlpModelPath)) {
    try {
      modelData = JSON.parse(fs.readFileSync(nlpModelPath, 'utf8'));
    } catch (e) {
      console.error('Error reading NLP model:', e);
    }
  }

  const client = await pool.connect();
  let categories = [];
  try {
    const res = await client.query("select kategori, kata_kunci, skor_asas from tbl_kategori_insiden where status_aktif = true");
    categories = res.rows.map(r => ({ ...r, kata_kunci: Array.isArray(r.kata_kunci) ? r.kata_kunci : JSON.parse(r.kata_kunci || '[]') }));
  } catch (e) {
    console.error('NLP config error:', e);
  } finally {
    client.release();
  }

  const clean = String(text).toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = clean.split(' ');

  const scores = {};
  const matched = {};
  categories.forEach(c => {
    scores[c.kategori] = 0;
    matched[c.kategori] = [];
  });

  if (modelData && modelData.weights) {
    categories.forEach(c => {
      const catWeights = modelData.weights[c.kategori];
      if (catWeights) {
        words.forEach(w => {
          if (catWeights[w]) scores[c.kategori] += catWeights[w];
        });
      }
    });
  }

  words.forEach(w => {
    categories.forEach(c => {
      if (c.kata_kunci.includes(w)) {
        if (!matched[c.kategori].includes(w)) matched[c.kategori].push(w);
      }
    });
  });

  categories.forEach(c => {
    if (matched[c.kategori].length > 0) {
      scores[c.kategori] += c.skor_asas;
      scores[c.kategori] += matched[c.kategori].length * 10;
    }
  });

  let topCat = 'Rondaan Biasa';
  let maxScore = scores['Rondaan Biasa'] || 0;
  for (const [cat, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      topCat = cat;
    }
  }

  const finalScore = Math.min(100, Math.max(0, Math.round(maxScore)));
  let risk = 'Low';
  if (finalScore > 80) risk = 'Critical';
  else if (finalScore > 60) risk = 'High';
  else if (finalScore > 30) risk = 'Medium';

  return { cleanText: clean, topCategory: topCat, riskScore: finalScore, riskLevel: risk, matchedKeywords: matched[topCat] || [] };
}

module.exports = { processNLP };
