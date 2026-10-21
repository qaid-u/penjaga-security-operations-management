const express = require('express');
const {
  getTrainingData,
  createTrainingData,
  updateTrainingData,
  deleteTrainingData,
  getReportAnalysis,
} = require('../controllers/nlpController');
const { auth, requireRole, roles } = require('../middleware/auth');

const router = express.Router();

router.get('/analysis/:reportId', auth, requireRole(roles.admin), getReportAnalysis);
router.get('/:reportId', auth, requireRole(roles.admin), getReportAnalysis);
router.get('/', auth, requireRole(roles.admin), getTrainingData);
router.post('/', auth, requireRole(roles.admin), createTrainingData);
router.patch('/:id', auth, requireRole(roles.admin), updateTrainingData);
router.delete('/:id', auth, requireRole(roles.admin), deleteTrainingData);

module.exports = router;
