const express = require('express');
const { login, getMe, changePassword, logout } = require('../controllers/authController');
const { auth } = require('../middleware/auth');
const { loginBurst, loginRateLimiter, loginAccountLimiter, passwordRateLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/login', loginBurst, loginRateLimiter, loginAccountLimiter, login);
router.post('/logout', auth, logout);
router.get('/me', auth, getMe);
router.post('/change-password', auth, passwordRateLimiter, changePassword);

module.exports = router;
