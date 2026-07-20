const express = require('express');
const { getReports, createReport, reviewReport } = require('../controllers/reportController');
const { auth, requireRole, roles } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();

router.get('/', auth, getReports);
router.post('/', auth, requireRole(roles.guard), upload.array('bukti', 6), createReport);
router.patch('/:id/review', auth, requireRole(roles.chief), reviewReport);

module.exports = router;
