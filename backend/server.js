require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const pool = require('./config/db');

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

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1);

const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir));

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

// Backward compatibility or other specific endpoints that might be missed
// For example: app.get('/api/users')
// The user previously wanted users, posts, etc. Oh wait, I didn't extract those yet!
// Let's add them back to server.js just to make sure they work, or they were never in server.js?
// Ah! In App.jsx, I saw `users` and `posts` endpoints:
// load = () => Promise.all([api.get('/meta'), api.get('/users')])
// load = () => api.get('/posts')

app.get('/api/users', require('./middleware/auth').auth, require('./middleware/auth').requireRole('Pentadbir Sistem'), async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query('select * from tbl_pengguna order by nama_penuh');
    res.json(result.rows);
  } catch (error) { res.status(500).json({ message: 'Ralat' }); } finally { client.release(); }
});

app.post('/api/users', require('./middleware/auth').auth, require('./middleware/auth').requireRole('Pentadbir Sistem'), async (req, res) => {
  const { id_peranan, nama_penuh, nama_pengguna, emel, no_telefon, kata_laluan } = req.body;
  const client = await pool.connect();
  try {
    const hash = await require('bcrypt').hash(kata_laluan, 10);
    await client.query(
      \`insert into tbl_pengguna (id_peranan, nama_penuh, nama_pengguna, emel, no_telefon, kata_laluan) values ($1, $2, $3, $4, $5, $6)\`,
      [id_peranan, nama_penuh, nama_pengguna, emel, no_telefon, hash]
    );
    res.json({ message: 'Pengguna ditambah' });
  } catch (error) { res.status(500).json({ message: 'Ralat' }); } finally { client.release(); }
});

app.patch('/api/users/:id', require('./middleware/auth').auth, require('./middleware/auth').requireRole('Pentadbir Sistem'), async (req, res) => {
  const { id } = req.params;
  const { id_peranan, status_akaun } = req.body;
  const client = await pool.connect();
  try {
    await client.query(
      \`update tbl_pengguna set id_peranan = coalesce($1, id_peranan), status_akaun = coalesce($2, status_akaun) where id_pengguna = $3\`,
      [id_peranan, status_akaun, id]
    );
    res.json({ message: 'Dikemas kini' });
  } catch (error) { res.status(500).json({ message: 'Ralat' }); } finally { client.release(); }
});

app.get('/api/posts', require('./middleware/auth').auth, require('./middleware/auth').requireRole('Pentadbir Sistem'), async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query('select * from tbl_pos_kawalan order by nama_pos');
    res.json(result.rows);
  } catch (error) { res.status(500).json({ message: 'Ralat' }); } finally { client.release(); }
});

app.post('/api/posts', require('./middleware/auth').auth, require('./middleware/auth').requireRole('Pentadbir Sistem'), async (req, res) => {
  const { nama_pos, nama_bangunan, lokasi, waktu_operasi } = req.body;
  const client = await pool.connect();
  try {
    await client.query(
      \`insert into tbl_pos_kawalan (nama_pos, nama_bangunan, lokasi, waktu_operasi) values ($1, $2, $3, $4)\`,
      [nama_pos, nama_bangunan, lokasi, waktu_operasi]
    );
    res.json({ message: 'Pos ditambah' });
  } catch (error) { res.status(500).json({ message: 'Ralat' }); } finally { client.release(); }
});

app.patch('/api/posts/:id', require('./middleware/auth').auth, require('./middleware/auth').requireRole('Pentadbir Sistem'), async (req, res) => {
  const { id } = req.params;
  const { status_pos } = req.body;
  const client = await pool.connect();
  try {
    await client.query('update tbl_pos_kawalan set status_pos = $1 where id_pos = $2', [status_pos, id]);
    res.json({ message: 'Dikemas kini' });
  } catch (error) { res.status(500).json({ message: 'Ralat' }); } finally { client.release(); }
});

async function ensureProgressTable() {
  const client = await pool.connect();
  try {
    await client.query(\`
      create table if not exists tbl_progress_tindakan (
        id_progress serial primary key,
        id_tindakan integer references tbl_tindakan_susulan(id_tindakan) on delete cascade,
        dikemaskini_oleh integer references tbl_pengguna(id_pengguna),
        penerangan_progress text not null,
        lampiran_progress text,
        perlu_respon_ketua boolean default false,
        tarikh_kemaskini timestamp default current_timestamp
      )
    \`);
  } catch (error) {
    console.error('Error ensuring progress table:', error);
  } finally {
    client.release();
  }
}
ensureProgressTable();

app.use((req, res) => res.status(404).json({ message: 'Laluan tidak wujud' }));

const server = app.listen(port, () => console.log(\`Penjaga API Server running on port \${port}\`));

module.exports = server;
