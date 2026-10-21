const express = require('express');
const { getReports, getReport, createReport, reviewReport } = require('../controllers/reportController');
const { auth, requireRole, roles } = require('../middleware/auth');
const { upload, validateEvidenceUploads } = require('../middleware/upload');

const router = express.Router();

router.get('/', auth, getReports);
router.get('/:id', auth, getReport);
router.post('/', auth, requireRole(roles.guard), upload.array('lampiran_fail', 6), validateEvidenceUploads, createReport);
router.patch('/:id/review', auth, requireRole(roles.chief), reviewReport);

module.exports = router;
