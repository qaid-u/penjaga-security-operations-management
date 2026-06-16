require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;
const jwtSecret = process.env.JWT_SECRET || 'penjaga-dev-secret';
const uploadDir = path.join(__dirname, 'uploads');
const nlpModelPath = process.env.NLP_MODEL_PATH || path.join(__dirname, 'ml', 'model', 'nlp-model.json');
const loginAttempts = new Map();

fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    cb(null, allowed.includes(file.mimetype));
  },
});

const scheduleUpload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['text/csv', 'application/vnd.ms-excel', 'application/pdf'];
    cb(null, allowed.includes(file.mimetype) || file.originalname.toLowerCase().endsWith('.csv'));
  },
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE || 'penjaga_db',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
});

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    const log = {
      time: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration_ms: Date.now() - startedAt,
      ip: req.ip,
      user_id: req.user?.id_pengguna || null,
    };
    console.log(JSON.stringify(log));
  });
  next();
});
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(uploadDir));

if (process.env.NODE_ENV === 'production' && jwtSecret === 'penjaga-dev-secret') {
  throw new Error('JWT_SECRET mesti ditetapkan untuk production');
}

const roles = {
  admin: 'Pentadbir Sistem',
  chief: 'Ketua Pengawal',
  guard: 'Pengawal Keselamatan',
};

const nlpRules = [
  { category: 'Kebakaran', level: 'Critical', score: 92, keywords: ['kebakaran', 'asap', 'api', 'terbakar'] },
  { category: 'Pencerobohan', level: 'High', score: 78, keywords: ['pencerobohan', 'ceroboh', 'orang asing', 'masuk tanpa izin'] },
  { category: 'Pergaduhan', level: 'High', score: 72, keywords: ['pergaduhan', 'gaduh', 'kekecohan'] },
  { category: 'Kehilangan Aset', level: 'High', score: 70, keywords: ['kehilangan', 'hilang', 'curi', 'dicuri'] },
  { category: 'Vandalisme', level: 'Medium', score: 55, keywords: ['vandalisme', 'rosak', 'pecah', 'conteng'] },
  { category: 'Keselamatan Fizikal', level: 'Medium', score: 50, keywords: ['pintu terbuka', 'tidak berkunci', 'pagar terbuka'] },
  { category: 'Kerosakan Kemudahan', level: 'Medium', score: 42, keywords: ['lampu rosak', 'cctv rosak', 'lif rosak', 'elektrik rosak', 'lampu parking rosak'] },
  { category: 'Rondaan Biasa', level: 'Low', score: 12, keywords: ['rondaan selesai', 'keadaan terkawal', 'tiada insiden'] },
];

const nlpStopwords = new Set([
  'ada', 'adalah', 'akan', 'atau', 'bagi', 'dan', 'dari', 'dengan', 'di', 'dibuat', 'didapati',
  'dikesan', 'dilaporkan', 'dalam', 'ini', 'itu', 'ke', 'kepada', 'kerana', 'oleh', 'pada',
  'sebagai', 'semasa', 'serta', 'telah', 'terdapat', 'untuk', 'yang',
]);

let trainedNlpModel = null;

function loadTrainedNlpModel() {
  try {
    if (!fs.existsSync(nlpModelPath)) return null;
    const model = JSON.parse(fs.readFileSync(nlpModelPath, 'utf8'));
    if (!model.categories || !model.vocabulary) return null;
    return model;
  } catch (error) {
    console.warn(`NLP model could not be loaded: ${error.message}`);
    return null;
  }
}

trainedNlpModel = loadTrainedNlpModel();

