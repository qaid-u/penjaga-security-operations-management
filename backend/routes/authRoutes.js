const express = require('express');
const { login, getMe } = require('../controllers/authController');
const { auth } = require('../middleware/auth');
const { loginRateLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/login', loginRateLimiter, login);
router.get('/me', auth, getMe);

module.exports = router;
