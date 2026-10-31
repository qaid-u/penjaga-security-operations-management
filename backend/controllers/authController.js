const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { jwtSecret } = require('../middleware/auth');
const { clearLoginAttempts } = require('../middleware/rateLimit');
const { logAudit } = require('../utils/audit');

const login = async (req, res) => {
  const { username, password } = req.body;
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password || username.length > 100 || password.length > 1024) return res.status(400).json({ message: 'Sila masukkan nama pengguna dan kata laluan yang sah' });
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      'select p.*, r.nama_peranan from tbl_pengguna p join tbl_peranan r on p.id_peranan = r.id_peranan where p.nama_pengguna = $1',
      [username]
    );
    const user = result.rows[0];
    if (!user) {
      await logAudit(client, null, 'LOGIN_FAILED', 'System', `Gagal log masuk: ${username} (Tidak Wujud)`, 'Gagal');
      return res.status(401).json({ message: 'Kredensial tidak sah' });
    }
    if (user.status_akaun !== 'Aktif') {
      await logAudit(client, user.id_pengguna, 'LOGIN_BLOCKED', 'System', `Akaun disekat: ${username}`, 'Gagal');
      return res.status(403).json({ message: 'Akaun anda tidak aktif. Sila hubungi admin.' });
    }
    const match = await bcrypt.compare(password, user.kata_laluan);
    if (!match) {
      await logAudit(client, user.id_pengguna, 'LOGIN_FAILED', 'System', `Katalaluan salah: ${username}`, 'Gagal');
      return res.status(401).json({ message: 'Kredensial tidak sah' });
    }
    const token = jwt.sign({ id: user.id_pengguna, username: user.nama_pengguna, role: user.nama_peranan }, jwtSecret, { expiresIn: '12h' });
    const ip = req.ip || req.connection.remoteAddress;
    clearLoginAttempts(ip);
    await logAudit(client, user.id_pengguna, 'LOGIN_SUCCESS', 'System', 'Log masuk berjaya');
    res.json({ token, user: { id_pengguna: user.id_pengguna, nama_penuh: user.nama_penuh, nama_pengguna: user.nama_pengguna, emel: user.emel, nama_peranan: user.nama_peranan } });
  } catch (error) {
    console.error('Login error:', error.code || error.name);
    res.status(500).json({ message: 'Ralat pelayan' });
  } finally {
    client?.release();
  }
};

const getMe = async (req, res) => {
  res.json({ user: req.user });
};

const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (typeof currentPassword !== 'string' || !currentPassword || currentPassword.length > 1024 ||
      typeof newPassword !== 'string' || newPassword.length < 10 || Buffer.byteLength(newPassword, 'utf8') > 72) {
    return res.status(400).json({ message: 'Kata laluan baharu mesti sekurang-kurangnya 10 aksara dan maksimum 72 bait.' });
  }
  let client;
  try {
    client = await pool.connect();
    await client.query('begin');
    const { rows } = await client.query('select kata_laluan from tbl_pengguna where id_pengguna=$1 for update', [req.user.id_pengguna]);
    if (!rows[0] || !await bcrypt.compare(currentPassword, rows[0].kata_laluan)) {
      await client.query('rollback');
      return res.status(400).json({ message: 'Kata laluan semasa tidak sah.' });
    }
    if (await bcrypt.compare(newPassword, rows[0].kata_laluan)) {
      await client.query('rollback');
      return res.status(400).json({ message: 'Kata laluan baharu mesti berbeza daripada kata laluan semasa.' });
    }
    await client.query('update tbl_pengguna set kata_laluan=$1, tarikh_kemaskini=now() where id_pengguna=$2', [await bcrypt.hash(newPassword, 10), req.user.id_pengguna]);
    await logAudit(client, req.user.id_pengguna, 'CHANGE_PASSWORD', 'System', 'Kata laluan ditukar');
    await client.query('commit');
    res.json({ message: 'Kata laluan berjaya ditukar' });
  } catch (error) {
    if (client) await client.query('rollback');
    console.error('Change password error:', error.code || error.name);
    res.status(500).json({ message: 'Kata laluan gagal ditukar' });
  } finally { client?.release(); }
};

module.exports = require('../utils/asyncHandlers')({ login, getMe, changePassword });
