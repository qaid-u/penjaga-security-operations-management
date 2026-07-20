const express = require('express');
const { getDashboard, getGuardDashboard } = require('../controllers/dashboardController');
const { auth, requireRole, roles } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, requireRole(roles.admin, roles.chief), getDashboard);
router.get('/guard', auth, requireRole(roles.guard), getGuardDashboard);

module.exports = router;
