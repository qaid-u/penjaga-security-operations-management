const express = require('express');
const pool = require('../config/db');

const router = express.Router();

router.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

router.get('/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'Ready', db: 'Connected' });
  } catch (error) {
    console.error('Readiness check error:', error);
    res.status(503).json({ status: 'Unavailable', error: 'DB Connection Failed' });
  }
});

module.exports = router;