function cleanText(text = '') {
  return text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenizeForModel(text = '') {
  const words = cleanText(text)
    .split(' ')
    .filter((word) => word.length > 2 && !nlpStopwords.has(word));
  const bigrams = [];
  for (let index = 0; index < words.length - 1; index += 1) {
    bigrams.push(`${words[index]}_${words[index + 1]}`);
  }
  return [...words, ...bigrams];
}

function levelFromScore(score) {
  if (score > 80) return 'Critical';
  if (score > 60) return 'High';
  if (score > 30) return 'Medium';
  return 'Low';
}

function strongPasswordError(password = '') {
  if (password.length < 10) return 'Kata laluan mesti sekurang-kurangnya 10 aksara';
  if (!/[A-Z]/.test(password)) return 'Kata laluan mesti mempunyai huruf besar';
  if (!/[a-z]/.test(password)) return 'Kata laluan mesti mempunyai huruf kecil';
  if (!/[0-9]/.test(password)) return 'Kata laluan mesti mempunyai nombor';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Kata laluan mesti mempunyai simbol';
  return '';
}

function loginRateLimit(req, res, next) {
  const key = `${req.ip}:${String(req.body?.username || '').toLowerCase()}`;
  const now = Date.now();
  const attempt = loginAttempts.get(key) || { count: 0, firstAt: now, blockedUntil: 0 };
  if (attempt.blockedUntil > now) {
    const waitSeconds = Math.ceil((attempt.blockedUntil - now) / 1000);
    return res.status(429).json({ message: `Terlalu banyak cubaan login. Cuba lagi dalam ${waitSeconds} saat` });
  }
  req.loginAttemptKey = key;
  req.loginAttempt = attempt.firstAt + 15 * 60 * 1000 < now ? { count: 0, firstAt: now, blockedUntil: 0 } : attempt;
  next();
}

function recordLoginFailure(req) {
  const attempt = req.loginAttempt || { count: 0, firstAt: Date.now(), blockedUntil: 0 };
  attempt.count += 1;
  if (attempt.count >= 5) attempt.blockedUntil = Date.now() + 15 * 60 * 1000;
  loginAttempts.set(req.loginAttemptKey, attempt);
}

function clearLoginFailures(req) {
  if (req.loginAttemptKey) loginAttempts.delete(req.loginAttemptKey);
}

function requiredStaffForShift(dateValue, shift) {
  const date = dateValue ? new Date(dateValue) : new Date();
  const isWeekend = [0, 6].includes(date.getDay());
  if (shift === 'Pagi') return isWeekend ? 12 : 24;
  if (shift === 'Petang') return 12;
  if (shift === 'Malam') return 12;
  return 0;
}

function toDateOnly(value) {
  if (!value) return null;
  return new Date(value).toISOString().slice(0, 10);
}

function addDays(dateValue, days) {
  const date = new Date(dateValue);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function defaultShiftTimes(shift) {
  if (shift === 'Pagi') return { masa_mula: '07:00', masa_tamat: '16:00' };
  if (shift === 'Petang') return { masa_mula: '14:45', masa_tamat: '23:45' };
  if (shift === 'Malam') return { masa_mula: '23:00', masa_tamat: '08:00' };
  if (shift === 'Office Hour') return { masa_mula: '07:00', masa_tamat: '17:00' };
  return { masa_mula: '07:00', masa_tamat: '16:00' };
}

async function getWeeklySchedule(client, id) {
  return (await client.query('select * from tbl_jadual_mingguan where id_jadual_mingguan = $1', [id])).rows[0];
}

function canEditWeeklySchedule(req, schedule) {
  if (!schedule) return false;
  if (req.user.peranan === roles.admin) return true;
  return req.user.peranan === roles.chief && schedule.status_jadual !== 'Dikunci';
}

async function checkAssignmentConflicts(client, payload, existingId = null) {
  const warnings = [];
  const critical = [];
  const schedule = await getWeeklySchedule(client, payload.id_jadual_mingguan);
  if (!schedule) critical.push('Jadual mingguan tidak dijumpai');
  const dutyDate = toDateOnly(payload.tarikh_tugas);
  if (schedule && (dutyDate < toDateOnly(schedule.tarikh_mula) || dutyDate > toDateOnly(schedule.tarikh_tamat))) {
    critical.push('Tarikh tugasan berada di luar julat minggu jadual');
  }
  const guard = (await client.query(
    `select p.status_akaun, r.nama_peranan from tbl_pengguna p join tbl_peranan r on r.id_peranan = p.id_peranan where p.id_pengguna = $1`,
    [payload.id_pengguna]
  )).rows[0];
  if (!guard || guard.nama_peranan !== roles.guard || guard.status_akaun !== 'Aktif') critical.push('Pengawal tidak aktif atau bukan Pengawal Keselamatan');
  const post = (await client.query('select status_pos from tbl_pos_kawalan where id_pos = $1', [payload.id_pos])).rows[0];
  if (!post || post.status_pos !== 'Aktif') critical.push('Pos kawalan tidak aktif atau tidak dijumpai');
  const overlaps = await client.query(
    `select j.*, pos.nama_pos
     from tbl_jadual_bertugas j join tbl_pos_kawalan pos on pos.id_pos = j.id_pos
     where j.id_pengguna = $1 and j.tarikh_tugas = $2 and ($6::int is null or j.id_jadual <> $6)
       and (($3::time < j.masa_tamat and $4::time > j.masa_mula) or j.syif = $5)`,
    [payload.id_pengguna, dutyDate, payload.masa_mula, payload.masa_tamat, payload.syif, existingId]
  );
  if (overlaps.rows.length) critical.push(`Pengawal sudah dijadualkan pada masa bertindih (${overlaps.rows[0].nama_pos})`);
  const samePost = await client.query(
    `select count(*)::int total from tbl_jadual_bertugas
     where id_pos = $1 and tarikh_tugas = $2 and syif = $3 and ($4::int is null or id_jadual <> $4)`,
    [payload.id_pos, dutyDate, payload.syif, existingId]
  );
  if (samePost.rows[0].total > 0) warnings.push('Pos ini sudah mempunyai pengawal untuk syif yang sama');
  return { ok: critical.length === 0, critical, warnings };
}

function scoreForPriority(priority) {
  if (priority === 'Critical') return 92;
  if (priority === 'High') return 76;
  if (priority === 'Medium') return 50;
  return 12;
}

function predictWithTrainedModel(text) {
  if (!trainedNlpModel) return null;
  const tokens = tokenizeForModel(text);
  if (!tokens.length) return null;
  const vocabularySize = trainedNlpModel.vocabulary.length || 1;
  const scores = Object.entries(trainedNlpModel.categories).map(([category, data]) => {
    let logScore = Math.log(data.documentCount / trainedNlpModel.totalDocuments);
    for (const token of tokens) {
      const count = data.tokens[token] || 0;
      logScore += Math.log((count + 1) / (data.tokenCount + vocabularySize));
    }
    return { category, logScore };
  }).sort((a, b) => b.logScore - a.logScore);
  const max = scores[0]?.logScore || 0;
  const probabilities = scores.map((score) => ({ ...score, probability: Math.exp(score.logScore - max) }));
  const total = probabilities.reduce((sum, score) => sum + score.probability, 0) || 1;
  const prediction = probabilities.map((score) => ({ ...score, confidence: score.probability / total })).sort((a, b) => b.confidence - a.confidence)[0];
  if (!prediction) return null;
  const risk = trainedNlpModel.riskByCategory[prediction.category] || 'Low';
  const topTerms = trainedNlpModel.topTerms[prediction.category] || [];
  const detectedTerms = topTerms.filter((term) => cleanText(text).includes(term.toLowerCase())).slice(0, 6);
  return {
    category: prediction.category,
    risk,
    score: scoreForPriority(risk),
    confidence: Number(prediction.confidence.toFixed(2)),
    detectedTerms,
  };
}

async function loadNlpRules(client) {
  const result = await client.query(
    `select nama_kategori, tahap_keutamaan, kata_kunci_rujukan
     from tbl_kategori_insiden
     where status_kategori = 'Aktif' and cardinality(kata_kunci_rujukan) > 0`
  );
  if (!result.rows.length) return nlpRules;
  return result.rows.map((row) => ({
    category: row.nama_kategori,
    level: row.tahap_keutamaan,
    score: scoreForPriority(row.tahap_keutamaan),
    keywords: row.kata_kunci_rujukan,
  }));
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let quoted = false;
  for (const char of line) {
    if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values.map((value) => value.replace(/^"|"$/g, ''));
}

function analyzeReport(text, rules = nlpRules) {
  const cleaned = cleanText(text);
  const mlPrediction = predictWithTrainedModel(text);
  const matches = [];
  for (const rule of rules) {
    const found = rule.keywords.filter((keyword) => cleaned.includes(keyword));
    if (found.length) matches.push({ ...rule, found });
  }
  matches.sort((a, b) => b.score - a.score || b.found.length - a.found.length);
  const ruleTop = matches[0] || rules.find((rule) => rule.level === 'Low') || nlpRules[nlpRules.length - 1];
  const useMl = mlPrediction && mlPrediction.confidence >= 0.48;
  const top = useMl
    ? { category: mlPrediction.category, level: mlPrediction.risk, score: mlPrediction.score }
    : ruleTop;
  const keywords = [...new Set([...matches.flatMap((match) => match.found), ...((useMl && mlPrediction.detectedTerms) || [])])];
  const score = Math.min(100, Math.max(top.score, top.score + Math.max(0, keywords.length - 1) * 3));
  const level = useMl ? top.level : levelFromScore(score);
  const words = cleaned.split(' ').slice(0, 18).join(' ');

  return {
    teks_diproses: cleaned,
    kata_kunci_dikesan: keywords.length ? keywords : ['tiada insiden'],
    kategori_dikesan: top.category,
    skor_sentimen: level === 'Low' ? 0.2 : level === 'Medium' ? -0.1 : -0.6,
    skor_risiko: score,
    tahap_risiko: level,
    ringkasan_automatik: `${top.category}: ${words}${cleaned.split(' ').length > 18 ? '...' : ''}`,
    tahap_keyakinan: useMl ? mlPrediction.confidence : Math.min(0.95, 0.55 + keywords.length * 0.12),
  };
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function sendCsv(res, filename, rows, columns) {
  const header = columns.map((column) => csvEscape(column.label)).join(',');
  const body = rows.map((row) => columns.map((column) => csvEscape(row[column.key])).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send([header, body].filter(Boolean).join('\n'));
}

async function audit(req, client, modul, action, description, recordId = null, status = 'Berjaya', oldValue = null, newValue = null) {
  const userId = req.user?.id_pengguna || null;
  await client.query(
    `insert into tbl_audit_trail
     (id_pengguna, modul_sistem, jenis_aktiviti, penerangan_aktiviti, rekod_terlibat, nilai_lama, nilai_baharu, alamat_ip, peranti_pengguna, status_aktiviti)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [userId, modul, action, description, recordId, oldValue && JSON.stringify(oldValue), newValue && JSON.stringify(newValue), req.ip || null, req.headers?.['user-agent'] || null, status]
  );
}

async function auditWithPool(req, modul, action, description, recordId = null, status = 'Berjaya', oldValue = null, newValue = null) {
  const client = await pool.connect();
  try {
    await audit(req, client, modul, action, description, recordId, status, oldValue, newValue);
  } finally {
    client.release();
  }
}

function signUser(user) {
  return jwt.sign({
    id_pengguna: user.id_pengguna,
    nama_pengguna: user.nama_pengguna,
    nama_penuh: user.nama_penuh,
    peranan: user.nama_peranan,
  }, jwtSecret, { expiresIn: '8h' });
}

async function auth(req, res, next) {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Token diperlukan' });
    req.user = jwt.verify(token, jwtSecret);
    const result = await pool.query(
      `select p.id_pengguna, p.status_akaun, r.nama_peranan
       from tbl_pengguna p join tbl_peranan r on r.id_peranan = p.id_peranan
       where p.id_pengguna = $1`,
      [req.user.id_pengguna]
    );
    const user = result.rows[0];
    if (!user || user.status_akaun !== 'Aktif') return res.status(401).json({ message: 'Akaun tidak aktif atau sesi tidak sah' });
    req.user.peranan = user.nama_peranan;
    next();
  } catch {
    res.status(401).json({ message: 'Sesi tidak sah' });
  }
}

const requireAuth = auth;

function requireAnyRole(...allowedRoles) {
  return async (req, res, next) => {
    if (!allowedRoles.includes(req.user.peranan)) {
      await auditWithPool(req, 'Keselamatan', 'Unauthorized access attempt', `${req.user.peranan} cuba akses ${req.method} ${req.originalUrl}`, null, 'Gagal');
      return res.status(403).json({ message: 'Anda tidak mempunyai kebenaran untuk mengakses halaman ini.' });
    }
    next();
  };
}

const requireRole = (role) => requireAnyRole(role);
const allow = requireAnyRole;

async function ensureProgressTable() {
  await pool.query(
    `create table if not exists tbl_progress_tindakan (
      id_progress serial primary key,
      id_tindakan int not null references tbl_tindakan_susulan(id_tindakan) on delete cascade,
      id_pengguna int not null references tbl_pengguna(id_pengguna),
      catatan_progress text not null,
      tarikh_progress timestamp not null default now(),
      dilihat_admin boolean not null default false
    )`
  );
  await pool.query('alter table tbl_laporan_harian add column if not exists perlu_tindakan_susulan boolean not null default false');
  await pool.query(
    `create table if not exists tbl_jadual_mingguan (
      id_jadual_mingguan serial primary key,
      tarikh_mula date not null,
      tarikh_tamat date not null,
      tajuk_jadual varchar(150),
      status_jadual varchar(30) not null default 'Draf',
      dicipta_oleh int references tbl_pengguna(id_pengguna),
      disahkan_oleh int references tbl_pengguna(id_pengguna),
      tarikh_dicipta timestamp not null default now(),
      tarikh_disahkan timestamp,
      catatan text
    )`
  );
  await pool.query(
    `create table if not exists tbl_jadual_bertugas (
      id_jadual serial primary key,
      id_jadual_mingguan int not null references tbl_jadual_mingguan(id_jadual_mingguan) on delete cascade,
      id_pengguna int not null references tbl_pengguna(id_pengguna),
      id_pos int not null references tbl_pos_kawalan(id_pos),
      tarikh_tugas date not null,
      syif varchar(30) not null,
      masa_mula time not null,
      masa_tamat time not null,
      status_bertugas varchar(30) not null default 'Dijadualkan',
      catatan text,
      dicipta_oleh int references tbl_pengguna(id_pengguna),
      tarikh_dicipta timestamp not null default now(),
      tarikh_kemaskini timestamp not null default now()
    )`
  );
  await pool.query(
    `create table if not exists tbl_keperluan_pos (
      id_keperluan serial primary key,
      id_pos int not null references tbl_pos_kawalan(id_pos) on delete cascade,
      syif varchar(30) not null,
      bilangan_diperlukan int not null default 1,
      status_aktif boolean not null default true,
      tarikh_dicipta timestamp not null default now(),
      unique(id_pos, syif)
    )`
  );
  await pool.query(
    `create table if not exists tbl_kehadiran_tugas (
      id_kehadiran serial primary key,
      id_jadual int not null references tbl_jadual_bertugas(id_jadual) on delete cascade,
      id_pengguna int not null references tbl_pengguna(id_pengguna),
      masa_check_in timestamp,
      masa_check_out timestamp,
      status_kehadiran varchar(30) not null default 'Belum Hadir',
      catatan text,
      tarikh_dicipta timestamp not null default now()
    )`
  );
  await pool.query(
    `create table if not exists tbl_fail_jadual (
      id_fail serial primary key,
      id_jadual_mingguan int not null references tbl_jadual_mingguan(id_jadual_mingguan) on delete cascade,
      nama_fail varchar(255),
      jenis_fail varchar(30),
      path_fail text,
      dimuat_naik_oleh int references tbl_pengguna(id_pengguna),
      tarikh_muat_naik timestamp not null default now()
    )`
  );
  await pool.query('create index if not exists idx_jadual_mingguan_dates on tbl_jadual_mingguan(tarikh_mula, tarikh_tamat)');
  await pool.query('create index if not exists idx_jadual_bertugas_week on tbl_jadual_bertugas(id_jadual_mingguan)');
  await pool.query('create index if not exists idx_jadual_bertugas_guard_time on tbl_jadual_bertugas(id_pengguna, tarikh_tugas, masa_mula, masa_tamat)');
  await pool.query(
    `insert into tbl_keperluan_pos (id_pos, syif, bilangan_diperlukan, status_aktif)
     select p.id_pos, s.syif,
       case when p.nama_pos = 'Pos Lobi Utama' and s.syif = 'Pagi' then 2 else 1 end,
       true
     from tbl_pos_kawalan p
     cross join (values ('Pagi'), ('Petang'), ('Malam')) as s(syif)
     where p.status_pos = 'Aktif'
     on conflict (id_pos, syif) do nothing`
  );
  await pool.query(
    `insert into tbl_keperluan_pos (id_pos, syif, bilangan_diperlukan, status_aktif)
     select id_pos, 'Office Hour', 1, true
     from tbl_pos_kawalan
     where status_pos = 'Aktif' and nama_pos in ('Pos UTC', 'Pos Pejabat Jurutulis', 'Pos Dewan Undangan Negeri')
     on conflict (id_pos, syif) do nothing`
  );
}

async function activeAdminCount(client) {
  const result = await client.query(
    `select count(*)::int as total
     from tbl_pengguna p join tbl_peranan r on r.id_peranan = p.id_peranan
     where r.nama_peranan = $1 and p.status_akaun = 'Aktif'`,
    [roles.admin]
  );
  return result.rows[0].total;
}

async function wouldRemoveActiveAdmin(client, userId, patch) {
  const current = (await client.query(
    `select p.id_pengguna, p.id_peranan, p.status_akaun, r.nama_peranan
     from tbl_pengguna p join tbl_peranan r on r.id_peranan = p.id_peranan
     where p.id_pengguna = $1`,
    [userId]
  )).rows[0];
  if (!current || current.nama_peranan !== roles.admin || current.status_akaun !== 'Aktif') return false;

  const nextRole = patch.id_peranan
    ? (await client.query('select nama_peranan from tbl_peranan where id_peranan = $1', [patch.id_peranan])).rows[0]?.nama_peranan
    : current.nama_peranan;
  const nextStatus = patch.status_akaun || current.status_akaun;
  const removingAdminAccess = nextRole !== roles.admin || nextStatus !== 'Aktif';
  return removingAdminAccess && (await activeAdminCount(client)) <= 1;
}

app.get('/api/health', async (req, res) => {
  const result = await pool.query('select now() as masa');
  res.json({ ok: true, database: result.rows[0].masa });
});

app.get('/api/ready', async (req, res) => {
  try {
    const result = await pool.query('select 1 as ok');
    res.json({
      ok: result.rows[0].ok === 1,
      database: 'connected',
      uptime_seconds: Math.round(process.uptime()),
      environment: process.env.NODE_ENV || 'development',
    });
  } catch (error) {
    res.status(503).json({ ok: false, database: 'unavailable', message: error.message });
  }
});

app.post('/api/auth/login', loginRateLimit, async (req, res) => {
  const client = await pool.connect();
  try {
    const { username, password } = req.body;
    const result = await client.query(
      `select p.id_pengguna, p.nama_penuh, p.emel, p.nama_pengguna, p.kata_laluan, p.status_akaun, r.nama_peranan
       from tbl_pengguna p join tbl_peranan r on r.id_peranan = p.id_peranan
       where p.nama_pengguna = $1 or p.emel = $1`,
      [username]
    );
    const user = result.rows[0];
    if (!user || user.status_akaun !== 'Aktif' || !(await bcrypt.compare(password, user.kata_laluan))) {
      recordLoginFailure(req);
      await audit(req, client, 'Autentikasi', 'Login failed', `Login gagal untuk ${username}`, null, 'Gagal');
      return res.status(401).json({ message: 'Nama pengguna atau kata laluan tidak sah' });
    }
    clearLoginFailures(req);
    await audit({ ...req, user }, client, 'Autentikasi', 'Login success', 'Pengguna berjaya log masuk');
    delete user.kata_laluan;
    res.json({ token: signUser(user), user });
  } finally {
    client.release();
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const result = await pool.query(
    `select p.id_pengguna, p.nama_penuh, p.emel, p.nama_pengguna, p.no_telefon, p.status_akaun, r.nama_peranan
     from tbl_pengguna p join tbl_peranan r on r.id_peranan = p.id_peranan where p.id_pengguna = $1`,
    [req.user.id_pengguna]
  );
  res.json(result.rows[0]);
});

app.post('/api/auth/change-password', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { currentPassword, newPassword } = req.body;
    const passwordError = strongPasswordError(newPassword || '');
    if (passwordError) return res.status(400).json({ message: passwordError });
    const result = await client.query('select kata_laluan from tbl_pengguna where id_pengguna = $1', [req.user.id_pengguna]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(currentPassword || '', user.kata_laluan))) {
      await audit(req, client, 'Autentikasi', 'Password change failed', 'Kata laluan semasa tidak sah', req.user.id_pengguna, 'Gagal');
      return res.status(401).json({ message: 'Kata laluan semasa tidak sah' });
    }
    const hashed = await bcrypt.hash(newPassword, 12);
    await client.query('update tbl_pengguna set kata_laluan = $1, tarikh_kemaskini = now() where id_pengguna = $2', [hashed, req.user.id_pengguna]);
    await audit(req, client, 'Autentikasi', 'Password changed', 'Kata laluan pengguna ditukar', req.user.id_pengguna);
    res.json({ ok: true });
  } finally {
    client.release();
  }
});

app.get('/api/meta', auth, async (req, res) => {
  const [posts, categories, checklist, rolesResult, guards] = await Promise.all([
    pool.query('select * from tbl_pos_kawalan order by nama_pos'),
    pool.query('select * from tbl_kategori_insiden where status_kategori = $1 order by nama_kategori', ['Aktif']),
    pool.query('select * from tbl_checklist where status_aktif = true order by id_checklist'),
    pool.query('select * from tbl_peranan order by tahap_capaian desc'),
    pool.query(
      `select p.id_pengguna, p.nama_penuh, p.nama_pengguna, p.no_telefon
       from tbl_pengguna p join tbl_peranan r on r.id_peranan = p.id_peranan
       where r.nama_peranan = $1 and p.status_akaun = 'Aktif'
       order by p.nama_penuh`,
      [roles.guard]
    ),
  ]);
  const categoriesForRole = req.user.peranan === roles.admin
    ? categories.rows
    : categories.rows.map((category) => {
      const safeCategory = { ...category };
      delete safeCategory.kata_kunci_rujukan;
      return safeCategory;
    });
  res.json({ posts: posts.rows, categories: categoriesForRole, checklist: checklist.rows, roles: rolesResult.rows, guards: guards.rows });
});

app.get('/api/nlp-training', auth, requireRole(roles.admin), async (req, res) => {
  const result = await pool.query(
    `select id_kategori_insiden, nama_kategori, tahap_keutamaan, penerangan_kategori, kata_kunci_rujukan, status_kategori
     from tbl_kategori_insiden order by nama_kategori`
  );
  res.json(result.rows);
});

app.post('/api/nlp-training', auth, allow(roles.admin), async (req, res) => {
  const client = await pool.connect();
  try {
    const keywords = Array.isArray(req.body.kata_kunci_rujukan)
      ? req.body.kata_kunci_rujukan
      : String(req.body.kata_kunci_rujukan || '').split(',').map((item) => item.trim()).filter(Boolean);
    const namaKategori = String(req.body.nama_kategori || '').trim();
    if (!namaKategori) return res.status(400).json({ message: 'Nama kategori NLP diperlukan' });
    const result = await client.query(
      `insert into tbl_kategori_insiden (nama_kategori, tahap_keutamaan, penerangan_kategori, kata_kunci_rujukan, status_kategori)
       values ($1,$2,$3,$4,$5) returning *`,
      [
        namaKategori,
        req.body.tahap_keutamaan || 'Low',
        req.body.penerangan_kategori || null,
        keywords,
        req.body.status_kategori || 'Aktif',
      ]
    );
    await audit(req, client, 'NLP Training', 'NLP rule created', 'Peraturan kata kunci NLP baharu diwujudkan', result.rows[0].id_kategori_insiden, 'Berjaya', null, result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'Nama kategori NLP sudah wujud' });
    res.status(500).json({ message: error.message });
  } finally {
    client.release();
  }
});

app.patch('/api/nlp-training/:id', auth, allow(roles.admin), async (req, res) => {
  const client = await pool.connect();
  try {
    const keywords = Array.isArray(req.body.kata_kunci_rujukan)
      ? req.body.kata_kunci_rujukan
      : String(req.body.kata_kunci_rujukan || '').split(',').map((item) => item.trim()).filter(Boolean);
    const oldRule = (await client.query('select * from tbl_kategori_insiden where id_kategori_insiden = $1', [req.params.id])).rows[0];
    const result = await client.query(
      `update tbl_kategori_insiden
       set nama_kategori = coalesce($1, nama_kategori),
           tahap_keutamaan = coalesce($2, tahap_keutamaan),
           penerangan_kategori = $3,
           kata_kunci_rujukan = $4,
           status_kategori = coalesce($5, status_kategori)
       where id_kategori_insiden = $6 returning *`,
      [
        req.body.nama_kategori ? String(req.body.nama_kategori).trim() : null,
        req.body.tahap_keutamaan || null,
        req.body.penerangan_kategori || null,
        keywords,
        req.body.status_kategori || null,
        req.params.id,
      ]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Kategori NLP tidak dijumpai' });
    await audit(req, client, 'NLP Training', 'NLP rule updated', 'Peraturan kata kunci NLP dikemaskini', req.params.id, 'Berjaya', oldRule, result.rows[0]);
    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'Nama kategori NLP sudah wujud' });
    res.status(500).json({ message: error.message });
  } finally {
    client.release();
  }
});

app.delete('/api/nlp-training/:id', auth, allow(roles.admin), async (req, res) => {
  const client = await pool.connect();
  try {
    const oldRule = (await client.query('select * from tbl_kategori_insiden where id_kategori_insiden = $1', [req.params.id])).rows[0];
    if (!oldRule) return res.status(404).json({ message: 'Kategori NLP tidak dijumpai' });
    const used = Number((await client.query('select count(*) from tbl_laporan_harian where id_kategori_insiden = $1', [req.params.id])).rows[0].count);
    let result;
    if (used > 0) {
      result = await client.query(
        `update tbl_kategori_insiden set status_kategori = 'Tidak Aktif' where id_kategori_insiden = $1 returning *`,
        [req.params.id]
      );
      await audit(req, client, 'NLP Training', 'NLP rule deactivated', 'Peraturan NLP dinyahaktif kerana sudah digunakan dalam laporan', req.params.id, 'Berjaya', oldRule, result.rows[0]);
      return res.json({ deleted: false, deactivated: true, rule: result.rows[0] });
    }
    result = await client.query('delete from tbl_kategori_insiden where id_kategori_insiden = $1 returning *', [req.params.id]);
    await audit(req, client, 'NLP Training', 'NLP rule deleted', 'Peraturan NLP dipadam', req.params.id, 'Berjaya', oldRule, null);
    res.json({ deleted: true, deactivated: false, rule: result.rows[0] });
  } finally {
    client.release();
  }
});

app.get('/api/reports', auth, async (req, res) => {
  const ownOnly = req.user.peranan === roles.guard;
  const result = await pool.query(
    `select l.*, p.nama_penuh, pos.nama_pos, k.nama_kategori, n.kata_kunci_dikesan, n.kategori_dikesan, n.skor_risiko, n.ringkasan_automatik,
       exists(select 1 from tbl_tindakan_susulan t where t.id_laporan = l.id_laporan) as ada_tindakan_susulan
     from tbl_laporan_harian l
     join tbl_pengguna p on p.id_pengguna = l.id_pengguna
     join tbl_pos_kawalan pos on pos.id_pos = l.id_pos
     left join tbl_kategori_insiden k on k.id_kategori_insiden = l.id_kategori_insiden
     left join tbl_hasil_nlp n on n.id_laporan = l.id_laporan
     where ($1::boolean = false or l.id_pengguna = $2)
     order by l.tarikh_dicipta desc`,
    [ownOnly, req.user.id_pengguna]
  );
  const canSeeNlp = req.user.peranan === roles.admin;
  res.json(result.rows.map((row) => {
    if (canSeeNlp) return row;
    const safeRow = { ...row };
    delete safeRow.kata_kunci_dikesan;
    delete safeRow.kategori_dikesan;
    delete safeRow.skor_risiko;
    delete safeRow.ringkasan_automatik;
    return safeRow;
  }));
});

app.get('/api/reports/export.csv', auth, allow(roles.admin, roles.chief), async (req, res) => {
  const result = await pool.query(
    `select l.id_laporan, l.tajuk_laporan, p.nama_penuh, pos.nama_pos, l.syif, l.tarikh_laporan,
      l.masa_laporan, l.status_laporan, l.tahap_risiko, n.kategori_dikesan, n.skor_risiko
     from tbl_laporan_harian l
     join tbl_pengguna p on p.id_pengguna = l.id_pengguna
     join tbl_pos_kawalan pos on pos.id_pos = l.id_pos
     left join tbl_hasil_nlp n on n.id_laporan = l.id_laporan
     order by l.tarikh_dicipta desc`
  );
  const columns = [
    { key: 'id_laporan', label: 'ID' },
    { key: 'tajuk_laporan', label: 'Tajuk' },
    { key: 'nama_penuh', label: 'Pengawal' },
    { key: 'nama_pos', label: 'Pos' },
    { key: 'syif', label: 'Syif' },
    { key: 'tarikh_laporan', label: 'Tarikh' },
    { key: 'masa_laporan', label: 'Masa' },
    { key: 'status_laporan', label: 'Status' },
    { key: 'tahap_risiko', label: 'Risiko' },
  ];
  if (req.user.peranan === roles.admin) {
    columns.push({ key: 'kategori_dikesan', label: 'Kategori NLP' }, { key: 'skor_risiko', label: 'Skor Risiko' });
  }
  sendCsv(res, 'laporan-harian.csv', result.rows, columns);
});

app.get('/api/nlp/:reportId', auth, allow(roles.admin), async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `select l.id_laporan, l.tajuk_laporan, l.kandungan_laporan, l.tahap_risiko as tahap_risiko_laporan,
        p.nama_penuh, pos.nama_pos, n.teks_diproses, n.kata_kunci_dikesan, n.kategori_dikesan,
        n.skor_sentimen, n.skor_risiko, n.tahap_risiko, n.ringkasan_automatik, n.tahap_keyakinan, n.tarikh_analisis
       from tbl_laporan_harian l
       join tbl_pengguna p on p.id_pengguna = l.id_pengguna
       join tbl_pos_kawalan pos on pos.id_pos = l.id_pos
       join tbl_hasil_nlp n on n.id_laporan = l.id_laporan
       where l.id_laporan = $1`,
      [req.params.reportId]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Analisis NLP tidak dijumpai' });
    await audit(req, client, 'NLP', 'NLP result viewed', 'Pentadbir melihat keputusan NLP laporan', req.params.reportId);
    res.json({ ...result.rows[0], explanation: `Analisis automatik berdasarkan kategori ${result.rows[0].kategori_dikesan}, kata kunci dikesan dan corak model ML/rule-based.` });
  } finally {
    client.release();
  }
});

app.get('/api/reports/:id', auth, async (req, res) => {
  const ownOnly = req.user.peranan === roles.guard;
  const report = await pool.query(
    `select l.*, p.nama_penuh, p.nama_pengguna, pos.nama_pos, pos.nama_bangunan, pos.lokasi, k.nama_kategori,
      n.teks_diproses, n.kata_kunci_dikesan, n.kategori_dikesan, n.skor_sentimen, n.skor_risiko,
      n.ringkasan_automatik, n.tahap_keyakinan, n.tarikh_analisis
     from tbl_laporan_harian l
     join tbl_pengguna p on p.id_pengguna = l.id_pengguna
     join tbl_pos_kawalan pos on pos.id_pos = l.id_pos
     left join tbl_kategori_insiden k on k.id_kategori_insiden = l.id_kategori_insiden
     left join tbl_hasil_nlp n on n.id_laporan = l.id_laporan
     where l.id_laporan = $1 and ($2::boolean = false or l.id_pengguna = $3)`,
    [req.params.id, ownOnly, req.user.id_pengguna]
  );
  if (!report.rows[0]) return res.status(404).json({ message: 'Laporan tidak dijumpai' });

  const [checklist, reviews, actions] = await Promise.all([
    pool.query(
      `select j.*, c.nama_checklist, c.kategori_checklist
       from tbl_jawapan_checklist j join tbl_checklist c on c.id_checklist = j.id_checklist
       where j.id_laporan = $1 order by c.id_checklist`,
      [req.params.id]
    ),
    pool.query(
      `select s.*, p.nama_penuh, r.nama_peranan
       from tbl_pengesahan_laporan s
       join tbl_pengguna p on p.id_pengguna = s.id_pengguna_pengesah
       join tbl_peranan r on r.id_peranan = p.id_peranan
       where s.id_laporan = $1 order by s.tarikh_pengesahan desc`,
      [req.params.id]
    ),
    pool.query('select * from tbl_tindakan_susulan where id_laporan = $1 order by tarikh_kemaskini desc', [req.params.id]),
  ]);

  const safeReport = { ...report.rows[0] };
  if (req.user.peranan !== roles.admin) {
    delete safeReport.teks_diproses;
    delete safeReport.kata_kunci_dikesan;
    delete safeReport.kategori_dikesan;
    delete safeReport.skor_sentimen;
    delete safeReport.skor_risiko;
    delete safeReport.ringkasan_automatik;
    delete safeReport.tahap_keyakinan;
    delete safeReport.tarikh_analisis;
  }
  res.json({ report: safeReport, checklist: checklist.rows, reviews: reviews.rows, actions: actions.rows });
});

app.post('/api/reports', auth, allow(roles.guard), upload.single('lampiran_fail'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const { id_pos, id_kategori_insiden, tajuk_laporan, syif, tarikh_laporan, masa_laporan, kandungan_laporan } = req.body;
    const checklist = typeof req.body.checklist === 'string' ? JSON.parse(req.body.checklist || '[]') : req.body.checklist || [];
    const lampiranFail = req.file ? `/uploads/${req.file.filename}` : null;
    if (!id_pos || !tajuk_laporan || !syif || !tarikh_laporan || !masa_laporan || !kandungan_laporan) {
      return res.status(400).json({ message: 'Sila lengkapkan maklumat laporan' });
    }
    const nlp = analyzeReport(kandungan_laporan, await loadNlpRules(client));
    const report = await client.query(
      `insert into tbl_laporan_harian
       (id_pengguna, id_pos, id_kategori_insiden, tajuk_laporan, syif, tarikh_laporan, masa_laporan, kandungan_laporan, status_laporan, tahap_risiko, lampiran_fail)
       values ($1,$2,$3,$4,$5,$6,$7,$8,'Dihantar',$9,$10) returning *`,
      [req.user.id_pengguna, id_pos, id_kategori_insiden || null, tajuk_laporan, syif, tarikh_laporan, masa_laporan, kandungan_laporan, nlp.tahap_risiko, lampiranFail]
    );
    const idLaporan = report.rows[0].id_laporan;
    await client.query(
      `insert into tbl_hasil_nlp
       (id_laporan, teks_diproses, kata_kunci_dikesan, kategori_dikesan, skor_sentimen, skor_risiko, tahap_risiko, ringkasan_automatik, tahap_keyakinan)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [idLaporan, nlp.teks_diproses, nlp.kata_kunci_dikesan, nlp.kategori_dikesan, nlp.skor_sentimen, nlp.skor_risiko, nlp.tahap_risiko, nlp.ringkasan_automatik, nlp.tahap_keyakinan]
    );
    for (const item of checklist) {
      await client.query('insert into tbl_jawapan_checklist (id_laporan, id_checklist, jawapan, catatan) values ($1,$2,$3,$4)', [idLaporan, item.id_checklist, item.jawapan, item.catatan || null]);
    }
    if (['High', 'Critical'].includes(nlp.tahap_risiko)) {
      await client.query(
        `insert into tbl_notifikasi (id_pengguna, tajuk_notifikasi, mesej_notifikasi, jenis_notifikasi, tahap_keutamaan)
         select id_pengguna, $1, $2, 'Risiko Tinggi', $3 from tbl_pengguna p join tbl_peranan r on r.id_peranan = p.id_peranan where r.nama_peranan = $4`,
        ['Laporan berisiko tinggi', `${tajuk_laporan} diklasifikasi sebagai ${nlp.tahap_risiko}`, nlp.tahap_risiko, roles.chief]
      );
    }
    await audit(req, client, 'Laporan Harian', 'Submit daily report', 'Laporan harian dihantar', idLaporan, 'Berjaya', null, report.rows[0]);
    await audit(req, client, 'NLP', 'NLP analysis completed', trainedNlpModel ? 'Analisis NLP model ML selesai' : 'Analisis NLP rule-based selesai', idLaporan);
    await client.query('commit');
    res.status(201).json({ report: report.rows[0] });
  } catch (error) {
    await client.query('rollback');
    res.status(500).json({ message: error.message });
  } finally {
    client.release();
  }
});

app.patch('/api/reports/:id/review', auth, allow(roles.chief), async (req, res) => {
  const client = await pool.connect();
  try {
    const { status, comment, requiresFollowUp } = req.body;
    const statusMap = { approved: 'Diluluskan', rejected: 'Ditolak' };
    if (!statusMap[status]) return res.status(400).json({ message: 'Status semakan tidak sah' });
    await client.query('begin');
    const oldReport = (await client.query('select * from tbl_laporan_harian where id_laporan = $1', [req.params.id])).rows[0];
    const needsFollowUp = status === 'approved' && Boolean(requiresFollowUp);
    const report = await client.query(
      'update tbl_laporan_harian set status_laporan = $1, perlu_tindakan_susulan = $2, tarikh_kemaskini = now() where id_laporan = $3 returning *',
      [statusMap[status], needsFollowUp, req.params.id]
    );
    await client.query('insert into tbl_pengesahan_laporan (id_laporan, id_pengguna_pengesah, status_pengesahan, catatan_pengesahan) values ($1,$2,$3,$4)', [req.params.id, req.user.id_pengguna, statusMap[status], comment || null]);
    await client.query(
      `insert into tbl_notifikasi (id_pengguna, tajuk_notifikasi, mesej_notifikasi, jenis_notifikasi, tahap_keutamaan)
       values ($1,$2,$3,$4,$5)`,
      [
        oldReport.id_pengguna,
        status === 'approved' ? 'Laporan diluluskan' : 'Laporan ditolak',
        status === 'approved'
          ? `${oldReport.tajuk_laporan} telah diluluskan oleh Ketua Pengawal.`
          : `${oldReport.tajuk_laporan} ditolak. Sila semak catatan Ketua Pengawal dan hantar laporan baharu jika perlu.`,
        'Semakan Laporan',
        status === 'approved' ? 'Low' : 'Medium',
      ]
    );
    if (needsFollowUp) {
      await client.query(
        `insert into tbl_notifikasi (id_pengguna, tajuk_notifikasi, mesej_notifikasi, jenis_notifikasi, tahap_keutamaan)
         select id_pengguna, $1, $2, $3, $4
         from tbl_pengguna p join tbl_peranan r on r.id_peranan = p.id_peranan
         where r.nama_peranan = $5`,
        [
          'Tindakan susulan diperlukan',
          `${oldReport.tajuk_laporan} telah diluluskan dan Ketua menetapkan tindakan susulan diperlukan.`,
          'Tindakan Susulan',
          oldReport.tahap_risiko,
          roles.admin,
        ]
      );
    }
    await audit(req, client, 'Semakan Laporan', status === 'approved' ? 'Report approved' : 'Report rejected', `Laporan ${statusMap[status]}`, req.params.id, 'Berjaya', oldReport, report.rows[0]);
    await client.query('commit');
    res.json(report.rows[0]);
  } catch (error) {
    await client.query('rollback');
    res.status(500).json({ message: error.message });
  } finally {
    client.release();
  }
});

app.get('/api/actions', auth, allow(roles.admin, roles.chief), async (req, res) => {
  const result = await pool.query(
    `select t.*, l.tajuk_laporan, l.tahap_risiko, l.tarikh_laporan, l.status_laporan,
       p.nama_penuh, pos.nama_pos,
       coalesce(progress.items, '[]'::json) as progress_notes
     from tbl_tindakan_susulan t
     join tbl_laporan_harian l on l.id_laporan = t.id_laporan
     join tbl_pengguna p on p.id_pengguna = l.id_pengguna
     join tbl_pos_kawalan pos on pos.id_pos = l.id_pos
     left join lateral (
       select json_agg(json_build_object(
         'id_progress', pr.id_progress,
         'catatan_progress', pr.catatan_progress,
         'tarikh_progress', pr.tarikh_progress,
         'dilihat_admin', pr.dilihat_admin,
         'nama_penuh', u.nama_penuh,
         'nama_peranan', r.nama_peranan
       ) order by pr.tarikh_progress desc) as items
       from tbl_progress_tindakan pr
       join tbl_pengguna u on u.id_pengguna = pr.id_pengguna
       join tbl_peranan r on r.id_peranan = u.id_peranan
       where pr.id_tindakan = t.id_tindakan
     ) progress on true
     order by t.tarikh_kemaskini desc`
  );
  res.json(result.rows);
});

app.post('/api/actions', auth, allow(roles.admin), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id_laporan, pegawai_bertanggungjawab, tindakan_diambil, tahap_keutamaan, tarikh_mula, tarikh_selesai, catatan_tindakan } = req.body;
    const result = await client.query(
      `insert into tbl_tindakan_susulan
       (id_laporan, pegawai_bertanggungjawab, tindakan_diambil, status_tindakan, tahap_keutamaan, tarikh_mula, tarikh_selesai, catatan_tindakan)
       values ($1,$2,$3,'Baru',$4,$5,$6,$7) returning *`,
      [id_laporan, pegawai_bertanggungjawab, tindakan_diambil, tahap_keutamaan || 'Medium', tarikh_mula || new Date(), tarikh_selesai || null, catatan_tindakan || null]
    );
    await audit(req, client, 'Tindakan Susulan', 'Follow-up action created', 'Tindakan susulan diwujudkan', result.rows[0].id_tindakan);
    res.status(201).json(result.rows[0]);
  } finally {
    client.release();
  }
});

