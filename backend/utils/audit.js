const pool = require('../config/db');

async function logAudit(clientOrPool, userId, action, resource, desc, status = 'Berjaya', details = null) {
  try {
    const ip = 'System';
    await clientOrPool.query(
      `insert into tbl_audit_trail (id_pengguna, tindakan, sasaran_sumber, penerangan, status_tindakan, alamat_ip, butiran_tambahan)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, action, resource, desc, status, ip, details]
    );
  } catch (err) {
    console.error('Audit Log Error:', err);
  }
}

module.exports = { logAudit };
