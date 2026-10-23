require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const pool = require('./config/db');

// Production environment validation
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || /penjaga|change-this/i.test(process.env.JWT_SECRET)) {
    console.error('FATAL: In production, JWT_SECRET must be a unique secret of at least 32 characters.');
    process.exit(1);
  }
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

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Configurable CORS origins
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV !== 'production' || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1);

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

app.get('/api/users', auth, requireRole(roles.admin), async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `select p.id_pengguna, p.id_peranan, p.nama_penuh, p.no_kad_pengenalan,
              p.no_telefon, p.emel, p.nama_pengguna, p.status_akaun, p.tarikh_dicipta,
              r.nama_peranan
       from tbl_pengguna p join tbl_peranan r on r.id_peranan = p.id_peranan
       order by p.nama_penuh`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Gagal memuatkan pengguna' });
  } finally { client.release(); }
});

app.post('/api/users', auth, requireRole(roles.admin), async (req, res) => {
  const { id_peranan, nama_penuh, nama_pengguna, emel, no_telefon, kata_laluan } = req.body;
  if (!id_peranan || !nama_penuh?.trim() || !nama_pengguna?.trim() || !emel?.trim() || !kata_laluan || kata_laluan.length < 10) {
    return res.status(400).json({ message: 'Maklumat pengguna tidak lengkap atau kata laluan kurang daripada 10 aksara' });
  }
  const client = await pool.connect();
  try {
    const hash = await require('bcrypt').hash(kata_laluan, 10);
    const result = await client.query(
      `insert into tbl_pengguna (id_peranan, nama_penuh, nama_pengguna, emel, no_telefon, kata_laluan)
       values ($1, $2, $3, $4, $5, $6)
       returning id_pengguna, id_peranan, nama_penuh, nama_pengguna, emel, no_telefon, status_akaun`,
      [id_peranan, nama_penuh.trim(), nama_pengguna.trim(), emel.trim(), no_telefon || null, hash]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'Nama pengguna atau e-mel telah digunakan' });
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Gagal menambah pengguna' });
  } finally { client.release(); }
});

app.patch('/api/users/:id', auth, requireRole(roles.admin), async (req, res) => {
  const { id_peranan, status_akaun } = req.body;
  if (status_akaun !== undefined && !['Aktif', 'Tidak Aktif'].includes(status_akaun)) {
    return res.status(400).json({ message: 'Status akaun tidak sah' });
  }
  const client = await pool.connect();
  try {
    const result = await client.query(
      `update tbl_pengguna
       set id_peranan = coalesce($1, id_peranan), status_akaun = coalesce($2, status_akaun), tarikh_kemaskini = now()
       where id_pengguna = $3
       returning id_pengguna, id_peranan, nama_penuh, nama_pengguna, emel, status_akaun`,
      [id_peranan || null, status_akaun || null, req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Pengguna tidak ditemui' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Gagal mengemas kini pengguna' });
  } finally { client.release(); }
});

app.get('/api/posts', auth, requireRole(roles.admin), async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query('select * from tbl_pos_kawalan order by nama_pos');
    res.json(result.rows);
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ message: 'Gagal memuatkan pos kawalan' });
  } finally { client.release(); }
});

app.post('/api/posts', auth, requireRole(roles.admin), async (req, res) => {
  const { nama_pos, nama_bangunan, lokasi, waktu_operasi } = req.body;
  if (!nama_pos?.trim()) return res.status(400).json({ message: 'Nama pos diperlukan' });
  const client = await pool.connect();
  try {
    await client.query(
      `insert into tbl_pos_kawalan (nama_pos, nama_bangunan, lokasi, waktu_operasi) values ($1, $2, $3, $4)`,
      [nama_pos, nama_bangunan, lokasi, waktu_operasi]
    );
    res.json({ message: 'Pos ditambah' });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ message: 'Gagal menambah pos kawalan' });
  } finally { client.release(); }
});

app.patch('/api/posts/:id', auth, requireRole(roles.admin), async (req, res) => {
  const { status_pos } = req.body;
  if (!['Aktif', 'Tidak Aktif'].includes(status_pos)) return res.status(400).json({ message: 'Status pos tidak sah' });
  const client = await pool.connect();
  try {
    const result = await client.query('update tbl_pos_kawalan set status_pos = $1 where id_pos = $2 returning id_pos', [status_pos, req.params.id]);
    if (!result.rowCount) return res.status(404).json({ message: 'Pos kawalan tidak ditemui' });
    res.json({ message: 'Dikemas kini' });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ message: 'Gagal mengemas kini pos kawalan' });
  } finally { client.release(); }
});

app.get('/uploads/:filename', auth, async (req, res) => {
  const filename = req.params.filename;
  if (path.basename(filename) !== filename || filename.startsWith('.')) {
    return res.status(404).json({ message: 'Fail tidak ditemui' });
  }
  const attachmentPath = `/uploads/${filename}`;
  const client = await pool.connect();
  try {
    const result = await client.query(
      `select exists (
         select 1 from tbl_laporan_harian l
         where position($1 in coalesce(l.lampiran_fail, '')) > 0
           and ($2 in ($3, $4) or l.id_pengguna = $5)
         union all
         select 1 from tbl_progress_tindakan progress
         join tbl_tindakan_susulan action on action.id_tindakan = progress.id_tindakan
         join tbl_laporan_harian l on l.id_laporan = action.id_laporan
         where position($1 in coalesce(progress.lampiran_fail, '')) > 0
           and ($2 in ($3, $4) or l.id_pengguna = $5)
         union all
         select 1 from tbl_fail_jadual file
         where file.path_fail = $1 and $2 in ($3, $4)
       ) as allowed`,
      [attachmentPath, req.user.nama_peranan, roles.admin, roles.chief, req.user.id_pengguna]
    );
    if (!result.rows[0].allowed) return res.status(404).json({ message: 'Fail tidak ditemui' });
    const fullPath = path.join(uploadDir, filename);
    if (!fs.existsSync(fullPath)) return res.status(404).json({ message: 'Fail tidak ditemui' });
    res.sendFile(fullPath);
  } catch (error) {
    console.error('Serve protected upload error:', error);
    res.status(500).json({ message: 'Gagal memuat turun fail' });
  } finally {
    client.release();
  }
});

app.use((req, res) => res.status(404).json({ message: 'Laluan tidak wujud' }));

// Centralized error handling middleware
app.use((err, req, res, _next) => {
  console.error('[PENJAGA Server Error]', err);
  const status = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' && status === 500
    ? 'Ralat pelayan dalaman berlaku'
    : (err.message || 'Ralat pelayan');
  res.status(status).json({ message });
});

const server = app.listen(port, () => console.log(`Penjaga API Server running on port ${port}`));

module.exports = server;