app.post('/api/actions/:id/progress', auth, allow(roles.chief), async (req, res) => {
  const client = await pool.connect();
  try {
    const { catatan_progress } = req.body;
    if (!catatan_progress || !String(catatan_progress).trim()) return res.status(400).json({ message: 'Catatan progress diperlukan' });
    const action = (await client.query('select * from tbl_tindakan_susulan where id_tindakan = $1', [req.params.id])).rows[0];
    if (!action) return res.status(404).json({ message: 'Tindakan susulan tidak dijumpai' });
    const result = await client.query(
      `insert into tbl_progress_tindakan (id_tindakan, id_pengguna, catatan_progress)
       values ($1,$2,$3) returning *`,
      [req.params.id, req.user.id_pengguna, catatan_progress.trim()]
    );
    await client.query(
      `insert into tbl_notifikasi (id_pengguna, tajuk_notifikasi, mesej_notifikasi, jenis_notifikasi, tahap_keutamaan)
       select id_pengguna, $1, $2, 'Tindakan Susulan', 'Medium'
       from tbl_pengguna p join tbl_peranan r on r.id_peranan = p.id_peranan
       where r.nama_peranan = $3`,
      ['Progress tindakan dikemaskini', `Ketua Pengawal menghantar progress untuk tindakan #${req.params.id}.`, roles.admin]
    );
    await audit(req, client, 'Tindakan Susulan', 'Follow-up progress submitted', 'Ketua Pengawal menghantar catatan progress untuk semakan Admin', req.params.id, 'Berjaya', null, result.rows[0]);
    res.status(201).json(result.rows[0]);
  } finally {
    client.release();
  }
});

