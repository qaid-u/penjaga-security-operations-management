const { currentRequest } = require('./requestContext');

async function logAudit(clientOrPool, userId, action, resource, desc, status = 'Berjaya', details = null) {
  await clientOrPool.query(
    `insert into tbl_audit_trail
       (id_pengguna, modul_sistem, jenis_aktiviti, penerangan_aktiviti, rekod_terlibat, alamat_ip, status_aktiviti, nilai_baharu, peranti_pengguna)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [userId, 'Operasi', action, desc, resource, currentRequest().ip, status, details, currentRequest().userAgent]
  );
}

module.exports = { logAudit };
