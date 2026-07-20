const express = require('express');
const { getMeta } = require('../controllers/metaController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, getMeta);

module.exports = router;