app.patch('/api/actions/:id', auth, allow(roles.admin), async (req, res) => {
  const client = await pool.connect();
  try {
    const oldValue = (await client.query('select * from tbl_tindakan_susulan where id_tindakan = $1', [req.params.id])).rows[0];
    const result = await client.query(
      `update tbl_tindakan_susulan set status_tindakan = coalesce($1,status_tindakan), catatan_tindakan = coalesce($2,catatan_tindakan), tarikh_selesai = $3, tarikh_kemaskini = now()
       where id_tindakan = $4 returning *`,
      [req.body.status_tindakan, req.body.catatan_tindakan, req.body.status_tindakan === 'Selesai' ? new Date() : oldValue.tarikh_selesai, req.params.id]
    );
    await client.query('update tbl_progress_tindakan set dilihat_admin = true where id_tindakan = $1', [req.params.id]);
    await audit(req, client, 'Tindakan Susulan', 'Follow-up status changed by Admin', 'Status rasmi tindakan susulan dikemas kini oleh Admin', req.params.id, 'Berjaya', oldValue, result.rows[0]);
    res.json(result.rows[0]);
  } finally {
    client.release();
  }
});

app.get('/api/jadual/mingguan', auth, allow(roles.admin, roles.chief), async (req, res) => {
  const result = await pool.query(
    `select j.*, creator.nama_penuh dicipta_oleh_nama, confirmer.nama_penuh disahkan_oleh_nama,
      (select count(*)::int from tbl_jadual_bertugas a where a.id_jadual_mingguan = j.id_jadual_mingguan) jumlah_tugasan
     from tbl_jadual_mingguan j
     left join tbl_pengguna creator on creator.id_pengguna = j.dicipta_oleh
     left join tbl_pengguna confirmer on confirmer.id_pengguna = j.disahkan_oleh
     order by j.tarikh_mula desc`
  );
  res.json(result.rows);
});

