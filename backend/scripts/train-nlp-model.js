const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'ml', 'data', 'nlp-training-samples.json');
const modelDir = path.join(__dirname, '..', 'ml', 'model');
const modelPath = path.join(modelDir, 'nlp-model.json');

const stopwords = new Set([
  'ada', 'adalah', 'akan', 'atau', 'bagi', 'dan', 'dari', 'dengan', 'di', 'dibuat', 'didapati',
  'dikesan', 'dilaporkan', 'dalam', 'ini', 'itu', 'ke', 'kepada', 'kerana', 'oleh', 'pada',
  'sebagai', 'semasa', 'serta', 'telah', 'terdapat', 'untuk', 'yang',
]);

function cleanText(text = '') {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text = '') {
  const words = cleanText(text)
    .split(' ')
    .filter((word) => word.length > 2 && !stopwords.has(word));
  const bigrams = [];
  for (let index = 0; index < words.length - 1; index += 1) {
    bigrams.push(`${words[index]}_${words[index + 1]}`);
  }
  return [...words, ...bigrams];
}

function splitSamples(samples) {
  const train = [];
  const test = [];
  const byCategory = samples.reduce((groups, sample) => {
    groups[sample.category] = groups[sample.category] || [];
    groups[sample.category].push(sample);
    return groups;
  }, {});
  Object.values(byCategory).forEach((group) => {
    group.forEach((sample, index) => {
      if (index % 5 === 0) test.push(sample);
      else train.push(sample);
    });
  });
  return { train, test };
}

