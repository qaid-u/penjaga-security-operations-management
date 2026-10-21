const express = require('express');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'select * from tbl_notifikasi where id_pengguna = $1 order by tarikh_hantar desc limit 50',
      [req.user.id_pengguna]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Gagal memuatkan notifikasi' });
  } finally { client.release(); }
});

router.patch('/:id/read', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `update tbl_notifikasi
       set status_bacaan = 'Dibaca', tarikh_dibaca = now()
       where id_notifikasi = $1 and id_pengguna = $2
       returning id_notifikasi`,
      [req.params.id, req.user.id_pengguna]
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Notifikasi tidak ditemui' });
    res.json({ message: 'Notifikasi dibaca' });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ message: 'Gagal mengemas kini notifikasi' });
  } finally { client.release(); }
});

module.exports = router;