app.post('/api/jadual/mingguan', auth, allow(roles.admin, roles.chief), async (req, res) => {
  const client = await pool.connect();
  try {
    const tarikhMula = req.body.tarikh_mula;
    if (!tarikhMula) return res.status(400).json({ message: 'Tarikh mula minggu diperlukan' });
    const tarikhTamat = addDays(tarikhMula, 6);
    const result = await client.query(
      `insert into tbl_jadual_mingguan (tarikh_mula, tarikh_tamat, tajuk_jadual, catatan, dicipta_oleh)
       values ($1,$2,$3,$4,$5) returning *`,
      [tarikhMula, tarikhTamat, req.body.tajuk_jadual || `Jadual Mingguan ${tarikhMula}`, req.body.catatan || null, req.user.id_pengguna]
    );
    await audit(req, client, 'Jadual Bertugas', 'Weekly schedule created', 'Jadual mingguan draf diwujudkan', result.rows[0].id_jadual_mingguan, 'Berjaya', null, result.rows[0]);
    res.status(201).json(result.rows[0]);
  } finally {
    client.release();
  }
});

app.get('/api/jadual/mingguan/:id', auth, allow(roles.admin, roles.chief), async (req, res) => {
  const schedule = await getWeeklySchedule(pool, req.params.id);
  if (!schedule) return res.status(404).json({ message: 'Jadual mingguan tidak dijumpai' });
  const files = await pool.query('select * from tbl_fail_jadual where id_jadual_mingguan = $1 order by tarikh_muat_naik desc', [req.params.id]);
  res.json({ ...schedule, files: files.rows });
});

app.put('/api/jadual/mingguan/:id', auth, allow(roles.admin, roles.chief), async (req, res) => {
  const client = await pool.connect();
  try {
    const oldValue = await getWeeklySchedule(client, req.params.id);
    if (!oldValue) return res.status(404).json({ message: 'Jadual mingguan tidak dijumpai' });
    if (!canEditWeeklySchedule(req, oldValue)) return res.status(403).json({ message: 'Jadual dikunci. Minta Admin buka kunci dahulu.' });
    const tarikhMula = req.body.tarikh_mula || toDateOnly(oldValue.tarikh_mula);
    const result = await client.query(
      `update tbl_jadual_mingguan set tarikh_mula = $1, tarikh_tamat = $2, tajuk_jadual = coalesce($3,tajuk_jadual), catatan = $4
       where id_jadual_mingguan = $5 returning *`,
      [tarikhMula, addDays(tarikhMula, 6), req.body.tajuk_jadual || null, req.body.catatan || null, req.params.id]
    );
    await audit(req, client, 'Jadual Bertugas', 'Weekly schedule updated', 'Jadual mingguan dikemaskini', req.params.id, 'Berjaya', oldValue, result.rows[0]);
    res.json(result.rows[0]);
  } finally {
    client.release();
  }
});

app.post('/api/jadual/mingguan/:id/confirm', auth, allow(roles.admin), async (req, res) => {
  const client = await pool.connect();
  try {
    const oldValue = await getWeeklySchedule(client, req.params.id);
    if (!oldValue) return res.status(404).json({ message: 'Jadual mingguan tidak dijumpai' });
    const result = await client.query(
      `update tbl_jadual_mingguan set status_jadual = 'Disahkan', disahkan_oleh = $1, tarikh_disahkan = now()
       where id_jadual_mingguan = $2 returning *`,
      [req.user.id_pengguna, req.params.id]
    );
    await audit(req, client, 'Jadual Bertugas', 'Schedule confirmed', 'Jadual mingguan disahkan Admin', req.params.id, 'Berjaya', oldValue, result.rows[0]);
    res.json(result.rows[0]);
  } finally {
    client.release();
  }
});

app.post('/api/jadual/mingguan/:id/lock', auth, allow(roles.admin), async (req, res) => {
  const client = await pool.connect();
  try {
    const oldValue = await getWeeklySchedule(client, req.params.id);
    if (!oldValue) return res.status(404).json({ message: 'Jadual mingguan tidak dijumpai' });
    const result = await client.query("update tbl_jadual_mingguan set status_jadual = 'Dikunci' where id_jadual_mingguan = $1 returning *", [req.params.id]);
    await audit(req, client, 'Jadual Bertugas', 'Schedule locked', 'Jadual mingguan dikunci Admin', req.params.id, 'Berjaya', oldValue, result.rows[0]);
    res.json(result.rows[0]);
  } finally {
    client.release();
  }
});

app.post('/api/jadual/mingguan/:id/unlock', auth, allow(roles.admin), async (req, res) => {
  const client = await pool.connect();
  try {
    const oldValue = await getWeeklySchedule(client, req.params.id);
    if (!oldValue) return res.status(404).json({ message: 'Jadual mingguan tidak dijumpai' });
    const result = await client.query("update tbl_jadual_mingguan set status_jadual = 'Draf' where id_jadual_mingguan = $1 returning *", [req.params.id]);
    await audit(req, client, 'Jadual Bertugas', 'Schedule unlocked', 'Jadual mingguan dibuka kunci Admin', req.params.id, 'Berjaya', oldValue, result.rows[0]);
    res.json(result.rows[0]);
  } finally {
    client.release();
  }
});

app.get('/api/jadual/mingguan/:id/assignments', auth, allow(roles.admin, roles.chief), async (req, res) => {
  const result = await pool.query(
    `select j.*, p.nama_penuh, p.nama_pengguna, pos.nama_pos, pos.nama_bangunan, pos.lokasi,
      k.status_kehadiran, k.masa_check_in, k.masa_check_out
     from tbl_jadual_bertugas j
     join tbl_pengguna p on p.id_pengguna = j.id_pengguna
     join tbl_pos_kawalan pos on pos.id_pos = j.id_pos
     left join tbl_kehadiran_tugas k on k.id_jadual = j.id_jadual
     where j.id_jadual_mingguan = $1
     order by j.tarikh_tugas, j.syif, pos.nama_pos, p.nama_penuh`,
    [req.params.id]
  );
  res.json(result.rows);
});

app.post('/api/jadual/check-conflict', auth, allow(roles.admin, roles.chief), async (req, res) => {
  const payload = { ...req.body, masa_mula: req.body.masa_mula || defaultShiftTimes(req.body.syif).masa_mula, masa_tamat: req.body.masa_tamat || defaultShiftTimes(req.body.syif).masa_tamat };
  const result = await checkAssignmentConflicts(pool, payload, req.body.id_jadual || null);
  if (!result.ok) await auditWithPool(req, 'Jadual Bertugas', 'Schedule conflict detected', result.critical.join('; '), payload.id_jadual_mingguan, 'Gagal');
  res.json(result);
});

