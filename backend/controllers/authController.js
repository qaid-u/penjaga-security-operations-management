const bcrypt = require('bcrypt');
const { randomBytes, randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { jwtSecret } = require('../middleware/auth');
const { clearLoginAttempts, clearAccountAttempts } = require('../middleware/rateLimit');
const { passwordProblem } = require('../utils/passwordPolicy');
const { revoke } = require('../utils/tokenRevocation');
const { logAudit } = require('../utils/audit');

// Compared when the username does not exist, so both cases take about the same time.
const decoyHash = bcrypt.hashSync(randomBytes(32).toString('hex'), 10);

const signSession = (id, username, role) =>
  jwt.sign({ id, username, role }, jwtSecret, { expiresIn: '12h', jwtid: randomUUID() });

const login = async (req, res) => {
  const { username, password } = req.body;
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password || username.length > 100 || password.length > 1024) return res.status(400).json({ message: 'Sila masukkan nama pengguna dan kata laluan yang sah' });
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      'select p.*, r.nama_peranan from tbl_pengguna p join tbl_peranan r on p.id_peranan = r.id_peranan where lower(p.nama_pengguna) = lower($1) order by (p.nama_pengguna = $1) desc limit 1',
      [username.trim()]
    );
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user?.kata_laluan || decoyHash);
    if (!user || !match) {
      const reason = user ? 'Katalaluan salah' : 'Akaun tidak wujud';
      await logAudit(client, user?.id_pengguna ?? null, 'LOGIN_FAILED', 'System', `${reason}: ${username}`, 'Gagal');
      return res.status(401).json({ message: 'Kredensial tidak sah' });
    }
    // Checked only after the password, so account status is not revealed to someone guessing usernames.
    if (user.status_akaun !== 'Aktif') {
      await logAudit(client, user.id_pengguna, 'LOGIN_BLOCKED', 'System', `Akaun disekat: ${username}`, 'Gagal');
      return res.status(403).json({ message: 'Akaun anda tidak aktif. Sila hubungi admin.' });
    }
    const token = signSession(user.id_pengguna, user.nama_pengguna, user.nama_peranan);
    const ip = req.ip || req.connection.remoteAddress;
    clearLoginAttempts(ip);
    clearAccountAttempts(username);
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
  if (typeof currentPassword !== 'string' || !currentPassword || currentPassword.length > 1024) {
    return res.status(400).json({ message: 'Sila masukkan kata laluan semasa.' });
  }
  const problem = passwordProblem(newPassword, { username: req.user.nama_pengguna });
  if (problem) return res.status(400).json({ message: problem });
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
    // Truncated to whole seconds so it compares exactly with the JWT `iat` claim.
    await client.query(
      "update tbl_pengguna set kata_laluan=$1, tarikh_kemaskini=now(), kata_laluan_ditukar=date_trunc('second', now()) where id_pengguna=$2",
      [await bcrypt.hash(newPassword, 10), req.user.id_pengguna]
    );
    await logAudit(client, req.user.id_pengguna, 'CHANGE_PASSWORD', 'System', 'Kata laluan ditukar');
    await client.query('commit');
    // Every earlier session is now invalid, so hand this device a fresh token.
    const token = signSession(req.user.id_pengguna, req.user.nama_pengguna, req.user.nama_peranan);
    res.json({ message: 'Kata laluan berjaya ditukar', token });
  } catch (error) {
    if (client) await client.query('rollback');
    console.error('Change password error:', error.code || error.name);
    res.status(500).json({ message: 'Kata laluan gagal ditukar' });
  } finally { client?.release(); }
};

const logout = async (req, res) => {
  try {
    const revoked = await revoke(pool, req.token);
    await logAudit(pool, req.user.id_pengguna, 'LOGOUT', 'System', 'Log keluar');
    res.json({ revoked });
  } catch (error) {
    console.error('Logout error:', error.code || error.name);
    res.status(500).json({ message: 'Log keluar gagal direkodkan' });
  }
};

module.exports = require('../utils/asyncHandlers')({ login, getMe, changePassword, logout });
