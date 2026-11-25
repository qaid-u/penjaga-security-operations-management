require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const pool = require('./config/db');
const { ipBudget, downloadBudget } = require('./middleware/rateLimit');
const { requestContext } = require('./utils/requestContext');
const { logAudit } = require('./utils/audit');
const { passwordProblem } = require('./utils/passwordPolicy');

// Production environment validation
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || /penjaga|change-this|replace-|your[_-]|example/i.test(process.env.JWT_SECRET)) {
    console.error('FATAL: In production, JWT_SECRET must be a unique secret of at least 32 characters.');
    process.exit(1);
  }
  if (!process.env.FRONTEND_URL?.trim()) { console.error('FATAL: FRONTEND_URL must explicitly list the production frontend origins.'); process.exit(1); }
}

const sysRoutes = require('./routes/sysRoutes');
const authRoutes = require('./routes/authRoutes');
const metaRoutes = require('./routes/metaRoutes');
const nlpRoutes = require('./routes/nlpRoutes');
const reportRoutes = require('./routes/reportRoutes');
const actionRoutes = require('./routes/actionRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const auditRoutes = require('./routes/auditRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();
const port = process.env.PORT || 3000;
const host = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');

// Security headers
// The API serves data and attachments only, so its policy allows no scripts, styles or framing.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
  frameguard: { action: 'deny' },
}));

// Configurable CORS origins
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];

// Outside production, any port on this machine is also accepted for the Vite and test servers.
const loopbackOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || (process.env.NODE_ENV !== 'production' && loopbackOrigin.test(origin))) {
      return callback(null, true);
    }
    return callback(Object.assign(new Error('Origin tidak dibenarkan'),{status:403}));
  },
}));

// Trust forwarded client IPs only behind an explicitly configured proxy boundary.
app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : false);
app.use(['/api', '/uploads'], (_req, res, next) => {
  res.set({ 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' });
  next();
}, ipBudget);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '64kb', parameterLimit: 100 }));
app.use(requestContext);

const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

app.use('/api', sysRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/meta', metaRoutes);
app.use('/api/nlp-training', nlpRoutes);
app.use('/api/nlp', nlpRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/actions', actionRoutes);
app.use('/api/jadual', scheduleRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/3d', require('./routes/threeDRoutes'));

const { auth, requireRole, roles } = require('./middleware/auth');

const positiveId = (value) => /^[1-9]\d*$/.test(String(value)) && Number(value) <= 2147483647;
const fits = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;

app.get('/api/users', auth, requireRole(roles.admin), async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      // Identity card numbers are not shown by any screen, so they never leave the database.
      `select p.id_pengguna, p.id_peranan, p.nama_penuh,
              p.no_telefon, p.emel, p.nama_pengguna, p.status_akaun, p.tarikh_dicipta,
              r.nama_peranan
       from tbl_pengguna p join tbl_peranan r on r.id_peranan = p.id_peranan
       order by p.nama_penuh`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error.code || error.name);
    res.status(500).json({ message: 'Gagal memuatkan pengguna' });
  } finally { client?.release(); }
});

app.post('/api/users', auth, requireRole(roles.admin), async (req, res) => {
  const { id_peranan, nama_penuh, nama_pengguna, emel, no_telefon, kata_laluan } = req.body;
  if (!positiveId(id_peranan) || !fits(nama_penuh, 120) || !fits(nama_pengguna, 60) || !fits(emel, 120) || !/^[^\s@]+@[^\s@]+$/.test(emel.trim())
    || (no_telefon != null && no_telefon !== '' && !fits(no_telefon, 30))) {
    return res.status(400).json({ message: 'Maklumat pengguna tidak lengkap atau tidak sah' });
  }
  const problem = passwordProblem(kata_laluan, { username: nama_pengguna });
  if (problem) return res.status(400).json({ message: problem });
  let client;
  try {
    client = await pool.connect();
    const hash = await require('bcrypt').hash(kata_laluan, 10);
    await client.query('begin');
    const result = await client.query(
      `insert into tbl_pengguna (id_peranan, nama_penuh, nama_pengguna, emel, no_telefon, kata_laluan)
       values ($1, $2, $3, $4, $5, $6)
       returning id_pengguna, id_peranan, nama_penuh, nama_pengguna, emel, no_telefon, status_akaun`,
      [id_peranan, nama_penuh.trim(), nama_pengguna.trim(), emel.trim(), no_telefon || null, hash]
    );
    // The account change and its audit row are saved together or not at all.
    await logAudit(client, req.user.id_pengguna, 'CREATE_USER', `Pengguna #${result.rows[0].id_pengguna}`,
      `Akaun dicipta: ${result.rows[0].nama_pengguna} (peranan ${id_peranan})`);
    await client.query('commit');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client?.query('rollback').catch(() => {});
    if (error.code === '23503') return res.status(400).json({ message: 'Peranan tidak sah' });
    if (error.code === '23505') return res.status(409).json({ message: 'Nama pengguna atau e-mel telah digunakan' });
    console.error('Create user error:', error.code || error.name);
    res.status(500).json({ message: 'Gagal menambah pengguna' });
  } finally { client?.release(); }
});