app.post('/api/jadual/mingguan/:id/assignments', auth, allow(roles.admin, roles.chief), async (req, res) => {
  const client = await pool.connect();
  try {
    const schedule = await getWeeklySchedule(client, req.params.id);
    if (!schedule) return res.status(404).json({ message: 'Jadual mingguan tidak dijumpai' });
    if (!canEditWeeklySchedule(req, schedule)) return res.status(403).json({ message: 'Jadual dikunci. Minta Admin buka kunci dahulu.' });
    const times = defaultShiftTimes(req.body.syif);
    const payload = {
      id_jadual_mingguan: Number(req.params.id),
      id_pengguna: Number(req.body.id_pengguna),
      id_pos: Number(req.body.id_pos),
      tarikh_tugas: req.body.tarikh_tugas,
      syif: req.body.syif,
      masa_mula: req.body.masa_mula || times.masa_mula,
      masa_tamat: req.body.masa_tamat || times.masa_tamat,
    };
    const conflicts = await checkAssignmentConflicts(client, payload);
    if (!conflicts.ok) return res.status(409).json({ message: conflicts.critical.join('. '), conflicts });
    const result = await client.query(
      `insert into tbl_jadual_bertugas (id_jadual_mingguan, id_pengguna, id_pos, tarikh_tugas, syif, masa_mula, masa_tamat, catatan, dicipta_oleh)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
      [payload.id_jadual_mingguan, payload.id_pengguna, payload.id_pos, payload.tarikh_tugas, payload.syif, payload.masa_mula, payload.masa_tamat, req.body.catatan || null, req.user.id_pengguna]
    );
    await client.query('insert into tbl_kehadiran_tugas (id_jadual, id_pengguna) values ($1,$2)', [result.rows[0].id_jadual, payload.id_pengguna]);
    await audit(req, client, 'Jadual Bertugas', 'Guard assigned to post', 'Pengawal ditugaskan ke pos dalam jadual mingguan', result.rows[0].id_jadual, 'Berjaya', null, result.rows[0]);
    res.status(201).json({ assignment: result.rows[0], warnings: conflicts.warnings });
  } finally {
    client.release();
  }
});

app.put('/api/jadual/assignments/:id', auth, allow(roles.admin, roles.chief), async (req, res) => {
  const client = await pool.connect();
  try {
    const oldValue = (await client.query('select * from tbl_jadual_bertugas where id_jadual = $1', [req.params.id])).rows[0];
    if (!oldValue) return res.status(404).json({ message: 'Tugasan jadual tidak dijumpai' });
    const schedule = await getWeeklySchedule(client, oldValue.id_jadual_mingguan);
    if (!canEditWeeklySchedule(req, schedule)) return res.status(403).json({ message: 'Jadual dikunci. Minta Admin buka kunci dahulu.' });
    const payload = {
      id_jadual_mingguan: oldValue.id_jadual_mingguan,
      id_pengguna: Number(req.body.id_pengguna || oldValue.id_pengguna),
      id_pos: Number(req.body.id_pos || oldValue.id_pos),
      tarikh_tugas: req.body.tarikh_tugas || toDateOnly(oldValue.tarikh_tugas),
      syif: req.body.syif || oldValue.syif,
      masa_mula: req.body.masa_mula || oldValue.masa_mula,
      masa_tamat: req.body.masa_tamat || oldValue.masa_tamat,
    };
    const conflicts = await checkAssignmentConflicts(client, payload, Number(req.params.id));
    if (!conflicts.ok) return res.status(409).json({ message: conflicts.critical.join('. '), conflicts });
    const result = await client.query(
      `update tbl_jadual_bertugas set id_pengguna=$1, id_pos=$2, tarikh_tugas=$3, syif=$4, masa_mula=$5, masa_tamat=$6,
       catatan=$7, tarikh_kemaskini=now() where id_jadual=$8 returning *`,
      [payload.id_pengguna, payload.id_pos, payload.tarikh_tugas, payload.syif, payload.masa_mula, payload.masa_tamat, req.body.catatan || null, req.params.id]
    );
    await client.query('update tbl_kehadiran_tugas set id_pengguna = $1 where id_jadual = $2', [payload.id_pengguna, req.params.id]);
    await audit(req, client, 'Jadual Bertugas', 'Assignment edited', 'Tugasan jadual dikemaskini', req.params.id, 'Berjaya', oldValue, result.rows[0]);
    res.json({ assignment: result.rows[0], warnings: conflicts.warnings });
  } finally {
    client.release();
  }
});

app.delete('/api/jadual/assignments/:id', auth, allow(roles.admin, roles.chief), async (req, res) => {
  const client = await pool.connect();
  try {
    const oldValue = (await client.query('select * from tbl_jadual_bertugas where id_jadual = $1', [req.params.id])).rows[0];
    if (!oldValue) return res.status(404).json({ message: 'Tugasan jadual tidak dijumpai' });
    const schedule = await getWeeklySchedule(client, oldValue.id_jadual_mingguan);
    if (req.user.peranan === roles.chief && schedule.status_jadual !== 'Draf') return res.status(403).json({ message: 'Ketua hanya boleh padam tugasan draf.' });
    if (schedule.status_jadual === 'Dikunci' && req.user.peranan !== roles.admin) return res.status(403).json({ message: 'Jadual dikunci.' });
    await client.query('delete from tbl_jadual_bertugas where id_jadual = $1', [req.params.id]);
    await audit(req, client, 'Jadual Bertugas', 'Assignment deleted', 'Tugasan jadual dipadam', req.params.id, 'Berjaya', oldValue, null);
    res.json({ ok: true });
  } finally {
    client.release();
  }
});

app.get('/api/jadual/mingguan/:id/coverage-summary', auth, allow(roles.admin, roles.chief), async (req, res) => {
  const schedule = await getWeeklySchedule(pool, req.params.id);
  if (!schedule) return res.status(404).json({ message: 'Jadual mingguan tidak dijumpai' });
  const coverage = await pool.query(
    `select pos.id_pos, pos.nama_pos, k.syif, k.bilangan_diperlukan required,
      coalesce(count(j.id_jadual),0)::int assigned,
      coalesce(json_agg(json_build_object(
        'id_jadual', j.id_jadual,
        'id_pengguna', j.id_pengguna,
        'nama_penuh', u.nama_penuh,
        'tarikh_tugas', j.tarikh_tugas,
        'masa_mula', j.masa_mula,
        'masa_tamat', j.masa_tamat,
        'status_bertugas', j.status_bertugas,
        'catatan', j.catatan
      ) order by j.tarikh_tugas, u.nama_penuh) filter (where j.id_jadual is not null), '[]') assigned_guards
     from tbl_keperluan_pos k
     join tbl_pos_kawalan pos on pos.id_pos = k.id_pos
     left join tbl_jadual_bertugas j on j.id_pos = k.id_pos and j.syif = k.syif and j.id_jadual_mingguan = $1
     left join tbl_pengguna u on u.id_pengguna = j.id_pengguna
     where k.status_aktif = true and pos.status_pos = 'Aktif'
     group by pos.id_pos, pos.nama_pos, k.syif, k.bilangan_diperlukan
     order by pos.nama_pos, k.syif`,
    [req.params.id]
  );
  const attendance = await pool.query(
    `select
      count(*) filter (where j.status_bertugas = 'Hadir')::int active,
      count(*) filter (where j.status_bertugas = 'Tidak Hadir')::int absent
     from tbl_jadual_bertugas j where j.id_jadual_mingguan = $1`,
    [req.params.id]
  );
  const rows = coverage.rows;
  const totalRequired = rows.reduce((sum, row) => sum + Number(row.required), 0);
  const totalAssigned = rows.reduce((sum, row) => sum + Number(row.assigned), 0);
  const uncoveredPosts = rows.filter((row) => Number(row.assigned) === 0);
  const byShift = rows.reduce((acc, row) => {
    acc[row.syif] = acc[row.syif] || { shift: row.syif, required: 0, assigned: 0, shortage: 0 };
    acc[row.syif].required += Number(row.required);
    acc[row.syif].assigned += Number(row.assigned);
    acc[row.syif].shortage += Math.max(0, Number(row.required) - Number(row.assigned));
    return acc;
  }, {});
  res.json({
    totalRequired,
    totalAssigned,
    shortage: rows.reduce((sum, row) => sum + Math.max(0, Number(row.required) - Number(row.assigned)), 0),
    uncoveredPosts,
    coverageByPost: rows,
    coverageByShift: Object.values(byShift),
    activeDutyCount: attendance.rows[0].active,
    absentGuardCount: attendance.rows[0].absent,
  });
});

app.get('/api/jadual/my-schedule', auth, allow(roles.guard), async (req, res) => {
  const result = await pool.query(
    `select j.*, m.tajuk_jadual, m.status_jadual, pos.nama_pos, pos.nama_bangunan, pos.lokasi,
      k.status_kehadiran, k.masa_check_in, k.masa_check_out
     from tbl_jadual_bertugas j
     join tbl_jadual_mingguan m on m.id_jadual_mingguan = j.id_jadual_mingguan
     join tbl_pos_kawalan pos on pos.id_pos = j.id_pos
     left join tbl_kehadiran_tugas k on k.id_jadual = j.id_jadual
     where j.id_pengguna = $1
     order by j.tarikh_tugas desc, j.masa_mula`,
    [req.user.id_pengguna]
  );
  res.json(result.rows);
});

app.post('/api/jadual/assignments/:id/check-in', auth, allow(roles.guard), async (req, res) => {
  const client = await pool.connect();
  try {
    const assignment = (await client.query('select * from tbl_jadual_bertugas where id_jadual = $1 and id_pengguna = $2', [req.params.id, req.user.id_pengguna])).rows[0];
    if (!assignment) return res.status(404).json({ message: 'Tugasan tidak dijumpai untuk akaun anda' });
    if (toDateOnly(assignment.tarikh_tugas) !== new Date().toISOString().slice(0, 10)) return res.status(400).json({ message: 'Check-in hanya dibenarkan pada tarikh tugasan' });
    const result = await client.query(
      `update tbl_kehadiran_tugas set masa_check_in = coalesce(masa_check_in, now()), status_kehadiran = 'Hadir'
       where id_jadual = $1 and id_pengguna = $2 returning *`,
      [req.params.id, req.user.id_pengguna]
    );
    await client.query("update tbl_jadual_bertugas set status_bertugas = 'Hadir', tarikh_kemaskini = now() where id_jadual = $1", [req.params.id]);
    await audit(req, client, 'Jadual Bertugas', 'Guard checked in', 'Pengawal check-in jadual mingguan', req.params.id);
    res.json(result.rows[0]);
  } finally {
    client.release();
  }
});

app.post('/api/jadual/assignments/:id/check-out', auth, allow(roles.guard), async (req, res) => {
  const client = await pool.connect();
  try {
    const attendance = (await client.query('select * from tbl_kehadiran_tugas where id_jadual = $1 and id_pengguna = $2', [req.params.id, req.user.id_pengguna])).rows[0];
    if (!attendance || !attendance.masa_check_in) return res.status(400).json({ message: 'Check-out hanya selepas check-in' });
    const result = await client.query(
      `update tbl_kehadiran_tugas set masa_check_out = coalesce(masa_check_out, now()), status_kehadiran = 'Selesai'
       where id_jadual = $1 and id_pengguna = $2 returning *`,
      [req.params.id, req.user.id_pengguna]
    );
    await client.query("update tbl_jadual_bertugas set status_bertugas = 'Selesai', tarikh_kemaskini = now() where id_jadual = $1", [req.params.id]);
    await audit(req, client, 'Jadual Bertugas', 'Guard checked out', 'Pengawal check-out jadual mingguan', req.params.id);
    res.json(result.rows[0]);
  } finally {
    client.release();
  }
});

app.get('/api/jadual/keperluan-pos', auth, allow(roles.admin, roles.chief), async (req, res) => {
  const result = await pool.query(
    `select k.*, pos.nama_pos, pos.nama_bangunan from tbl_keperluan_pos k
     join tbl_pos_kawalan pos on pos.id_pos = k.id_pos
     order by pos.nama_pos, k.syif`
  );
  res.json(result.rows);
});

app.post('/api/jadual/keperluan-pos', auth, allow(roles.admin, roles.chief), async (req, res) => {
  const result = await pool.query(
    `insert into tbl_keperluan_pos (id_pos, syif, bilangan_diperlukan, status_aktif)
     values ($1,$2,$3,$4)
     on conflict (id_pos, syif) do update set bilangan_diperlukan = excluded.bilangan_diperlukan, status_aktif = excluded.status_aktif
     returning *`,
    [req.body.id_pos, req.body.syif, req.body.bilangan_diperlukan || 1, req.body.status_aktif ?? true]
  );
  await auditWithPool(req, 'Jadual Bertugas', 'Post requirement updated', 'Keperluan anggota pos dikemaskini', result.rows[0].id_keperluan);
  res.status(201).json(result.rows[0]);
});

app.put('/api/jadual/keperluan-pos/:id', auth, allow(roles.admin, roles.chief), async (req, res) => {
  const result = await pool.query(
    `update tbl_keperluan_pos set id_pos=coalesce($1,id_pos), syif=coalesce($2,syif), bilangan_diperlukan=coalesce($3,bilangan_diperlukan), status_aktif=coalesce($4,status_aktif)
     where id_keperluan=$5 returning *`,
    [req.body.id_pos, req.body.syif, req.body.bilangan_diperlukan, req.body.status_aktif, req.params.id]
  );
  await auditWithPool(req, 'Jadual Bertugas', 'Post requirement updated', 'Keperluan anggota pos dikemaskini', req.params.id);
  res.json(result.rows[0]);
});

app.post('/api/jadual/mingguan/:id/upload-pdf', auth, allow(roles.admin), scheduleUpload.single('jadual_fail'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Fail PDF diperlukan' });
  const filePath = `/uploads/${req.file.filename}`;
  const result = await pool.query(
    `insert into tbl_fail_jadual (id_jadual_mingguan, nama_fail, jenis_fail, path_fail, dimuat_naik_oleh)
     values ($1,$2,'PDF',$3,$4) returning *`,
    [req.params.id, req.file.originalname, filePath, req.user.id_pengguna]
  );
  await auditWithPool(req, 'Jadual Bertugas', 'PDF schedule uploaded', `PDF jadual dimuat naik: ${req.file.originalname}`, result.rows[0].id_fail);
  res.status(201).json(result.rows[0]);
});

app.post('/api/jadual/mingguan/:id/import-csv', auth, allow(roles.admin), scheduleUpload.single('jadual_fail'), async (req, res) => {
  const client = await pool.connect();
  try {
    if (!req.file) return res.status(400).json({ message: 'Fail CSV diperlukan' });
    const schedule = await getWeeklySchedule(client, req.params.id);
    if (!schedule) return res.status(404).json({ message: 'Jadual mingguan tidak dijumpai' });
    const content = fs.readFileSync(req.file.path, 'utf8').replace(/^\uFEFF/, '');
    const lines = content.split(/\r?\n/).filter((line) => line.trim());
    const headers = parseCsvLine(lines[0] || '').map((header) => header.toLowerCase());
    const rows = lines.slice(1).map((line) => Object.fromEntries(headers.map((header, index) => [header, parseCsvLine(line)[index] || ''])));
    let imported = 0;
    const errors = [];
    await client.query('begin');
    for (const [index, row] of rows.entries()) {
      const guard = (await client.query('select id_pengguna from tbl_pengguna where nama_pengguna = $1 or nama_penuh ilike $1 limit 1', [row.nama_pengguna || row.pengawal || ''])).rows[0];
      const post = (await client.query('select id_pos from tbl_pos_kawalan where nama_pos ilike $1 limit 1', [row.nama_pos || ''])).rows[0];
      if (!guard || !post) {
        errors.push(`Baris ${index + 2}: pengawal atau pos tidak dijumpai`);
        continue;
      }
      const payload = {
        id_jadual_mingguan: Number(req.params.id),
        id_pengguna: guard.id_pengguna,
        id_pos: post.id_pos,
        tarikh_tugas: row.tarikh_tugas,
        syif: row.syif,
        masa_mula: row.masa_mula || defaultShiftTimes(row.syif).masa_mula,
        masa_tamat: row.masa_tamat || defaultShiftTimes(row.syif).masa_tamat,
      };
      const conflicts = await checkAssignmentConflicts(client, payload);
      if (!conflicts.ok) {
        errors.push(`Baris ${index + 2}: ${conflicts.critical.join('; ')}`);
        continue;
      }
      const inserted = await client.query(
        `insert into tbl_jadual_bertugas (id_jadual_mingguan,id_pengguna,id_pos,tarikh_tugas,syif,masa_mula,masa_tamat,catatan,dicipta_oleh)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
        [payload.id_jadual_mingguan, payload.id_pengguna, payload.id_pos, payload.tarikh_tugas, payload.syif, payload.masa_mula, payload.masa_tamat, row.catatan || null, req.user.id_pengguna]
      );
      await client.query('insert into tbl_kehadiran_tugas (id_jadual, id_pengguna) values ($1,$2)', [inserted.rows[0].id_jadual, payload.id_pengguna]);
      imported += 1;
    }
    const filePath = `/uploads/${req.file.filename}`;
    await client.query(
      `insert into tbl_fail_jadual (id_jadual_mingguan, nama_fail, jenis_fail, path_fail, dimuat_naik_oleh)
       values ($1,$2,'CSV',$3,$4)`,
      [req.params.id, req.file.originalname, filePath, req.user.id_pengguna]
    );
    await audit(req, client, 'Jadual Bertugas', 'CSV schedule imported', `Import CSV jadual mingguan: ${imported} berjaya, ${errors.length} ralat`, req.params.id);
    await client.query('commit');
    res.status(201).json({ imported, errors });
  } catch (error) {
    await client.query('rollback');
    res.status(500).json({ message: error.message });
  } finally {
    client.release();
  }
});

app.get('/api/schedules', auth, async (req, res) => {
  const ownOnly = req.user.peranan === roles.guard;
  const { date, shift, pos, guard, status, q } = req.query;
  const result = await pool.query(
    `select s.*, p.nama_penuh, p.nama_pengguna, p.no_telefon, pos.nama_pos, pos.nama_bangunan, pos.lokasi
     from tbl_status_bertugas s
     join tbl_pengguna p on p.id_pengguna = s.id_pengguna
     join tbl_pos_kawalan pos on pos.id_pos = s.id_pos
     where ($1::boolean = false or s.id_pengguna = $2)
       and ($3::date is null or s.tarikh = $3)
       and ($4::text is null or s.syif = $4)
       and ($5::int is null or s.id_pos = $5)
       and ($6::int is null or s.id_pengguna = $6)
       and ($7::text is null or s.status_bertugas = $7)
       and ($8::text is null or p.nama_penuh ilike '%' || $8 || '%' or p.nama_pengguna ilike '%' || $8 || '%')
     order by s.tarikh desc, s.masa_mula nulls last, pos.nama_pos`,
    [ownOnly, req.user.id_pengguna, date || null, shift || null, pos ? Number(pos) : null, guard ? Number(guard) : null, status || null, q || null]
  );
  res.json(result.rows);
});

