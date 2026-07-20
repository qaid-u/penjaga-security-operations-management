const express = require('express');
const { getActions, updateAction, addProgress } = require('../controllers/actionController');
const { auth, requireRole, roles } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();

router.get('/', auth, requireRole(roles.admin, roles.chief), getActions);
router.patch('/:id', auth, requireRole(roles.admin), updateAction);
router.post('/:id/progress', auth, requireRole(roles.chief), upload.array('lampiran_progress', 3), addProgress);

module.exports = router;
