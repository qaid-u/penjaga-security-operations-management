const express = require('express');
const { getReports, getReport, createReport, reviewReport, validateClassification } = require('../controllers/reportController');
const { auth, requireRole, roles } = require('../middleware/auth');
const { upload, validateEvidenceUploads, cleanupFailedUploads } = require('../middleware/upload');
const { csvBudget, reportWriteBudget } = require('../middleware/rateLimit');

const router = express.Router();
const intelligence = require('../controllers/reportIntelligenceController');
router.use(cleanupFailedUploads);

router.get('/', auth, csvBudget, getReports);
router.get('/export.csv', auth, csvBudget, getReports);
router.post('/assist', auth, requireRole(roles.guard), intelligence.draftBudget, intelligence.assist);
router.get('/search', auth, intelligence.similarityBudget, intelligence.search);
router.get('/briefing', auth, requireRole(roles.admin, roles.chief), intelligence.briefing);
router.get('/:id/analysis', auth, intelligence.analysis);
router.get('/:id/similar', auth, intelligence.similarityBudget, intelligence.similar);
router.post('/:id/reanalyse', auth, requireRole(roles.admin, roles.chief), intelligence.analysisBudget, intelligence.reanalyse);
router.post('/:id/analysis-feedback', auth, requireRole(roles.admin, roles.chief), intelligence.feedback);
router.get('/:id', auth, getReport);
router.post('/', auth, requireRole(roles.guard), reportWriteBudget, upload.array('lampiran_fail', 6), validateEvidenceUploads, createReport);
router.patch('/:id/review', auth, requireRole(roles.chief), reviewReport);
router.patch('/:id/classification', auth, requireRole(roles.chief), validateClassification);

module.exports = router;
