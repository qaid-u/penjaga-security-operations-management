const express = require('express');
const pool = require('../config/db');
const { auth, requireRole, roles } = require('../middleware/auth');
const { escapeCSV, dateToString } = require('../utils/helpers');

const router = express.Router();

router.get('/', auth, requireRole(roles.admin), async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const isCsv = req.query.format === 'csv';
  const limit = isCsv ? 10000 : Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
  const params = [];
  const conditions = [];
  const addFilter = (value, condition) => {
    if (!value) return;
    params.push(value);
    conditions.push(condition.replace('?', `$${params.length}`));
  };
  addFilter(req.query.user, 'p.nama_penuh = ?');
  addFilter(req.query.role, 'r.nama_peranan = ?');
  addFilter(req.query.pos, 'pos.nama_pos = ?');
  addFilter(req.query.module, 'a.modul_sistem ilike ?');
  if (req.query.module) params[params.length - 1] = `%${req.query.module}%`;
  if (req.query.activity) {
    params.push(`%${req.query.activity}%`);
    conditions.push(`(a.jenis_aktiviti ilike $${params.length} or a.penerangan_aktiviti ilike $${params.length})`);
  }
  addFilter(req.query.status, 'a.status_aktiviti = ?');
  if (req.query.dateMode === 'date' && req.query.date) addFilter(req.query.date, 'a.tarikh_masa_aktiviti::date = ?::date');
  if (req.query.dateMode === 'month' && req.query.month) addFilter(req.query.month, "to_char(a.tarikh_masa_aktiviti, 'YYYY-MM') = ?");
  if (req.query.dateMode === 'year' && req.query.year) addFilter(req.query.year, "to_char(a.tarikh_masa_aktiviti, 'YYYY') = ?");

  const baseQuery = `
    from tbl_audit_trail a
    left join tbl_pengguna p on p.id_pengguna = a.id_pengguna
    left join tbl_peranan r on r.id_peranan = p.id_peranan
    left join tbl_jadual_bertugas s on a.rekod_terlibat = ('Tugasan #' || s.id_jadual::text)
    left join tbl_pos_kawalan pos on pos.id_pos = s.id_pos
    ${conditions.length ? `where ${conditions.join(' and ')}` : ''}
  `;
  let client;
  try {
    client = await pool.connect();
    const countResult = await client.query(`select count(*)::int as total ${baseQuery}`, params);
    const result = await client.query(
      `select a.*, p.nama_penuh, r.nama_peranan, pos.nama_pos
       ${baseQuery}
       order by a.tarikh_masa_aktiviti desc
       limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, limit, isCsv ? 0 : (page - 1) * limit]
    );
    if (isCsv) {
      const rows = [
        ['ID', 'Tarikh', 'Pengguna', 'Peranan', 'Modul', 'Aktiviti', 'Penerangan', 'Status', 'IP'],
        ...result.rows.map((row) => [
          row.id_audit,
          row.tarikh_masa_aktiviti,
          row.nama_penuh,
          row.nama_peranan,
          row.modul_sistem,
          row.jenis_aktiviti,
          row.penerangan_aktiviti,
          row.status_aktiviti,
          row.alamat_ip,
        ]),
      ];
      const csv = rows.map((row) => row.map(escapeCSV).join(',')).join('\n');
      res.type('text/csv');
      res.attachment(`audit_trail_${dateToString(new Date())}.csv`);
      return res.send(csv);
    }
    const total = countResult.rows[0].total;
    res.json({ data: result.rows, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('Get audit trail error:', error.code || error.name);
    res.status(500).json({ message: 'Gagal memuatkan audit trail' });
  } finally {
    client?.release();
  }
});

module.exports = router;
