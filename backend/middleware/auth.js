const jwt = require('jsonwebtoken');
const pool = require('./db');
const roles = require('./roles');

const jwtSecret = process.env.JWT_SECRET || 'penjaga-dev-secret';

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Token tidak dijumpai' });
    const decoded = jwt.verify(token, jwtSecret);
    const result = await pool.query('select * from tbl_pengguna where id_pengguna = $1', [decoded.id]);
    const user = result.rows[0];
    if (!user || user.status_akaun !== 'Aktif') return res.status(403).json({ message: 'Akaun tidak aktif atau tidak wujud' });
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Sesi tamat' });
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
