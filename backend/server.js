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

function cleanText(text = '') {
  return text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
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

function analyzeReport(text) {
  const cleaned = cleanText(text);
  const matches = [];
  for (const rule of nlpRules) {
    const found = rule.keywords.filter((keyword) => cleaned.includes(keyword));
    if (found.length) matches.push({ ...rule, found });
  }
  matches.sort((a, b) => b.score - a.score || b.found.length - a.found.length);
  const top = matches[0] || nlpRules[nlpRules.length - 1];
  const keywords = matches.flatMap((match) => match.found);
  const score = Math.min(100, Math.max(top.score, top.score + Math.max(0, keywords.length - 1) * 3));
  const level = levelFromScore(score);
  const words = cleaned.split(' ').slice(0, 18).join(' ');

  return {
    teks_diproses: cleaned,
    kata_kunci_dikesan: keywords.length ? keywords : ['tiada insiden'],
    kategori_dikesan: top.category,
    skor_sentimen: level === 'Low' ? 0.2 : level === 'Medium' ? -0.1 : -0.6,
    skor_risiko: score,
    tahap_risiko: level,
    ringkasan_automatik: `${top.category}: ${words}${cleaned.split(' ').length > 18 ? '...' : ''}`,
    tahap_keyakinan: Math.min(0.95, 0.55 + keywords.length * 0.12),
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

function allow(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.peranan)) return res.status(403).json({ message: 'Akses tidak dibenarkan' });
    next();
  };
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

app.get('/api/auth/me', auth, async (req, res) => {
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
  res.json({ posts: posts.rows, categories: categories.rows, checklist: checklist.rows, roles: rolesResult.rows, guards: guards.rows });
});

app.get('/api/reports', auth, async (req, res) => {
  const ownOnly = req.user.peranan === roles.guard;
  const result = await pool.query(
    `select l.*, p.nama_penuh, pos.nama_pos, k.nama_kategori, n.kata_kunci_dikesan, n.kategori_dikesan, n.skor_risiko, n.ringkasan_automatik
     from tbl_laporan_harian l
     join tbl_pengguna p on p.id_pengguna = l.id_pengguna
     join tbl_pos_kawalan pos on pos.id_pos = l.id_pos
     left join tbl_kategori_insiden k on k.id_kategori_insiden = l.id_kategori_insiden
     left join tbl_hasil_nlp n on n.id_laporan = l.id_laporan
     where ($1::boolean = false or l.id_pengguna = $2)
     order by l.tarikh_dicipta desc`,
    [ownOnly, req.user.id_pengguna]
  );
  res.json(result.rows);
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
  sendCsv(res, 'laporan-harian.csv', result.rows, [
    { key: 'id_laporan', label: 'ID' },
    { key: 'tajuk_laporan', label: 'Tajuk' },
    { key: 'nama_penuh', label: 'Pengawal' },
    { key: 'nama_pos', label: 'Pos' },
    { key: 'syif', label: 'Syif' },
    { key: 'tarikh_laporan', label: 'Tarikh' },
    { key: 'masa_laporan', label: 'Masa' },
    { key: 'status_laporan', label: 'Status' },
    { key: 'tahap_risiko', label: 'Risiko' },
    { key: 'kategori_dikesan', label: 'Kategori NLP' },
    { key: 'skor_risiko', label: 'Skor Risiko' },
  ]);
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

  res.json({ report: report.rows[0], checklist: checklist.rows, reviews: reviews.rows, actions: actions.rows });
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
    const nlp = analyzeReport(kandungan_laporan);
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
    await audit(req, client, 'NLP', 'NLP analysis completed', 'Analisis NLP rule-based selesai', idLaporan);
    await client.query('commit');
    res.status(201).json({ report: report.rows[0], nlp });
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
    const { status, comment } = req.body;
    const statusMap = { approved: 'Diluluskan', rejected: 'Ditolak' };
    if (!statusMap[status]) return res.status(400).json({ message: 'Status semakan tidak sah' });
    await client.query('begin');
    const oldReport = (await client.query('select * from tbl_laporan_harian where id_laporan = $1', [req.params.id])).rows[0];
    const report = await client.query('update tbl_laporan_harian set status_laporan = $1, tarikh_kemaskini = now() where id_laporan = $2 returning *', [statusMap[status], req.params.id]);
    await client.query('insert into tbl_pengesahan_laporan (id_laporan, id_pengguna_pengesah, status_pengesahan, catatan_pengesahan) values ($1,$2,$3,$4)', [req.params.id, req.user.id_pengguna, statusMap[status], comment || null]);
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

app.get('/api/actions', auth, allow(roles.chief), async (req, res) => {
  const result = await pool.query(
    `select t.*, l.tajuk_laporan, l.tahap_risiko, l.tarikh_laporan
     from tbl_tindakan_susulan t join tbl_laporan_harian l on l.id_laporan = t.id_laporan
     order by t.tarikh_kemaskini desc`
  );
  res.json(result.rows);
});

app.get('/api/actions/export.csv', auth, allow(roles.chief), async (req, res) => {
  const result = await pool.query(
    `select t.id_tindakan, l.tajuk_laporan, l.tahap_risiko, t.pegawai_bertanggungjawab,
      t.tindakan_diambil, t.status_tindakan, t.tahap_keutamaan, t.tarikh_mula, t.tarikh_selesai
     from tbl_tindakan_susulan t join tbl_laporan_harian l on l.id_laporan = t.id_laporan
     order by t.tarikh_kemaskini desc`
  );
  sendCsv(res, 'tindakan-susulan.csv', result.rows, [
    { key: 'id_tindakan', label: 'ID' },
    { key: 'tajuk_laporan', label: 'Laporan' },
    { key: 'tahap_risiko', label: 'Risiko Laporan' },
    { key: 'pegawai_bertanggungjawab', label: 'Pegawai' },
    { key: 'tindakan_diambil', label: 'Tindakan' },
    { key: 'status_tindakan', label: 'Status' },
    { key: 'tahap_keutamaan', label: 'Keutamaan' },
    { key: 'tarikh_mula', label: 'Tarikh Mula' },
    { key: 'tarikh_selesai', label: 'Tarikh Selesai' },
  ]);
});

app.post('/api/actions', auth, allow(roles.chief), async (req, res) => {
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

app.patch('/api/actions/:id', auth, allow(roles.chief), async (req, res) => {
  const client = await pool.connect();
  try {
    const oldValue = (await client.query('select * from tbl_tindakan_susulan where id_tindakan = $1', [req.params.id])).rows[0];
    const result = await client.query(
      `update tbl_tindakan_susulan set status_tindakan = coalesce($1,status_tindakan), catatan_tindakan = coalesce($2,catatan_tindakan), tarikh_selesai = $3, tarikh_kemaskini = now()
       where id_tindakan = $4 returning *`,
      [req.body.status_tindakan, req.body.catatan_tindakan, req.body.status_tindakan === 'Selesai' ? new Date() : oldValue.tarikh_selesai, req.params.id]
    );
    await audit(req, client, 'Tindakan Susulan', 'Follow-up action updated', 'Tindakan susulan dikemas kini', req.params.id, 'Berjaya', oldValue, result.rows[0]);
    res.json(result.rows[0]);
  } finally {
    client.release();
  }
});

app.get('/api/schedules', auth, async (req, res) => {
  const ownOnly = req.user.peranan === roles.guard;
  const { date, pos, guard, status } = req.query;
  const result = await pool.query(
    `select s.*, p.nama_penuh, p.nama_pengguna, p.no_telefon, pos.nama_pos, pos.nama_bangunan, pos.lokasi
     from tbl_status_bertugas s
     join tbl_pengguna p on p.id_pengguna = s.id_pengguna
     join tbl_pos_kawalan pos on pos.id_pos = s.id_pos
     where ($1::boolean = false or s.id_pengguna = $2)
       and ($3::date is null or s.tarikh = $3)
       and ($4::int is null or s.id_pos = $4)
       and ($5::int is null or s.id_pengguna = $5)
       and ($6::text is null or s.status_bertugas = $6)
     order by s.tarikh desc, s.masa_mula nulls last, pos.nama_pos`,
    [ownOnly, req.user.id_pengguna, date || null, pos ? Number(pos) : null, guard ? Number(guard) : null, status || null]
  );
  res.json(result.rows);
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
    res.status(201).json(result.rows[0]);
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
    const { user, module, activity, date, status } = req.query;
    const result = await client.query(
      `select a.*, p.nama_penuh, r.nama_peranan from tbl_audit_trail a
       left join tbl_pengguna p on p.id_pengguna = a.id_pengguna
       left join tbl_peranan r on r.id_peranan = p.id_peranan
       where ($1::text is null or p.nama_penuh ilike '%' || $1 || '%' or p.nama_pengguna ilike '%' || $1 || '%')
         and ($2::text is null or a.modul_sistem ilike '%' || $2 || '%')
         and ($3::text is null or a.jenis_aktiviti ilike '%' || $3 || '%' or a.penerangan_aktiviti ilike '%' || $3 || '%')
         and ($4::date is null or a.tarikh_masa_aktiviti::date = $4)
         and ($5::text is null or a.status_aktiviti = $5)
       order by a.tarikh_masa_aktiviti desc limit 200`,
      [user || null, module || null, activity || null, date || null, status || null]
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

app.get('/api/notifications', auth, allow(roles.admin, roles.chief), async (req, res) => {
  const result = await pool.query(
    `select n.*, l.id_laporan, l.tajuk_laporan, l.tahap_risiko from tbl_notifikasi n
     left join tbl_laporan_harian l on n.mesej_notifikasi ilike '%' || l.tajuk_laporan || '%'
     where n.id_pengguna = $1
     order by n.tarikh_hantar desc`,
    [req.user.id_pengguna]
  );
  res.json(result.rows);
});

app.patch('/api/notifications/:id/read', auth, allow(roles.admin, roles.chief), async (req, res) => {
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

app.listen(port, () => console.log(`PENJAGA API running on http://localhost:${port}`));