app.patch('/api/users/:id', auth, requireRole(roles.admin), async (req, res) => {
  const { id_peranan, status_akaun } = req.body;
  if (status_akaun !== undefined && !['Aktif', 'Tidak Aktif'].includes(status_akaun)) {
    return res.status(400).json({ message: 'Status akaun tidak sah' });
  }
  if (!positiveId(req.params.id) || (id_peranan !== undefined && !positiveId(id_peranan))) {
    return res.status(400).json({ message: 'Maklumat pengguna tidak sah' });
  }
  // An administrator cannot lock themselves out or drop their own privileges.
  if (Number(req.params.id) === req.user.id_pengguna
    && (status_akaun === 'Tidak Aktif' || (id_peranan !== undefined && Number(id_peranan) !== req.user.id_peranan))) {
    return res.status(409).json({ message: 'Anda tidak boleh menukar peranan atau menyahaktifkan akaun sendiri' });
  }
  let client;
  try {
    client = await pool.connect();
    await client.query('begin');
    const result = await client.query(
      `update tbl_pengguna
       set id_peranan = coalesce($1, id_peranan), status_akaun = coalesce($2, status_akaun), tarikh_kemaskini = now()
       where id_pengguna = $3
       returning id_pengguna, id_peranan, nama_penuh, nama_pengguna, emel, status_akaun`,
      [id_peranan || null, status_akaun || null, req.params.id]
    );
    if (!result.rowCount) {
      await client.query('rollback');
      return res.status(404).json({ message: 'Pengguna tidak ditemui' });
    }
    const saved = result.rows[0];
    await logAudit(client, req.user.id_pengguna, 'UPDATE_USER', `Pengguna #${saved.id_pengguna}`,
      `Akaun dikemas kini: ${saved.nama_pengguna} (peranan ${saved.id_peranan}, status ${saved.status_akaun})`);
    await client.query('commit');
    res.json(saved);
  } catch (error) {
    await client?.query('rollback').catch(() => {});
    if (error.code === '23503') return res.status(400).json({ message: 'Peranan tidak sah' });
    console.error('Update user error:', error.code || error.name);
    res.status(500).json({ message: 'Gagal mengemas kini pengguna' });
  } finally { client?.release(); }
});

app.get('/api/posts', auth, requireRole(roles.admin), async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query('select * from tbl_pos_kawalan order by nama_pos');
    res.json(result.rows);
  } catch (error) {
    console.error('Get posts error:', error.code || error.name);
    res.status(500).json({ message: 'Gagal memuatkan pos kawalan' });
  } finally { client?.release(); }
});

app.post('/api/posts', auth, requireRole(roles.admin), async (req, res) => {
  const { nama_pos, nama_bangunan, lokasi, waktu_operasi } = req.body;
  if (typeof nama_pos !== 'string' || !nama_pos.trim()) return res.status(400).json({ message: 'Nama pos diperlukan' });
  let client;
  try {
    client = await pool.connect();
    await client.query('begin');
    const created = await client.query(
      `insert into tbl_pos_kawalan (nama_pos, nama_bangunan, lokasi, waktu_operasi) values ($1, $2, $3, $4) returning id_pos`,
      [nama_pos, nama_bangunan, lokasi, waktu_operasi]
    );
    await logAudit(client, req.user.id_pengguna, 'CREATE_POST', `Pos #${created.rows[0].id_pos}`, `Pos dicipta: ${nama_pos}`);
    await client.query('commit');
    res.json({ message: 'Pos ditambah' });
  } catch (error) {
    await client?.query('rollback').catch(() => {});
    console.error('Create post error:', error.code || error.name);
    res.status(500).json({ message: 'Gagal menambah pos kawalan' });
  } finally { client?.release(); }
});