const operationProfiles = {
  'Rondaan Biasa': {
    risk: 'Low',
    locations: ['pos lobi utama', 'pos bilik kawalan cctv', 'tingkat 3 pejabat suk', 'pos lif lg', 'pos utc', 'pos rumah vip'],
    events: ['rondaan selesai', 'keadaan terkawal', 'tiada insiden', 'buku laporan dikemas kini', 'semua pintu diperiksa', 'kawasan selamat'],
    actions: ['rekod syif dikemas kini', 'laluan diperiksa', 'pelawat direkodkan', 'pos diserahkan kepada syif berikutnya'],
  },
  Pencerobohan: {
    risk: 'High',
    locations: ['pintu belakang bangunan', 'koridor pejabat', 'kawasan larangan', 'bilik kawalan cctv', 'pos rumah vip', 'lif pejabat'],
    events: ['masuk tanpa izin', 'individu mencurigakan', 'orang asing tanpa pas', 'cubaan ceroboh', 'gagal menunjukkan pas', 'mengikuti kakitangan masuk'],
    actions: ['individu ditahan untuk semakan', 'ketua dimaklumkan', 'rakaman cctv disemak', 'akses ditolak dan kawasan dikawal'],
  },
  Kebakaran: {
    risk: 'Critical',
    locations: ['bilik utiliti', 'ruang elektrik', 'kawasan parkir', 'laluan tangga kecemasan', 'stor pejabat', 'lobi utama'],
    events: ['asap tebal', 'bau hangit', 'percikan api', 'alarm kebakaran berbunyi', 'api kecil', 'bau terbakar'],
    actions: ['pemadam api disediakan', 'kawasan dikosongkan', 'bomba dimaklumkan', 'laluan kecemasan dikawal'],
  },
  Pergaduhan: {
    risk: 'High',
    locations: ['ruang lobi', 'kaunter pelawat', 'kawasan parkir', 'pintu masuk dun', 'lif pejabat', 'ruang menunggu'],
    events: ['pergaduhan antara pelawat', 'kekecohan berlaku', 'individu bertindak agresif', 'pertengkaran kuat', 'saling menolak', 'enggan mematuhi arahan'],
    actions: ['pihak terlibat dileraikan', 'ketua dimaklumkan', 'keadaan dikawal', 'laporan dibuat kepada pentadbiran'],
  },
  'Kehilangan Aset': {
    risk: 'High',
    locations: ['bilik mesyuarat', 'stor pejabat', 'ruang menunggu', 'pos kawalan', 'tingkat 4', 'bilik fail'],
    events: ['aset hilang', 'barang dicuri', 'kad akses hilang', 'kunci tidak dapat dikesan', 'radio komunikasi hilang', 'dokumen rasmi hilang'],
    actions: ['rekod pinjaman disemak', 'rakaman cctv disemak', 'ketua dimaklumkan', 'laporan kehilangan direkodkan'],
  },
  Vandalisme: {
    risk: 'Medium',
    locations: ['tandas awam', 'papan tanda parkir', 'lobi utama', 'pintu stor', 'papan notis', 'kamera cctv luar'],
    events: ['dinding diconteng', 'cermin pecah', 'kerusi dirosakkan', 'papan tanda rosak', 'poster rasmi diconteng', 'kabel kamera dirosakkan'],
    actions: ['gambar bukti diambil', 'unit fasiliti dimaklumkan', 'kawasan ditanda untuk pembaikan', 'laporan vandalisme direkodkan'],
  },
  'Keselamatan Fizikal': {
    risk: 'Medium',
    locations: ['pintu belakang pejabat', 'pagar parkir', 'stor keselamatan', 'laluan kecemasan', 'bilik fail', 'tangga kecemasan'],
    events: ['pintu tidak berkunci', 'pagar terbuka', 'kunci mangga tidak dipasang', 'laluan kecemasan terhalang', 'pintu boleh dibuka tanpa kad', 'kawasan gelap'],
    actions: ['pintu dikunci semula', 'pegawai bertanggungjawab dimaklumkan', 'pemeriksaan keselamatan dibuat', 'catatan dibuat dalam buku laporan'],
  },
  'Kerosakan Kemudahan': {
    risk: 'Medium',
    locations: ['kawasan parkir', 'pos kawalan cctv', 'lif lg', 'lobi utama', 'koridor tingkat 3', 'pintu masuk'],
    events: ['lampu rosak', 'cctv tidak berfungsi', 'lif tidak beroperasi', 'interkom gagal berfungsi', 'sensor pintu rosak', 'pintu automatik tersekat'],
    actions: ['unit fasiliti dimaklumkan', 'aduan pembaikan direkodkan', 'laluan alternatif digunakan', 'pemantauan manual dibuat sementara'],
  },
};

function generateSyntheticSamples() {
  const shifts = ['syif pagi', 'syif petang', 'syif malam'];
  const guards = ['pengawal bertugas', 'anggota pos', 'ketua syif', 'petugas keselamatan'];
  const samples = [];
  for (const [category, profile] of Object.entries(operationProfiles)) {
    profile.locations.forEach((location, locationIndex) => {
      profile.events.forEach((event, eventIndex) => {
        const action = profile.actions[(locationIndex + eventIndex) % profile.actions.length];
        const shift = shifts[(locationIndex + eventIndex) % shifts.length];
        const guard = guards[(locationIndex * 2 + eventIndex) % guards.length];
        samples.push({
          text: `${guard} melaporkan ${event} di ${location} semasa ${shift}. ${action}.`,
          category,
          risk: profile.risk,
          synthetic: true,
        });
      });
    });
  }
  return samples;
}

