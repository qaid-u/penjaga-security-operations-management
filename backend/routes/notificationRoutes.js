const express = require('express');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  const page = Number(req.query.page || 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) return res.status(400).json({ message: 'Halaman tidak sah' });
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      `select * from tbl_notifikasi where id_pengguna = $1
       and ($2::boolean = false or status_bacaan = 'Belum Dibaca')
       order by tarikh_hantar desc, id_notifikasi desc limit 50 offset $3`,
      [req.user.id_pengguna, req.query.unread === 'true', (page - 1) * 50]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get notifications error:', error.code || error.name);
    res.status(500).json({ message: 'Gagal memuatkan notifikasi' });
  } finally { client?.release(); }
});

router.get('/unread-count', auth, async (req, res) => {
  try {
    const result = await pool.query("select count(*)::int as unread from tbl_notifikasi where id_pengguna=$1 and status_bacaan='Belum Dibaca'", [req.user.id_pengguna]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Notification count error:', error.code || error.name);
    res.status(500).json({ message: 'Gagal memuatkan bilangan notifikasi' });
  }
});

router.patch('/read-all', auth, async (req, res) => {
  try {
    const result = await pool.query("update tbl_notifikasi set status_bacaan='Dibaca',tarikh_dibaca=now() where id_pengguna=$1 and status_bacaan='Belum Dibaca'", [req.user.id_pengguna]);
    res.json({ updated: result.rowCount });
  } catch (error) {
    console.error('Read notifications error:', error.code || error.name);
    res.status(500).json({ message: 'Gagal mengemas kini notifikasi' });
  }
});

router.patch('/:id/read', auth, async (req, res) => {
  if (!/^[1-9]\d*$/.test(req.params.id) || Number(req.params.id) > 2147483647) return res.status(400).json({ message: 'ID notifikasi tidak sah' });
  let client;
  try {
    client = await pool.connect();
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
    console.error('Mark notification read error:', error.code || error.name);
    res.status(500).json({ message: 'Gagal mengemas kini notifikasi' });
  } finally { client?.release(); }
});

module.exports = router;
