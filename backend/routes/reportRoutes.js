const express = require('express');
const { getReports, getReport, createReport, reviewReport } = require('../controllers/reportController');
const { auth, requireRole, roles } = require('../middleware/auth');
const { upload, validateEvidenceUploads, cleanupFailedUploads } = require('../middleware/upload');

const router = express.Router();
const intelligence = require('../controllers/reportIntelligenceController');
router.use(cleanupFailedUploads);

router.get('/', auth, getReports);
router.get('/export.csv', auth, getReports);
router.post('/assist', auth, requireRole(roles.guard), intelligence.assist);
router.get('/search', auth, intelligence.search);
router.get('/briefing', auth, requireRole(roles.admin, roles.chief), intelligence.briefing);
router.get('/:id/analysis', auth, intelligence.analysis);
router.get('/:id/similar', auth, intelligence.similar);
router.post('/:id/reanalyse', auth, requireRole(roles.admin, roles.chief), intelligence.reanalyse);
router.post('/:id/analysis-feedback', auth, requireRole(roles.admin, roles.chief), intelligence.feedback);
router.get('/:id', auth, getReport);
router.post('/', auth, requireRole(roles.guard), upload.array('lampiran_fail', 6), validateEvidenceUploads, createReport);
router.patch('/:id/review', auth, requireRole(roles.chief), reviewReport);

module.exports = router;
