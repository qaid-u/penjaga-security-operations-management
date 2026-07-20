const express = require('express');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query('select * from tbl_notifikasi where id_pengguna = $1 order by tarikh_notifikasi desc limit 50', [req.user.id_pengguna]);
    res.json(result.rows);
  } catch (error) { res.status(500).json({ message: 'Ralat pelayan' }); } finally { client.release(); }
});

router.patch('/:id/read', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("update tbl_notifikasi set status_baca = 'Dibaca' where id_notifikasi = $1 and id_pengguna = $2", [req.params.id, req.user.id_pengguna]);
    res.json({ message: 'Notifikasi dibaca' });
  } catch (error) { res.status(500).json({ message: 'Ralat pelayan' }); } finally { client.release(); }
});

module.exports = router;
