const express = require('express');
const {
  getWeeks,
  getWeek,
  getCoverage,
  getMySchedule,
  getPosReqs,
  addPosReq,
  checkConflict,
  saveAssignment,
  deleteAssignment,
  importSchedules,
  uploadSchedulePdf,
  updateWeekStatus,
  checkIn,
  checkOut,
} = require('../controllers/scheduleController');
const { auth, requireRole, roles } = require('../middleware/auth');
const { scheduleUpload, validateScheduleUpload, cleanupFailedUploads } = require('../middleware/upload');

const router = express.Router();
router.use(cleanupFailedUploads);

router.get('/mingguan', auth, requireRole(roles.admin, roles.chief), getWeeks);
router.get('/mingguan/:id', auth, requireRole(roles.admin, roles.chief), getWeek);
router.get('/mingguan/:id/coverage-summary', auth, requireRole(roles.admin, roles.chief), getCoverage);
router.get('/my-schedule', auth, requireRole(roles.guard), getMySchedule);
router.get('/keperluan-pos', auth, requireRole(roles.admin, roles.chief), getPosReqs);
router.post('/keperluan-pos', auth, requireRole(roles.admin, roles.chief), addPosReq);
router.post('/check-conflict', auth, requireRole(roles.admin, roles.chief), checkConflict);
router.post('/mingguan/:id/assignments', auth, requireRole(roles.admin, roles.chief), saveAssignment);
router.put('/assignments/:id', auth, requireRole(roles.admin, roles.chief), saveAssignment);
router.delete('/assignments/:id', auth, requireRole(roles.admin, roles.chief), deleteAssignment);
router.post('/mingguan/:id/import-csv', auth, requireRole(roles.admin), scheduleUpload.single('jadual_fail'), validateScheduleUpload, importSchedules);
router.post('/mingguan/:id/upload-pdf', auth, requireRole(roles.admin), scheduleUpload.single('jadual_fail'), validateScheduleUpload, uploadSchedulePdf);
router.post('/mingguan/:id/:action', auth, requireRole(roles.admin), updateWeekStatus);
router.post('/assignments/:id/check-in', auth, requireRole(roles.guard), checkIn);
router.post('/assignments/:id/check-out', auth, requireRole(roles.guard), checkOut);

module.exports = router;
