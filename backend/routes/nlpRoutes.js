const express = require('express');
const { getTrainingData, updateTrainingData, getReportAnalysis } = require('../controllers/nlpController');
const { auth, requireRole, roles } = require('../middleware/auth');

const router = express.Router();

router.get('/analysis/:reportId', auth, requireRole(roles.admin), getReportAnalysis);
router.get('/', auth, requireRole(roles.admin), getTrainingData);
router.patch('/:id', auth, requireRole(roles.admin), updateTrainingData);

module.exports = router;