app.get('/api/schedules/summary', auth, async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const shift = req.query.shift || 'Pagi';
  const assigned = await pool.query(
    `select count(*)::int as total,
      count(*) filter (where status_bertugas = 'Bertugas')::int bertugas,
      count(*) filter (where status_bertugas = 'Selesai')::int selesai,
      count(*) filter (where status_bertugas = 'Tidak Hadir')::int tidak_hadir
     from tbl_status_bertugas where tarikh = $1 and syif = $2`,
    [date, shift]
  );
  const uncovered = await pool.query(
    `select p.*
     from tbl_pos_kawalan p
     where p.status_pos = 'Aktif'
       and not exists (
         select 1 from tbl_status_bertugas s
         where s.id_pos = p.id_pos and s.tarikh = $1 and s.syif = $2
       )
     order by p.nama_bangunan, p.nama_pos`,
    [date, shift]
  );
  const required = requiredStaffForShift(date, shift);
  const totalAssigned = assigned.rows[0].total;
  res.json({
    date,
    shift,
    required,
    assigned: totalAssigned,
    shortage: Math.max(0, required - totalAssigned),
    isSufficient: totalAssigned >= required,
    activeDuty: assigned.rows[0].bertugas,
    completed: assigned.rows[0].selesai,
    absent: assigned.rows[0].tidak_hadir,
    uncoveredPosts: uncovered.rows,
  });
});

app.post('/api/schedules', auth, allow(roles.admin, roles.chief), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id_pengguna, id_pos, tarikh, syif, status_bertugas, masa_mula, masa_tamat } = req.body;
    if (!id_pengguna || !id_pos || !tarikh || !syif) return res.status(400).json({ message: 'Sila lengkapkan jadual bertugas' });

    const conflict = await client.query(
      `select s.*, p.nama_penuh, pos.nama_pos
       from tbl_status_bertugas s
       join tbl_pengguna p on p.id_pengguna = s.id_pengguna
       join tbl_pos_kawalan pos on pos.id_pos = s.id_pos
       where s.tarikh = $1 and s.syif = $2 and (s.id_pengguna = $3 or s.id_pos = $4)
       limit 1`,
      [tarikh, syif, id_pengguna, id_pos]
    );
    if (conflict.rows[0]) {
      return res.status(409).json({ message: `Konflik jadual: ${conflict.rows[0].nama_penuh} sudah ditetapkan untuk ${conflict.rows[0].nama_pos} pada syif ini` });
    }

    const result = await client.query(
      `insert into tbl_status_bertugas (id_pengguna, id_pos, tarikh, syif, status_bertugas, masa_mula, masa_tamat)
       values ($1,$2,$3,$4,$5,$6,$7) returning *`,
      [id_pengguna, id_pos, tarikh, syif, status_bertugas || 'Dijadualkan', masa_mula || null, masa_tamat || null]
    );
    await audit(req, client, 'Jadual Bertugas', 'Schedule created', 'Jadual bertugas diwujudkan', result.rows[0].id_status);
    await client.query(
      `insert into tbl_notifikasi (id_pengguna, tajuk_notifikasi, mesej_notifikasi, jenis_notifikasi, tahap_keutamaan)
       values ($1,$2,$3,'Jadual Bertugas','Medium')`,
      [id_pengguna, 'Jadual bertugas baharu', `Anda ditugaskan pada ${tarikh}, syif ${syif}.`]
    );
    res.status(201).json(result.rows[0]);
  } finally {
    client.release();
  }
});

app.post('/api/schedules/copy', auth, allow(roles.admin, roles.chief), async (req, res) => {
  const client = await pool.connect();
  try {
    const { sourceDate, targetDate, shift } = req.body;
    if (!sourceDate || !targetDate) return res.status(400).json({ message: 'Tarikh sumber dan tarikh sasaran diperlukan' });
    if (sourceDate === targetDate) return res.status(400).json({ message: 'Tarikh sasaran mesti berbeza daripada tarikh sumber' });

    const source = await client.query(
      `select * from tbl_status_bertugas
       where tarikh = $1 and ($2::text is null or syif = $2)
       order by syif, id_pos`,
      [sourceDate, shift && shift !== 'Semua' ? shift : null]
    );
    if (!source.rows.length) return res.status(404).json({ message: 'Tiada jadual sumber untuk disalin' });

    let copied = 0;
    let skipped = 0;
    await client.query('begin');
    for (const item of source.rows) {
      const conflict = await client.query(
        'select 1 from tbl_status_bertugas where tarikh = $1 and syif = $2 and (id_pengguna = $3 or id_pos = $4) limit 1',
        [targetDate, item.syif, item.id_pengguna, item.id_pos]
      );
      if (conflict.rows[0]) {
        skipped += 1;
        continue;
      }
      await client.query(
        `insert into tbl_status_bertugas (id_pengguna, id_pos, tarikh, syif, status_bertugas, masa_mula, masa_tamat)
         values ($1,$2,$3,$4,'Dijadualkan',$5,$6)`,
        [item.id_pengguna, item.id_pos, targetDate, item.syif, item.masa_mula || null, item.masa_tamat || null]
      );
      await client.query(
        `insert into tbl_notifikasi (id_pengguna, tajuk_notifikasi, mesej_notifikasi, jenis_notifikasi, tahap_keutamaan)
         values ($1,$2,$3,'Jadual Bertugas','Medium')`,
        [item.id_pengguna, 'Jadual bertugas baharu', `Anda ditugaskan pada ${targetDate}, syif ${item.syif}.`]
      );
      copied += 1;
    }
    await audit(req, client, 'Jadual Bertugas', 'Schedule copied', `Salin jadual ${sourceDate} ke ${targetDate}: ${copied} berjaya, ${skipped} konflik`, targetDate);
    await client.query('commit');
    res.status(201).json({ copied, skipped });
  } catch (error) {
    await client.query('rollback');
    res.status(500).json({ message: error.message });
  } finally {
    client.release();
  }
});

app.post('/api/schedules/import', auth, allow(roles.admin, roles.chief), scheduleUpload.single('jadual_fail'), async (req, res) => {
  const client = await pool.connect();
  try {
    if (!req.file) return res.status(400).json({ message: 'Fail jadual diperlukan' });
    const filePath = `/uploads/${req.file.filename}`;
    if (req.file.mimetype === 'application/pdf' || req.file.originalname.toLowerCase().endsWith('.pdf')) {
      await audit(req, client, 'Jadual Bertugas', 'Schedule PDF uploaded', `Lampiran PDF jadual dimuat naik: ${req.file.originalname}`, filePath);
      return res.status(201).json({ imported: 0, skipped: 0, file: filePath, message: 'PDF jadual dimuat naik sebagai rujukan. CSV diperlukan untuk import automatik.' });
    }

    const content = fs.readFileSync(req.file.path, 'utf8').replace(/^\uFEFF/, '');
    const lines = content.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) return res.status(400).json({ message: 'CSV jadual mesti mempunyai header dan sekurang-kurangnya satu baris data' });
    const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
    const rows = lines.slice(1).map((line) => {
      const values = parseCsvLine(line);
      return Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
    });

    let imported = 0;
    let skipped = 0;
    await client.query('begin');
    for (const row of rows) {
      const username = row.nama_pengguna || row.username || row.pengawal;
      const postId = Number(row.id_pos || row.pos_id);
      const date = row.tarikh || row.date;
      const shift = row.syif || row.shift;
      if (!username || !postId || !date || !shift) {
        skipped += 1;
        continue;
      }
      const guard = (await client.query(
        `select p.id_pengguna from tbl_pengguna p join tbl_peranan r on r.id_peranan = p.id_peranan
         where r.nama_peranan = $1 and (p.nama_pengguna = $2 or p.nama_penuh ilike '%' || $2 || '%') limit 1`,
        [roles.guard, username]
      )).rows[0];
      if (!guard) {
        skipped += 1;
        continue;
      }
      const conflict = await client.query(
        'select 1 from tbl_status_bertugas where tarikh = $1 and syif = $2 and (id_pengguna = $3 or id_pos = $4) limit 1',
        [date, shift, guard.id_pengguna, postId]
      );
      if (conflict.rows[0]) {
        skipped += 1;
        continue;
      }
      await client.query(
        `insert into tbl_status_bertugas (id_pengguna, id_pos, tarikh, syif, status_bertugas, masa_mula, masa_tamat)
         values ($1,$2,$3,$4,'Dijadualkan',$5,$6)`,
        [guard.id_pengguna, postId, date, shift, row.masa_mula || null, row.masa_tamat || null]
      );
      imported += 1;
    }
    await audit(req, client, 'Jadual Bertugas', 'Schedule CSV imported', `Import CSV jadual: ${imported} berjaya, ${skipped} diabaikan`, filePath);
    await client.query('commit');
    res.status(201).json({ imported, skipped, file: filePath });
  } catch (error) {
    await client.query('rollback');
    res.status(500).json({ message: error.message });
  } finally {
    client.release();
  }
});

app.patch('/api/schedules/:id', auth, allow(roles.admin, roles.chief), async (req, res) => {
  const client = await pool.connect();
  try {
    const oldValue = (await client.query('select * from tbl_status_bertugas where id_status = $1', [req.params.id])).rows[0];
    if (!oldValue) return res.status(404).json({ message: 'Jadual tidak dijumpai' });
    const result = await client.query(
      `update tbl_status_bertugas
       set id_pengguna = coalesce($1,id_pengguna), id_pos = coalesce($2,id_pos), tarikh = coalesce($3,tarikh),
           syif = coalesce($4,syif), status_bertugas = coalesce($5,status_bertugas),
           masa_mula = coalesce($6,masa_mula), masa_tamat = coalesce($7,masa_tamat), tarikh_kemaskini = now()
       where id_status = $8 returning *`,
      [req.body.id_pengguna, req.body.id_pos, req.body.tarikh, req.body.syif, req.body.status_bertugas, req.body.masa_mula, req.body.masa_tamat, req.params.id]
    );
    await audit(req, client, 'Jadual Bertugas', 'Schedule updated', 'Jadual bertugas dikemas kini', req.params.id, 'Berjaya', oldValue, result.rows[0]);
    await client.query(
      `insert into tbl_notifikasi (id_pengguna, tajuk_notifikasi, mesej_notifikasi, jenis_notifikasi, tahap_keutamaan)
       values ($1,$2,$3,'Jadual Bertugas','Medium')`,
      [result.rows[0].id_pengguna, 'Jadual dikemaskini', `Jadual anda pada ${result.rows[0].tarikh?.toISOString?.().slice(0, 10) || result.rows[0].tarikh}, syif ${result.rows[0].syif} telah dikemaskini.`]
    );
    res.json(result.rows[0]);
  } finally {
    client.release();
  }
});

app.patch('/api/schedules/:id/check-in', auth, allow(roles.guard), async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `update tbl_status_bertugas
       set status_bertugas = 'Bertugas', masa_mula = coalesce(masa_mula, now()::time), tarikh_kemaskini = now()
       where id_status = $1 and id_pengguna = $2 returning *`,
      [req.params.id, req.user.id_pengguna]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Jadual tidak dijumpai untuk akaun anda' });
    await audit(req, client, 'Jadual Bertugas', 'Guard checked in', 'Pengawal mula bertugas', req.params.id);
    res.json(result.rows[0]);
  } finally {
    client.release();
  }
});

app.patch('/api/schedules/:id/check-out', auth, allow(roles.guard), async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `update tbl_status_bertugas
       set status_bertugas = 'Selesai', masa_tamat = now()::time, tarikh_kemaskini = now()
       where id_status = $1 and id_pengguna = $2 returning *`,
      [req.params.id, req.user.id_pengguna]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Jadual tidak dijumpai untuk akaun anda' });
    await audit(req, client, 'Jadual Bertugas', 'Guard checked out', 'Pengawal tamat bertugas', req.params.id);
    res.json(result.rows[0]);
  } finally {
    client.release();
  }
});

