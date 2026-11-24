const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const roles = require('../config/roles');
const { accountBudget } = require('./rateLimit');

// Without a configured secret, use a random per-process secret instead of a publicly known
// constant, so a deployment that forgets JWT_SECRET (or NODE_ENV=production) cannot be forged.
const jwtSecret = process.env.JWT_SECRET || (() => {
  console.warn('JWT_SECRET is not set: using a random secret; sessions end when the API restarts.');
  return require('node:crypto').randomBytes(32).toString('hex');
})();

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
              p.no_telefon, p.status_akaun, r.nama_peranan,
              -- Read through to_jsonb so a database that has not yet applied migration 010 keeps working.
              extract(epoch from (to_jsonb(p)->>'kata_laluan_ditukar')::timestamptz)::bigint as password_changed_at
       from tbl_pengguna p
       join tbl_peranan r on p.id_peranan = r.id_peranan
       where p.id_pengguna = $1`,
      [decoded.id]
    );
    const { password_changed_at: passwordChangedAt, ...user } = result.rows[0] || {};
    if (!user.id_pengguna || user.status_akaun !== 'Aktif') return res.status(403).json({ message: 'Akaun tidak aktif atau tidak wujud' });
    // A token issued before the latest password change belongs to a revoked session.
    if (passwordChangedAt != null && !(Number(decoded.iat) >= Number(passwordChangedAt))) {
      return res.status(401).json({ message: 'Sesi tamat atau token tidak sah' });
    }
    req.user = user;
    accountBudget(req, res, next);
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
