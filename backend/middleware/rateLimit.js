const loginAttempts = new Map();

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

module.exports = { loginRateLimiter, clearLoginAttempts };