app.get('/api/dashboard', auth, allow(roles.admin, roles.chief), async (req, res) => {
  const client = await pool.connect();
  try {
    await audit(req, client, 'Dashboard', 'Dashboard accessed', 'Dashboard analitik dibuka');
    const { date, location, risk } = req.query;
    const filters = [
      date || null,
      location ? Number(location) : null,
      risk || null,
    ];
    const where = `where ($1::date is null or l.tarikh_laporan = $1)
      and ($2::int is null or l.id_pos = $2)
      and ($3::text is null or l.tahap_risiko = $3)`;
    const [cards, byCategory, byRisk, trend, latest, keywords] = await Promise.all([
      client.query(`select
        (select count(*)::int from tbl_laporan_harian l ${where}) total_laporan,
        (select count(*)::int from tbl_laporan_harian l ${where} and l.tahap_risiko in ('High','Critical')) risiko_tinggi,
        (select count(*)::int from tbl_tindakan_susulan where status_tindakan <> 'Selesai') tindakan_belum_selesai,
        (select count(*)::int from tbl_pengguna p join tbl_peranan r on r.id_peranan = p.id_peranan where r.nama_peranan = $4 and p.status_akaun = 'Aktif') pengawal_aktif,
        (select count(*)::int from tbl_status_bertugas where tarikh = current_date) jadual_hari_ini,
        (select count(*)::int from tbl_laporan_harian l ${where} and l.lampiran_fail is not null) laporan_berlampiran`, [...filters, roles.guard]),
      client.query(`select coalesce(n.kategori_dikesan,'Belum dianalisis') name, count(*)::int value from tbl_laporan_harian l left join tbl_hasil_nlp n on n.id_laporan = l.id_laporan ${where} group by 1 order by 2 desc`, filters),
      client.query(`select l.tahap_risiko name, count(*)::int value from tbl_laporan_harian l ${where} group by l.tahap_risiko order by 2 desc`, filters),
      client.query(`select l.tarikh_laporan::text date, count(*)::int laporan from tbl_laporan_harian l ${where} group by l.tarikh_laporan order by l.tarikh_laporan`, filters),
      client.query(`select l.id_laporan, l.tajuk_laporan, l.tahap_risiko, l.tarikh_laporan, pos.nama_pos from tbl_laporan_harian l join tbl_pos_kawalan pos on pos.id_pos = l.id_pos ${where} and l.tahap_risiko in ('High','Critical') order by l.tarikh_dicipta desc limit 5`, filters),
      client.query(`select keyword, count(*)::int value from tbl_laporan_harian l join tbl_hasil_nlp n on n.id_laporan = l.id_laporan, unnest(n.kata_kunci_dikesan) keyword ${where} group by keyword order by value desc limit 8`, filters),
    ]);
    res.json({ cards: cards.rows[0], byCategory: byCategory.rows, byRisk: byRisk.rows, trend: trend.rows, latest: latest.rows, keywords: keywords.rows });
  } finally {
    client.release();
  }
});

app.get('/api/guard-dashboard', auth, allow(roles.guard), async (req, res) => {
  const client = await pool.connect();
  try {
    await audit(req, client, 'Dashboard', 'Dashboard accessed', 'Dashboard pengawal dibuka');
    const [summary, latest, duty] = await Promise.all([
      client.query(`select
        count(*)::int total_laporan,
        count(*) filter (where status_laporan = 'Dihantar')::int menunggu_semakan,
        count(*) filter (where status_laporan = 'Diluluskan')::int diluluskan,
        count(*) filter (where tahap_risiko in ('High','Critical'))::int risiko_tinggi
        from tbl_laporan_harian where id_pengguna = $1`, [req.user.id_pengguna]),
      client.query(`select l.*, pos.nama_pos, n.kategori_dikesan, n.skor_risiko from tbl_laporan_harian l
        join tbl_pos_kawalan pos on pos.id_pos = l.id_pos
        left join tbl_hasil_nlp n on n.id_laporan = l.id_laporan
        where l.id_pengguna = $1 order by l.tarikh_dicipta desc limit 5`, [req.user.id_pengguna]),
      client.query(`select s.*, pos.nama_pos from tbl_status_bertugas s join tbl_pos_kawalan pos on pos.id_pos = s.id_pos
        where s.id_pengguna = $1 order by s.tarikh desc, s.masa_mula desc limit 3`, [req.user.id_pengguna]),
    ]);
    res.json({ summary: summary.rows[0], latest: latest.rows, duty: duty.rows });
  } finally {
    client.release();
  }
});

app.get('/api/audit', auth, allow(roles.admin), async (req, res) => {
  const client = await pool.connect();
  try {
    await audit(req, client, 'Audit Trail', 'Audit trail viewed', 'Audit trail dilihat');
    const { user, role, pos, module, activity, date, status } = req.query;
    const result = await client.query(
      `select a.*, p.nama_penuh, r.nama_peranan from tbl_audit_trail a
       left join tbl_pengguna p on p.id_pengguna = a.id_pengguna
       left join tbl_peranan r on r.id_peranan = p.id_peranan
       where ($1::text is null or p.nama_penuh ilike '%' || $1 || '%' or p.nama_pengguna ilike '%' || $1 || '%')
         and ($2::text is null or r.nama_peranan = $2)
         and ($3::text is null or a.penerangan_aktiviti ilike '%' || $3 || '%' or a.nilai_lama::text ilike '%' || $3 || '%' or a.nilai_baharu::text ilike '%' || $3 || '%')
         and ($4::text is null or a.modul_sistem ilike '%' || $4 || '%')
         and ($5::text is null or a.jenis_aktiviti ilike '%' || $5 || '%' or a.penerangan_aktiviti ilike '%' || $5 || '%')
         and ($6::date is null or a.tarikh_masa_aktiviti::date = $6)
         and ($7::text is null or a.status_aktiviti = $7)
       order by a.tarikh_masa_aktiviti desc limit 200`,
      [user || null, role || null, pos || null, module || null, activity || null, date || null, status || null]
    );
    res.json(result.rows);
  } finally {
    client.release();
  }
});

app.get('/api/audit/export.csv', auth, allow(roles.admin), async (req, res) => {
  const result = await pool.query(
    `select a.id_audit, a.tarikh_masa_aktiviti, p.nama_penuh, r.nama_peranan, a.modul_sistem,
      a.jenis_aktiviti, a.penerangan_aktiviti, a.rekod_terlibat, a.alamat_ip, a.status_aktiviti
     from tbl_audit_trail a
     left join tbl_pengguna p on p.id_pengguna = a.id_pengguna
     left join tbl_peranan r on r.id_peranan = p.id_peranan
     order by a.tarikh_masa_aktiviti desc limit 1000`
  );
  sendCsv(res, 'audit-trail.csv', result.rows, [
    { key: 'id_audit', label: 'ID' },
    { key: 'tarikh_masa_aktiviti', label: 'Masa' },
    { key: 'nama_penuh', label: 'User' },
    { key: 'nama_peranan', label: 'Role' },
    { key: 'modul_sistem', label: 'Modul' },
    { key: 'jenis_aktiviti', label: 'Aktiviti' },
    { key: 'penerangan_aktiviti', label: 'Penerangan' },
    { key: 'rekod_terlibat', label: 'Rekod' },
    { key: 'alamat_ip', label: 'IP' },
    { key: 'status_aktiviti', label: 'Status' },
  ]);
});

app.get('/api/notifications', auth, async (req, res) => {
  const result = await pool.query(
    `select n.*, l.id_laporan, l.tajuk_laporan, l.tahap_risiko from tbl_notifikasi n
     left join tbl_laporan_harian l on n.mesej_notifikasi ilike '%' || l.tajuk_laporan || '%'
     where n.id_pengguna = $1
     order by n.tarikh_hantar desc`,
    [req.user.id_pengguna]
  );
  res.json(result.rows);
});

app.patch('/api/notifications/:id/read', auth, async (req, res) => {
  const result = await pool.query(
    `update tbl_notifikasi set status_bacaan = 'Dibaca', tarikh_dibaca = now()
     where id_notifikasi = $1 and id_pengguna = $2 returning *`,
    [req.params.id, req.user.id_pengguna]
  );
  res.json(result.rows[0]);
});

app.get('/api/users', auth, allow(roles.admin), async (req, res) => {
  const result = await pool.query(
    `select p.id_pengguna, p.id_peranan, p.nama_penuh, p.no_kad_pengenalan, p.no_telefon, p.emel, p.nama_pengguna, p.status_akaun, p.tarikh_dicipta, r.nama_peranan
     from tbl_pengguna p join tbl_peranan r on r.id_peranan = p.id_peranan order by p.id_pengguna`
  );
  res.json(result.rows);
});

app.post('/api/users', auth, allow(roles.admin), async (req, res) => {
  const client = await pool.connect();
  try {
    const passwordError = strongPasswordError(req.body.kata_laluan || '');
    if (passwordError) return res.status(400).json({ message: passwordError });
    const password = await bcrypt.hash(req.body.kata_laluan, 12);
    const result = await client.query(
      `insert into tbl_pengguna (id_peranan, nama_penuh, no_kad_pengenalan, no_telefon, emel, nama_pengguna, kata_laluan, status_akaun)
       values ($1,$2,$3,$4,$5,$6,$7,'Aktif') returning id_pengguna, nama_penuh, nama_pengguna, emel, status_akaun`,
      [req.body.id_peranan, req.body.nama_penuh, req.body.no_kad_pengenalan, req.body.no_telefon, req.body.emel, req.body.nama_pengguna, password]
    );
    await audit(req, client, 'Pengguna', 'User created', 'Pengguna baharu diwujudkan', result.rows[0].id_pengguna);
    res.status(201).json(result.rows[0]);
  } finally {
    client.release();
  }
});

app.patch('/api/users/:id', auth, allow(roles.admin), async (req, res) => {
  const client = await pool.connect();
  try {
    if (await wouldRemoveActiveAdmin(client, req.params.id, req.body)) {
      return res.status(400).json({ message: 'Sekurang-kurangnya satu Pentadbir Sistem aktif mesti dikekalkan' });
    }
    if (Number(req.params.id) === req.user.id_pengguna && (req.body.status_akaun === 'Tidak Aktif' || req.body.id_peranan)) {
      return res.status(400).json({ message: 'Pentadbir tidak boleh menukar peranan atau menyahaktifkan akaun sendiri' });
    }
    const oldValue = (await client.query('select * from tbl_pengguna where id_pengguna = $1', [req.params.id])).rows[0];
    const result = await client.query(
      `update tbl_pengguna set id_peranan = coalesce($1,id_peranan), nama_penuh = coalesce($2,nama_penuh), no_telefon = coalesce($3,no_telefon),
       emel = coalesce($4,emel), status_akaun = coalesce($5,status_akaun), tarikh_kemaskini = now()
       where id_pengguna = $6 returning id_pengguna, nama_penuh, nama_pengguna, emel, status_akaun`,
      [req.body.id_peranan, req.body.nama_penuh, req.body.no_telefon, req.body.emel, req.body.status_akaun, req.params.id]
    );
    await audit(req, client, 'Pengguna', 'User updated', 'Maklumat pengguna dikemas kini', req.params.id, 'Berjaya', oldValue, result.rows[0]);
    res.json(result.rows[0]);
  } finally {
    client.release();
  }
});

app.get('/api/posts', auth, allow(roles.admin), async (req, res) => {
  const result = await pool.query('select * from tbl_pos_kawalan order by id_pos');
  res.json(result.rows);
});

app.post('/api/posts', auth, allow(roles.admin), async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `insert into tbl_pos_kawalan (nama_pos, nama_bangunan, lokasi, waktu_operasi, status_pos)
       values ($1,$2,$3,$4,$5) returning *`,
      [req.body.nama_pos, req.body.nama_bangunan, req.body.lokasi, req.body.waktu_operasi, req.body.status_pos || 'Aktif']
    );
    await audit(req, client, 'Pos Kawalan', 'Pos kawalan created', 'Pos kawalan diwujudkan', result.rows[0].id_pos);
    res.status(201).json(result.rows[0]);
  } finally {
    client.release();
  }
});

app.patch('/api/posts/:id', auth, allow(roles.admin), async (req, res) => {
  const client = await pool.connect();
  try {
    const oldValue = (await client.query('select * from tbl_pos_kawalan where id_pos = $1', [req.params.id])).rows[0];
    const result = await client.query(
      `update tbl_pos_kawalan set nama_pos = coalesce($1,nama_pos), nama_bangunan = coalesce($2,nama_bangunan), lokasi = coalesce($3,lokasi),
       waktu_operasi = coalesce($4,waktu_operasi), status_pos = coalesce($5,status_pos) where id_pos = $6 returning *`,
      [req.body.nama_pos, req.body.nama_bangunan, req.body.lokasi, req.body.waktu_operasi, req.body.status_pos, req.params.id]
    );
    await audit(req, client, 'Pos Kawalan', 'Pos kawalan updated', 'Pos kawalan dikemas kini', req.params.id, 'Berjaya', oldValue, result.rows[0]);
    res.json(result.rows[0]);
  } finally {
    client.release();
  }
});

ensureProgressTable()
  .then(() => app.listen(port, () => console.log(`PENJAGA API running on http://localhost:${port}`)))
  .catch((error) => {
    console.error('Failed to initialize database objects', error);
    process.exit(1);
  });
