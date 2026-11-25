const minute = 60_000;
const quarterHour = 15 * minute;
const clientIp = req => req.ip || req.socket.remoteAddress;
const accountId = req => req.user.id_pengguna;

function createRateLimiter({ max, windowMs, key, maxKeys = 5000, message = 'Terlalu banyak permintaan. Cuba lagi sebentar.', onLimit }) {
  const entries = new Map();
  let nextSweep = 0;
  const middleware = (req, res, next) => {
    const now = Date.now();
    if (now >= nextSweep) {
      for (const [id, entry] of entries) {
        if (entry.until <= now) entries.delete(id);
      }
      nextSweep = now + 1000;
    }
    const id = key(req);
    let entry = entries.get(id);
    if (!entry || entry.until <= now) {
      if (!entry && entries.size >= maxKeys) {
        return res.set('Retry-After', String(Math.ceil(windowMs / 1000))).status(429).json({ message });
      }
      entry = { count: 0, until: now + windowMs };
      entries.set(id, entry);
    }
    if (entry.count >= max) {
      // Report only the first rejection in each window, so a flood cannot flood the audit log too.
      if (onLimit && !entry.reported) { entry.reported = true; onLimit(req); }
      return res.set('Retry-After', String(Math.ceil((entry.until - now) / 1000))).status(429).json({ message });
    }
    entry.count++;
    next();
  };
  middleware.clear = id => entries.delete(id);
  return middleware;
}

const ipBudget = createRateLimiter({ max: 600, windowMs: minute, key: clientIp });
const accountBudget = createRateLimiter({ max: 180, windowMs: minute, key: accountId });
const exportBudget = createRateLimiter({ max: 12, windowMs: quarterHour, key: accountId });
const downloadBudget = createRateLimiter({ max: 60, windowMs: minute, key: accountId });
const reportWriteBudget = createRateLimiter({ max: 20, windowMs: quarterHour, key: accountId });
const loginBurst = createRateLimiter({ max: 40, windowMs: quarterHour, key: clientIp });
// Loaded lazily so this module stays free of database dependencies.
const reportLockout = scope => () => { void require('../utils/securityEvents').recordLoginLockout(scope); };
const loginRateLimiter = createRateLimiter({
  max: 5, windowMs: quarterHour, key: clientIp, onLimit: reportLockout('alamat IP'),
  message: 'Terlalu banyak percubaan log masuk. Sila cuba lagi selepas 15 minit.',
});
// Caps guessing against one account even when the attempts come from many addresses. It applies to
// unknown usernames too, so the response does not reveal which accounts exist.
const accountKey = username => username.trim().toLowerCase().slice(0, 100);
const accountAttempts = createRateLimiter({
  max: 10, windowMs: quarterHour, maxKeys: 20_000, key: req => accountKey(req.body.username),
  onLimit: reportLockout('akaun'),
  message: 'Terlalu banyak percubaan log masuk. Sila cuba lagi selepas 15 minit.',
});
const loginAccountLimiter = (req, res, next) =>
  typeof req.body?.username === 'string' ? accountAttempts(req, res, next) : next();
const clearAccountAttempts = username => accountAttempts.clear(accountKey(username));
const passwordRateLimiter = createRateLimiter({
  max: 5, windowMs: quarterHour, key: accountId,
  message: 'Terlalu banyak percubaan tukar kata laluan. Sila cuba lagi selepas 15 minit.',
});
const csvBudget = (req, res, next) =>
  req.path === '/export.csv' || req.query.format === 'csv' ? exportBudget(req, res, next) : next();

module.exports = {
  createRateLimiter, ipBudget, accountBudget, csvBudget, downloadBudget, reportWriteBudget,
  loginBurst, loginRateLimiter, loginAccountLimiter, passwordRateLimiter,
  clearLoginAttempts: loginRateLimiter.clear, clearAccountAttempts,
};
