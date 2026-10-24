const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const roles = require('../config/roles');

const jwtSecret = process.env.JWT_SECRET || 'penjaga-dev-secret';

const auth = async (req, res, next) => {
  const token = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization || '')?.[1];
  if (!token) return res.status(401).json({ message: 'Token tidak dijumpai' });

  let decoded;
  try {
    decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
    if (!Number.isSafeInteger(decoded.id) || decoded.id < 1 || decoded.id > 2147483647) throw new Error('Invalid token subject');
  } catch {
    return res.status(401).json({ message: 'Sesi tamat atau token tidak sah' });
  }

  try {
    const result = await pool.query(
      `select p.id_pengguna, p.id_peranan, p.nama_penuh, p.nama_pengguna, p.emel,
              p.no_telefon, p.status_akaun, r.nama_peranan
       from tbl_pengguna p
       join tbl_peranan r on p.id_peranan = r.id_peranan
       where p.id_pengguna = $1`,
      [decoded.id]
    );
    const user = result.rows[0];
    if (!user || user.status_akaun !== 'Aktif') return res.status(403).json({ message: 'Akaun tidak aktif atau tidak wujud' });
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication lookup error:', error.code || error.name);
    res.status(500).json({ message: 'Gagal mengesahkan akaun' });
  }
};

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Tidak dibenarkan' });
    if (!allowedRoles.includes(req.user.nama_peranan)) {
      return res.status(403).json({ message: 'Peranan tidak dibenarkan' });
    }
    next();
  };
};

module.exports = { auth, requireRole, roles, jwtSecret };
