const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { jwtSecret } = require('../middleware/auth');
const { clearLoginAttempts } = require('../middleware/rateLimit');
const { logAudit } = require('../utils/audit');

const login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Sila masukkan nama pengguna dan kata laluan' });
  const client = await pool.connect();
  try {
    const result = await client.query('select * from tbl_pengguna where nama_pengguna = $1', [username]);
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
    res.status(500).json({ message: 'Ralat pelayan' });
  } finally {
    client.release();
  }
};

const getMe = async (req, res) => {
  res.json({ user: req.user });
};

module.exports = { login, getMe };
