const express = require('express');
const { login, getMe, changePassword } = require('../controllers/authController');
const { auth } = require('../middleware/auth');
const { loginRateLimiter, passwordRateLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/login', loginRateLimiter, login);
router.get('/me', auth, getMe);
router.post('/change-password', auth, passwordRateLimiter, changePassword);

module.exports = router;
