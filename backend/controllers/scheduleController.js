const pool = require('../config/db');
const { escapeCSV, dateToString } = require('../utils/helpers');
const { logAudit } = require('../utils/audit');
const fs = require('fs');

const getWeeks = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query('select * from tbl_jadual_mingguan order by tarikh_mula desc');
    res.json(result.rows);
  } catch (error) { res.status(500).json({ message: 'Ralat pelayan' }); } finally { client.release(); }
};

const getCoverage = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    const w = await client.query('select tarikh_mula, tarikh_tamat from tbl_jadual_mingguan where id_jadual_mingguan = $1', [id]);
    if (!w.rows[0]) return res.json({ coverage: [], details: [] });
    const { tarikh_mula, tarikh_tamat } = w.rows[0];
    const assignments = await client.query(\`
      select s.*, p.nama_penuh, p.nama_pengguna, pos.nama_pos 
      from tbl_status_bertugas s
      join tbl_pengguna p on p.id_pengguna = s.id_pengguna
      join tbl_pos_kawalan pos on pos.id_pos = s.id_pos
      where s.tarikh >= $1 and s.tarikh <= $2
      order by s.tarikh, s.syif, pos.nama_pos
    \`, [tarikh_mula, tarikh_tamat]);
    res.json({ coverage: [], details: assignments.rows });
  } catch (error) { res.status(500).json({ message: 'Ralat pelayan' }); } finally { client.release(); }
};

const getMySchedule = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(\`
      select s.*, pos.nama_pos from tbl_status_bertugas s
      join tbl_pos_kawalan pos on pos.id_pos = s.id_pos
      where s.id_pengguna = $1 and s.tarikh >= current_date
      order by s.tarikh, s.masa_mula
    \`, [req.user.id_pengguna]);
    res.json(result.rows);
  } catch (error) { res.status(500).json({ message: 'Ralat pelayan' }); } finally { client.release(); }
};

const getPosReqs = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(\`
      select k.*, p.nama_pos from tbl_keperluan_pos k
      join tbl_pos_kawalan p on p.id_pos = k.id_pos
      order by p.nama_pos, k.hari_jenis, k.syif
    \`);
    res.json(result.rows);
  } catch (error) { res.status(500).json({ message: 'Ralat pelayan' }); } finally { client.release(); }
};

const addPosReq = async (req, res) => {
  const { id_pos, hari_jenis, syif, jumlah_pengawal } = req.body;
  const client = await pool.connect();
  try {
    await client.query(\`
      insert into tbl_keperluan_pos (id_pos, hari_jenis, syif, jumlah_pengawal)
      values ($1, $2, $3, $4)
      on conflict (id_pos, hari_jenis, syif) do update set jumlah_pengawal = $4, status_aktif = true
    \`, [id_pos, hari_jenis, syif, jumlah_pengawal]);
    res.json({ message: 'Keperluan pos disimpan' });
  } catch (error) { res.status(500).json({ message: 'Ralat pelayan' }); } finally { client.release(); }
};

const checkConflict = async (req, res) => {
  const { id_pengguna, tarikh, syif } = req.body;
  const client = await pool.connect();
  try {
    const check = await client.query(\`
      select 1 from tbl_status_bertugas where tarikh = $1 and syif = $2 and id_pengguna = $3 limit 1
    \`, [tarikh, syif, id_pengguna]);
    if (check.rows.length > 0) return res.json({ ok: false, critical: ['Pengawal sudah ditugaskan pada syif ini'] });
    res.json({ ok: true, critical: [] });
  } catch (error) { res.status(500).json({ message: 'Ralat pelayan' }); } finally { client.release(); }
};

const saveAssignment = async (req, res) => {
  const { id } = req.params;
  const { id_pengguna, id_pos, tarikh, syif } = req.body;
  const client = await pool.connect();
  try {
    let masa_mula = '07:00:00';
    let masa_tamat = '16:00:00';
    if (syif === 'Petang') { masa_mula = '14:45:00'; masa_tamat = '23:45:00'; }
    if (syif === 'Malam') { masa_mula = '23:00:00'; masa_tamat = '08:00:00'; }
    
    if (id) {
      await client.query(\`
        update tbl_status_bertugas set id_pengguna=$1, id_pos=$2, tarikh=$3, syif=$4, masa_mula=$5, masa_tamat=$6
        where id_status=$7
      \`, [id_pengguna, id_pos, tarikh, syif, masa_mula, masa_tamat, id]);
    } else {
      await client.query(\`
        insert into tbl_status_bertugas (id_pengguna, id_pos, tarikh, syif, status_bertugas, masa_mula, masa_tamat)
        values ($1, $2, $3, $4, 'Belum Mula', $5, $6)
      \`, [id_pengguna, id_pos, tarikh, syif, masa_mula, masa_tamat]);
    }
    await logAudit(client, req.user.id_pengguna, 'SAVE_ASSIGNMENT', \`Tugasan\`, 'Tugasan jadual disimpan');
    res.json({ message: 'Disimpan' });
  } catch (error) { res.status(500).json({ message: 'Ralat pelayan' }); } finally { client.release(); }
};

const deleteAssignment = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('delete from tbl_status_bertugas where id_status = $1', [id]);
    await logAudit(client, req.user.id_pengguna, 'DELETE_ASSIGNMENT', \`Tugasan #\${id}\`, 'Tugasan dipadam');
    res.json({ message: 'Dipadam' });
  } catch (error) { res.status(500).json({ message: 'Ralat pelayan' }); } finally { client.release(); }
};

const importSchedules = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Tiada fail dimuat naik' });
  try {
    const content = fs.readFileSync(req.file.path, 'utf8');
    res.json({ message: 'Fail CSV diterima, sedang diproses (dummy)' });
  } catch (error) {
    res.status(500).json({ message: 'Ralat membaca fail' });
  }
};

const updateWeekStatus = async (req, res) => {
  const { id, action } = req.params;
  const status = action === 'confirm' ? 'Disahkan' : action === 'lock' ? 'Dikunci' : 'Draf';
  const client = await pool.connect();
  try {
    await client.query('update tbl_jadual_mingguan set status_jadual = $1 where id_jadual_mingguan = $2', [status, id]);
    res.json({ message: 'Status dikemas kini' });
  } catch (error) { res.status(500).json({ message: 'Ralat pelayan' }); } finally { client.release(); }
};

const checkIn = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query("update tbl_status_bertugas set status_bertugas = 'Hadir' where id_status = $1", [id]);
    res.json({ message: 'Check-in berjaya' });
  } catch (error) { res.status(500).json({ message: 'Ralat pelayan' }); } finally { client.release(); }
};

const checkOut = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query("update tbl_status_bertugas set status_bertugas = 'Selesai' where id_status = $1", [id]);
    res.json({ message: 'Check-out berjaya' });
  } catch (error) { res.status(500).json({ message: 'Ralat pelayan' }); } finally { client.release(); }
};

module.exports = { getWeeks, getCoverage, getMySchedule, getPosReqs, addPosReq, checkConflict, saveAssignment, deleteAssignment, importSchedules, updateWeekStatus, checkIn, checkOut };
