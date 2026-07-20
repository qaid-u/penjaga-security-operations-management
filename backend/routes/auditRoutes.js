const express = require('express');
const pool = require('../config/db');
const { auth, requireRole, roles } = require('../middleware/auth');
const { escapeCSV, dateToString } = require('../utils/helpers');

const router = express.Router();

router.get('/', auth, requireRole(roles.admin), async (req, res) => {
  const { format } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;
  const client = await pool.connect();
  
  try {
    let baseQuery = `
      from tbl_audit_trail a
      left join tbl_pengguna p on p.id_pengguna = a.id_pengguna
    `;

    const countQuery = `select count(*) as total ${baseQuery}`;
    const countResult = await client.query(countQuery);
    const total = parseInt(countResult.rows[0].total);

    const result = await client.query(`
      select a.*, p.nama_penuh, p.nama_peranan 
      ${baseQuery}
      order by a.tarikh_tindakan desc
      limit $1 offset $2
    `, [format === 'csv' ? 10000 : limit, format === 'csv' ? 0 : offset]);
    
    if (format === 'csv') {
      let csv = 'ID,Tarikh,Pengguna,Peranan,Tindakan,Sasaran,Penerangan,Status,IP\n';
      result.rows.forEach(r => {
        csv += `${r.id_audit},${r.tarikh_tindakan},${escapeCSV(r.nama_penuh)},${escapeCSV(r.nama_peranan)},${escapeCSV(r.tindakan)},${escapeCSV(r.sasaran_sumber)},${escapeCSV(r.penerangan)},${escapeCSV(r.status_tindakan)},${escapeCSV(r.alamat_ip)}\n`;
      });
      res.header('Content-Type', 'text/csv');
      res.attachment(`audit_trail_${dateToString(new Date())}.csv`);
      return res.send(csv);
    }
    
    res.json({
      data: result.rows,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    res.status(500).json({ message: 'Ralat pelayan' });
  } finally {
    client.release();
  }
});

module.exports = router;
