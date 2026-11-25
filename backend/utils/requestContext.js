// Carries the caller's network identity to the audit log without threading `req` through every call.
// Background workers run outside any request, so they are recorded as 'System'.
const { AsyncLocalStorage } = require('node:async_hooks');

const storage = new AsyncLocalStorage();

const clip = (value, length) => (typeof value === 'string' && value ? value.slice(0, length) : null);

const requestContext = (req, _res, next) => storage.run({
  ip: clip(req.ip || req.socket?.remoteAddress, 80),
  userAgent: clip(req.headers?.['user-agent'], 255),
}, next);

const currentRequest = () => storage.getStore() || { ip: 'System', userAgent: null };

module.exports = { requestContext, currentRequest };