function uniqueSamples(samples) {
  const seen = new Set();
  return samples.filter((sample) => {
    const key = `${cleanText(sample.text)}|${sample.category}|${sample.risk}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function trainModel(samples) {
  const categories = {};
  const vocabulary = new Set();
  const categoryRisk = {};

  for (const sample of samples) {
    if (!categories[sample.category]) {
      categories[sample.category] = { documentCount: 0, tokenCount: 0, tokens: {} };
      categoryRisk[sample.category] = {};
    }
    categories[sample.category].documentCount += 1;
    categoryRisk[sample.category][sample.risk] = (categoryRisk[sample.category][sample.risk] || 0) + 1;

    for (const token of tokenize(sample.text)) {
      vocabulary.add(token);
      categories[sample.category].tokenCount += 1;
      categories[sample.category].tokens[token] = (categories[sample.category].tokens[token] || 0) + 1;
    }
  }

  const totalDocuments = samples.length;
  const topTerms = {};
  const riskByCategory = {};
  for (const [category, data] of Object.entries(categories)) {
    topTerms[category] = Object.entries(data.tokens)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 16)
      .map(([token]) => token.replace(/_/g, ' '));
    riskByCategory[category] = Object.entries(categoryRisk[category]).sort((a, b) => b[1] - a[1])[0][0];
  }

  return {
    modelType: 'multinomial_naive_bayes',
    language: 'ms-MY',
    version: new Date().toISOString().slice(0, 10),
    trainedAt: new Date().toISOString(),
    totalDocuments,
    vocabulary: Array.from(vocabulary).sort(),
    categories,
    riskByCategory,
    topTerms,
  };
}

function predict(model, text) {
  const tokens = tokenize(text);
  const vocabularySize = model.vocabulary.length || 1;
  const scores = Object.entries(model.categories).map(([category, data]) => {
    let logScore = Math.log(data.documentCount / model.totalDocuments);
    for (const token of tokens) {
      const count = data.tokens[token] || 0;
      logScore += Math.log((count + 1) / (data.tokenCount + vocabularySize));
    }
    return { category, logScore };
  }).sort((a, b) => b.logScore - a.logScore);

  const max = scores[0]?.logScore || 0;
  const probabilities = scores.map((score) => ({ ...score, probability: Math.exp(score.logScore - max) }));
  const total = probabilities.reduce((sum, score) => sum + score.probability, 0) || 1;
  return probabilities.map((score) => ({ ...score, confidence: score.probability / total })).sort((a, b) => b.confidence - a.confidence);
}

function evaluate(model, samples) {
  let correctCategory = 0;
  let correctRisk = 0;
  const confusion = {};
  for (const sample of samples) {
    const prediction = predict(model, sample.text)[0];
    const risk = model.riskByCategory[prediction.category];
    if (prediction.category === sample.category) correctCategory += 1;
    if (risk === sample.risk) correctRisk += 1;
    confusion[sample.category] = confusion[sample.category] || {};
    confusion[sample.category][prediction.category] = (confusion[sample.category][prediction.category] || 0) + 1;
  }
  return {
    samples: samples.length,
    categoryAccuracy: samples.length ? Number((correctCategory / samples.length).toFixed(3)) : 0,
    riskAccuracy: samples.length ? Number((correctRisk / samples.length).toFixed(3)) : 0,
    confusion,
  };
}

function main() {
  const seedSamples = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const samples = uniqueSamples([...seedSamples, ...generateSyntheticSamples()]);
  const missing = samples.find((sample) => !sample.text || !sample.category || !sample.risk);
  if (missing) throw new Error('Every training sample must have text, category and risk');

  const { train, test } = splitSamples(samples);
  const model = trainModel(train);
  model.metrics = evaluate(model, test);
  model.trainingSet = {
    source: path.relative(path.join(__dirname, '..'), dataPath).replace(/\\/g, '/'),
    seedSamples: seedSamples.length,
    syntheticSamples: samples.length - seedSamples.length,
    trainSamples: train.length,
    testSamples: test.length,
  };

  fs.mkdirSync(modelDir, { recursive: true });
  fs.writeFileSync(modelPath, `${JSON.stringify(model, null, 2)}\n`);
  console.log(`Trained NLP model: ${modelPath}`);
  console.log(`Category accuracy: ${(model.metrics.categoryAccuracy * 100).toFixed(1)}%`);
  console.log(`Risk accuracy: ${(model.metrics.riskAccuracy * 100).toFixed(1)}%`);
}

main();