app.patch('/api/posts/:id', auth, requireRole(roles.admin), async (req, res) => {
  const { status_pos } = req.body;
  if (!['Aktif', 'Tidak Aktif'].includes(status_pos)) return res.status(400).json({ message: 'Status pos tidak sah' });
  if (!positiveId(req.params.id)) return res.status(400).json({ message: 'ID pos tidak sah' });
  let client;
  try {
    client = await pool.connect();
    await client.query('begin');
    const result = await client.query('update tbl_pos_kawalan set status_pos = $1 where id_pos = $2 returning id_pos', [status_pos, req.params.id]);
    if (!result.rowCount) {
      await client.query('rollback');
      return res.status(404).json({ message: 'Pos kawalan tidak ditemui' });
    }
    await logAudit(client, req.user.id_pengguna, 'UPDATE_POST', `Pos #${req.params.id}`, `Status pos: ${status_pos}`);
    await client.query('commit');
    res.json({ message: 'Dikemas kini' });
  } catch (error) {
    await client?.query('rollback').catch(() => {});
    console.error('Update post error:', error.code || error.name);
    res.status(500).json({ message: 'Gagal mengemas kini pos kawalan' });
  } finally { client?.release(); }
});

app.get('/uploads/:filename', auth, downloadBudget, async (req, res) => {
  const filename = req.params.filename;
  if (path.basename(filename) !== filename || filename.startsWith('.')) {
    return res.status(404).json({ message: 'Fail tidak ditemui' });
  }
  const attachmentPath = `/uploads/${filename}`;
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      `select lampiran_fail as reference from tbl_laporan_harian l
         where position($1 in coalesce(l.lampiran_fail, '')) > 0
           and ($2 in ($3, $4) or l.id_pengguna = $5)
         union all
         select progress.lampiran_fail as reference from tbl_progress_tindakan progress
         join tbl_tindakan_susulan action on action.id_tindakan = progress.id_tindakan
         join tbl_laporan_harian l on l.id_laporan = action.id_laporan
         where position($1 in coalesce(progress.lampiran_fail, '')) > 0
           and ($2 in ($3, $4) or l.id_pengguna = $5)
         union all
         select file.path_fail as reference from tbl_fail_jadual file
         where file.path_fail = $1 and $2 in ($3, $4)
       `,
      [attachmentPath, req.user.nama_peranan, roles.admin, roles.chief, req.user.id_pengguna]
    );
    if (!result.rows.some((row) => require('./utils/attachments').referencesAttachment(row.reference, attachmentPath))) return res.status(404).json({ message: 'Fail tidak ditemui' });
    const fullPath = path.join(uploadDir, filename);
    if (!fs.existsSync(fullPath)) return res.status(404).json({ message: 'Fail tidak ditemui' });
    const handle=await fs.promises.open(fullPath,'r');
    const header=Buffer.alloc(12);
    try { await handle.read(header,0,12,0); } finally { await handle.close(); }
    // Blob previews retain Content-Type; an uploaded filename must never select HTML MIME.
    res.type(require('./utils/attachments').evidenceMime(header));
    res.set('Cache-Control','private, no-store');
    res.download(fullPath, filename);
  } catch (error) {
    console.error('Serve protected upload error:', error.code || error.name);
    res.status(500).json({ message: 'Gagal memuat turun fail' });
  } finally {
    client?.release();
  }
});

app.use((req, res) => res.status(404).json({ message: 'Laluan tidak wujud' }));

// Centralized error handling middleware
app.use((err, req, res, _next) => {
  console.error('[PENJAGA Server Error]', err.code || err.name);
  const status = err.status || err.statusCode || 500;
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Format JSON tidak sah' });
  if (err.name === 'MulterError') return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ message: 'Lampiran melebihi had saiz atau bilangan yang dibenarkan' });
  const message = process.env.NODE_ENV === 'production' && status === 500
    ? 'Ralat pelayan dalaman berlaku'
    : (err.message || 'Ralat pelayan');
  res.status(status).json({ message });
});

const server = app.listen(port, host, () => console.log(`Penjaga API Server running on port ${port}`));
const stopNlpWorker = require('./services/nlpJobs').startWorker(pool);
server.on('close', stopNlpWorker);
const stopAutoTrainer=require('./services/automaticLearning').startAutoTrainer(pool);
server.on('close',stopAutoTrainer);

module.exports = server;
