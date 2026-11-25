// Records security-relevant events in the audit trail. Logging is best effort: a failed write is
// reported on the console and never changes the response the caller receives.
const pool = require('../config/db');
const { admin } = require('../config/roles');
const { logAudit } = require('./audit');
const { currentRequest } = require('./requestContext');

const MODULE_EVENTS = ['LOGIN_FAILED', 'LOGIN_BLOCKED', 'LOGIN_RATE_LIMITED', 'ACCESS_DENIED'];
// One row per user and route per minute, so a script cannot flood the audit table.
const recentDenials = new Map();

async function recordSecurityEvent(userId, action, description, resource = 'Keselamatan') {
  try {
    await logAudit(pool, userId, action, resource.slice(0, 80), description, 'Gagal');
  } catch (error) {
    console.error('Security event was not recorded:', action, error.code || error.name);
  }
}

function recordAccessDenied(req) {
  // The route pattern avoids storing query strings or record identifiers.
  const route = `${req.method} ${req.baseUrl || ''}${req.route?.path || req.path}`;
  const key = `${req.user.id_pengguna} ${route}`;
  const now = Date.now();
  if (recentDenials.get(key) > now) return;
  if (recentDenials.size >= 1000) recentDenials.clear();
  recentDenials.set(key, now + 60_000);
  void recordSecurityEvent(req.user.id_pengguna, 'ACCESS_DENIED', `Peranan tidak dibenarkan: ${route}`);
}

// Called once per lockout window: records the event and alerts every active administrator.
async function recordLoginLockout(scope) {
  const { ip } = currentRequest();
  const description = `Had percubaan log masuk dicapai (${scope}) dari ${ip}`;
  await recordSecurityEvent(null, 'LOGIN_RATE_LIMITED', description);
  try {
    await pool.query(
      `insert into tbl_notifikasi(id_pengguna,tajuk_notifikasi,mesej_notifikasi,jenis_notifikasi,tahap_keutamaan)
       select p.id_pengguna, 'Amaran keselamatan', $1, 'Keselamatan', 'High'
       from tbl_pengguna p join tbl_peranan r on r.id_peranan = p.id_peranan
       where r.nama_peranan = $2 and p.status_akaun = 'Aktif'`,
      [description, admin]
    );
  } catch (error) {
    console.error('Security alert was not sent:', error.code || error.name);
  }
}

module.exports = { recordSecurityEvent, recordAccessDenied, recordLoginLockout, MODULE_EVENTS };
