const express = require('express');
const { getWeeks, getCoverage, getMySchedule, getPosReqs, addPosReq, checkConflict, saveAssignment, deleteAssignment, importSchedules, updateWeekStatus, checkIn, checkOut } = require('../controllers/scheduleController');
const { auth, requireRole, roles } = require('../middleware/auth');
const { scheduleUpload } = require('../middleware/upload');

const router = express.Router();

router.get('/mingguan', auth, requireRole(roles.admin, roles.chief), getWeeks);
router.get('/mingguan/:id/coverage-summary', auth, requireRole(roles.admin, roles.chief), getCoverage);
router.get('/my-schedule', auth, requireRole(roles.guard), getMySchedule);
router.get('/keperluan-pos', auth, requireRole(roles.admin, roles.chief), getPosReqs);
router.post('/keperluan-pos', auth, requireRole(roles.admin, roles.chief), addPosReq);
router.post('/check-conflict', auth, requireRole(roles.admin, roles.chief), checkConflict);
router.post('/mingguan/:id/assignments', auth, requireRole(roles.admin, roles.chief), saveAssignment);
router.put('/assignments/:id', auth, requireRole(roles.admin, roles.chief), saveAssignment);
router.delete('/assignments/:id', auth, requireRole(roles.admin, roles.chief), deleteAssignment);
router.post('/mingguan/:id/import', auth, requireRole(roles.admin, roles.chief), scheduleUpload.single('jadual_fail'), importSchedules);
router.post('/mingguan/:id/:action', auth, requireRole(roles.admin, roles.chief), updateWeekStatus);
router.post('/assignments/:id/check-in', auth, requireRole(roles.guard), checkIn);
router.post('/assignments/:id/check-out', auth, requireRole(roles.guard), checkOut);

module.exports = router;
