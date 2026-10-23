const express = require('express');
const pool = require('../config/db');
const { auth, requireRole, roles } = require('../middleware/auth');
const { createService, period, positiveId } = require('../services/threeDService');
const router = express.Router();
const service = createService(pool);
router.use(auth, requireRole(roles.admin, roles.chief));
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
const handle = (fn) => async (req, res) => {
  try { res.json(await fn(req)); }
  catch (error) {
    if (!error.status) console.error('3D API error:', error.code || error.name);
    res.status(error.status || 503).json({ message: error.status ? error.message : 'Data operasi tidak tersedia. Semak sambungan pangkalan data dan migrasi 3D.' });
  }
};
router.get('/locations', handle(() => service.locations()));
router.get('/overview', handle((req) => service.overview(period(req.query))));
router.get('/locations/:id/summary', handle((req) => service.summary(positiveId(req.params.id), period(req.query))));
router.patch('/locations/:id/mapping', requireRole(roles.admin), handle((req) => service.map(positiveId(req.params.id), req.body, req.user.id_pengguna)));
module.exports = router;
