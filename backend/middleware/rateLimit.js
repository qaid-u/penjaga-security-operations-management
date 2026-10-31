const loginAttempts = new Map();
const passwordAttempts = new Map();
const passwordRateLimiter = (req, res, next) => {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  for (const [id, entry] of passwordAttempts) if (now - entry.firstTime >= windowMs) passwordAttempts.delete(id);
  const id = req.user.id_pengguna;
  const attempt = passwordAttempts.get(id) || { count: 0, firstTime: now };
  if (attempt.count >= 5) return res.status(429).json({ message: 'Terlalu banyak percubaan tukar kata laluan. Sila cuba lagi selepas 15 minit.' });
  attempt.count += 1;
  passwordAttempts.set(id, attempt);
  next();
};

const loginRateLimiter = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const attempt = loginAttempts.get(ip) || { count: 0, firstTime: now };
  if (now - attempt.firstTime > 15 * 60 * 1000) {
    attempt.count = 1;
    attempt.firstTime = now;
  } else {
    attempt.count += 1;
    if (attempt.count > 5) {
      return res.status(429).json({ message: 'Terlalu banyak percubaan log masuk. Sila cuba lagi selepas 15 minit.' });
    }
  }
  loginAttempts.set(ip, attempt);
  next();
};

const clearLoginAttempts = (ip) => {
  loginAttempts.delete(ip);
};

module.exports = { loginRateLimiter, clearLoginAttempts, passwordRateLimiter };
