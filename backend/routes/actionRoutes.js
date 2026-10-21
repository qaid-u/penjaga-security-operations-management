const express = require('express');
const { getActions, createAction, updateAction, addProgress, requestUpdate } = require('../controllers/actionController');
const { auth, requireRole, roles } = require('../middleware/auth');
const { upload, validateEvidenceUploads } = require('../middleware/upload');

const router = express.Router();

router.get('/', auth, requireRole(roles.admin, roles.chief), getActions);
router.post('/', auth, requireRole(roles.admin), createAction);
router.patch('/:id', auth, requireRole(roles.admin), updateAction);
router.post('/:id/progress', auth, requireRole(roles.chief), upload.array('lampiran_fail', 3), validateEvidenceUploads, addProgress);
router.post('/:id/request-update', auth, requireRole(roles.admin), upload.array('lampiran_fail', 3), validateEvidenceUploads, requestUpdate);

module.exports = router;
