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
  let categories;
  try {
    const res = await client.query(
      `select nama_kategori, tahap_keutamaan, kata_kunci_rujukan
       from tbl_kategori_insiden
       where status_kategori = 'Aktif'
       order by id_kategori_insiden`
    );
    categories = res.rows.map((row) => ({
      name: row.nama_kategori,
      priority: row.tahap_keutamaan,
      keywords: Array.isArray(row.kata_kunci_rujukan) ? row.kata_kunci_rujukan : [],
    }));
  } catch (e) {
    console.error('NLP config error:', e);
    throw new Error('Konfigurasi kategori NLP tidak dapat dimuat', { cause: e });
  } finally {
    client.release();
  }
  if (!categories.length) throw new Error('Tiada kategori NLP aktif untuk mengelaskan laporan');

  const clean = String(text).toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
  const words = clean.split(' ');

  const scores = {};
  const matched = {};
  categories.forEach(c => {
    scores[c.name] = 0;
    matched[c.name] = [];
  });

  if (modelData && modelData.weights) {
    categories.forEach(c => {
      const catWeights = modelData.weights[c.name];
      if (catWeights) {
        words.forEach(w => {
          if (catWeights[w]) scores[c.name] += catWeights[w];
        });
      }
    });
  }

  categories.forEach((category) => {
    category.keywords.forEach((keyword) => {
      const normalizedKeyword = String(keyword).toLowerCase().trim();
      if (normalizedKeyword && clean.includes(normalizedKeyword)) {
        if (!matched[category.name].includes(normalizedKeyword)) {
          matched[category.name].push(normalizedKeyword);
        }
      }
    });
  });

  categories.forEach(c => {
    if (matched[c.name].length > 0) {
      const priorityScore = { Low: 10, Medium: 35, High: 65, Critical: 85 }[c.priority] || 10;
      scores[c.name] += priorityScore + matched[c.name].length * 10;
    }
  });

  let topCat = categories.find((category) => category.name === 'Rondaan Biasa')?.name || 'Rondaan Biasa';
  let maxScore = scores[topCat] || 0;
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

  const confidence = categories.length
    ? Math.min(1, (matched[topCat] || []).length / Math.max(1, categories.find((category) => category.name === topCat)?.keywords.length || 1))
    : 0;

  return {
    cleanText: clean,
    topCategory: topCat,
    riskScore: finalScore,
    riskLevel: risk,
    matchedKeywords: matched[topCat] || [],
    confidence,
  };
}

module.exports = { processNLP };
