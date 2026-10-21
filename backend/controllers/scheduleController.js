const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const { logAudit } = require('../utils/audit');
const { roles } = require('../middleware/auth');

const validShifts = ['Pagi', 'Petang', 'Malam', 'Office Hour'];

const parseWeekId = (value) => Number.parseInt(value, 10);
const validDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};
const validTime = (value) => {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}(:\d{2})?$/.test(value)) return false;
  const [hours, minutes, seconds = '0'] = value.split(':').map(Number);
  return hours <= 23 && minutes <= 59 && seconds <= 59;
};
const timeInSeconds = (value) => {
  const [hours, minutes, seconds = 0] = value.split(':').map(Number);
  return hours * 3600 + minutes * 60 + seconds;
};
const removeUploadedFile = async (file) => {
  try {
    await fs.promises.unlink(file.path);
  } catch (error) {
    console.error(`Failed to remove unreferenced upload ${file.filename}:`, error);
  }
};

const getWeeks = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query('select * from tbl_jadual_mingguan order by tarikh_mula desc');
    res.json(result.rows);
  } catch (error) {
    console.error('Get schedule weeks error:', error);
    res.status(500).json({ message: 'Gagal memuatkan jadual mingguan' });
  } finally {
    client.release();
  }
};

const getWeek = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'select * from tbl_jadual_mingguan where id_jadual_mingguan = $1',
      [req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Jadual mingguan tidak ditemui' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get schedule week error:', error);
    res.status(500).json({ message: 'Gagal memuatkan jadual mingguan' });
  } finally {
    client.release();
  }
};

const getCoverage = async (req, res) => {
  const client = await pool.connect();
  try {
    const weekResult = await client.query(
      'select * from tbl_jadual_mingguan where id_jadual_mingguan = $1',
      [req.params.id]
    );
    const week = weekResult.rows[0];
    if (!week) return res.status(404).json({ message: 'Jadual mingguan tidak ditemui' });

    const [requirements, assignments] = await Promise.all([
      client.query(
        `select k.id_pos, k.syif, k.bilangan_diperlukan, p.nama_pos
         from tbl_keperluan_pos k
         join tbl_pos_kawalan p on p.id_pos = k.id_pos
         where k.status_aktif = true
         order by p.nama_pos, k.syif`
      ),
      client.query(
        `select s.*, p.nama_penuh, p.nama_pengguna, pos.nama_pos
         from tbl_jadual_bertugas s
         join tbl_pengguna p on p.id_pengguna = s.id_pengguna
         join tbl_pos_kawalan pos on pos.id_pos = s.id_pos
         where s.id_jadual_mingguan = $1
         order by s.tarikh_tugas, s.syif, pos.nama_pos, p.nama_penuh`,
        [req.params.id]
      ),
    ]);

    const coverageByPost = requirements.rows.map((requirement) => {
      const matchingAssignments = assignments.rows.filter(
        (assignment) => assignment.id_pos === requirement.id_pos && assignment.syif === requirement.syif
      );
      const days = Math.max(
        0,
        Math.floor((new Date(`${week.tarikh_tamat}T00:00:00Z`) - new Date(`${week.tarikh_mula}T00:00:00Z`)) / 86400000) + 1
      );
      const required = Number(requirement.bilangan_diperlukan) * days;
      const assigned = matchingAssignments.length;
      return {
        ...requirement,
        required,
        assigned,
        shortage: Math.max(0, required - assigned),
        assignments: matchingAssignments,
      };
    });
    const totalRequired = coverageByPost.reduce((sum, item) => sum + item.required, 0);
    const totalAssigned = assignments.rows.length;
    res.json({
      coverage: assignments.rows,
      details: assignments.rows,
      coverageByPost,
      totalRequired,
      totalAssigned,
      shortage: Math.max(0, totalRequired - totalAssigned),
      activeDutyCount: assignments.rows.filter((item) => item.status_bertugas === 'Hadir').length,
      absentGuardCount: assignments.rows.filter((item) => item.status_bertugas === 'Tidak Hadir').length,
      uncoveredPosts: coverageByPost.filter((item) => item.shortage > 0),
    });
  } catch (error) {
    console.error('Get schedule coverage error:', error);
    res.status(500).json({ message: 'Gagal mengira liputan jadual' });
  } finally {
    client.release();
  }
};

const getMySchedule = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `select s.*, pos.nama_pos, pos.nama_bangunan, pos.lokasi,
              coalesce(a.status_kehadiran, 'Belum Hadir') as status_kehadiran,
              a.masa_check_in, a.masa_check_out
       from tbl_jadual_bertugas s
       join tbl_pos_kawalan pos on pos.id_pos = s.id_pos
       left join tbl_kehadiran_tugas a on a.id_jadual = s.id_jadual
       where s.id_pengguna = $1 and s.tarikh_tugas >= current_date
       order by s.tarikh_tugas, s.masa_mula`,
      [req.user.id_pengguna]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get guard schedule error:', error);
    res.status(500).json({ message: 'Gagal memuatkan jadual bertugas' });
  } finally {
    client.release();
  }
};

const getPosReqs = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `select k.*, p.nama_pos
       from tbl_keperluan_pos k
       join tbl_pos_kawalan p on p.id_pos = k.id_pos
       order by p.nama_pos, k.syif`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get post requirements error:', error);
    res.status(500).json({ message: 'Gagal memuatkan keperluan pos' });
  } finally {
    client.release();
  }
};

const addPosReq = async (req, res) => {
  const { id_pos, syif, bilangan_diperlukan, status_aktif = true } = req.body;
  const count = Number(bilangan_diperlukan);
  if (!id_pos || !validShifts.includes(syif) || !Number.isInteger(count) || count < 0) {
    return res.status(400).json({ message: 'Pos, syif dan bilangan pengawal tidak sah' });
  }
  const client = await pool.connect();
  try {
    const result = await client.query(
      `insert into tbl_keperluan_pos (id_pos, syif, bilangan_diperlukan, status_aktif)
       values ($1, $2, $3, $4)
       on conflict (id_pos, syif)
       do update set bilangan_diperlukan = excluded.bilangan_diperlukan, status_aktif = excluded.status_aktif
       returning *`,
      [id_pos, syif, count, Boolean(status_aktif)]
    );
    await logAudit(client, req.user.id_pengguna, 'UPDATE_POST_REQUIREMENT', `Pos #${id_pos}`, `${syif}: ${count}`);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Save post requirement error:', error);
    res.status(500).json({ message: 'Gagal menyimpan keperluan pos' });
  } finally {
    client.release();
  }
};

const assignmentConflict = async (client, { id_pengguna, tarikh_tugas, masa_mula, masa_tamat, id_jadual }) => {
  const result = await client.query(
    `select s.id_jadual
     from tbl_jadual_bertugas s
     where s.id_pengguna = $1
       and s.id_jadual <> coalesce($5::int, 0)
       and s.tarikh_tugas between $2::date - interval '1 day' and $2::date + interval '1 day'
       and (s.tarikh_tugas + s.masa_mula) <
           (($2::date + $4::time) + case when $4::time <= $3::time then interval '1 day' else interval '0 day' end)
       and ($2::date + $3::time) <
           ((s.tarikh_tugas + s.masa_tamat) + case when s.masa_tamat <= s.masa_mula then interval '1 day' else interval '0 day' end)
     limit 1`,
    [id_pengguna, tarikh_tugas, masa_mula, masa_tamat, id_jadual || null]
  );
  return result.rows[0] || null;
};

const checkConflict = async (req, res) => {
  const { id_pengguna, tarikh_tugas, masa_mula, masa_tamat, id_jadual } = req.body;
  if (!id_pengguna || !validDate(tarikh_tugas) || !validTime(masa_mula) || !validTime(masa_tamat)) {
    return res.status(400).json({ message: 'Maklumat tarikh, masa atau pengawal tidak sah' });
  }
  const client = await pool.connect();
  try {
    const conflict = await assignmentConflict(client, { id_pengguna, tarikh_tugas, masa_mula, masa_tamat, id_jadual });
    res.json({
      ok: !conflict,
      critical: conflict ? ['Pengawal mempunyai tugasan yang bertindih pada waktu ini'] : [],
    });
  } catch (error) {
    console.error('Check schedule conflict error:', error);
    res.status(500).json({ message: 'Gagal menyemak konflik jadual' });
  } finally {
    client.release();
  }
};

const saveAssignment = async (req, res) => {
  const {
    id_pengguna,
    id_pos,
    tarikh_tugas,
    syif,
    masa_mula,
    masa_tamat,
    catatan,
  } = req.body;
  if (!id_pengguna || !id_pos || !validDate(tarikh_tugas) || !validShifts.includes(syif) || !validTime(masa_mula) || !validTime(masa_tamat)) {
    return res.status(400).json({ message: 'Maklumat tugasan jadual tidak sah' });
  }
  if (timeInSeconds(masa_mula) === timeInSeconds(masa_tamat)) {
    return res.status(400).json({ message: 'Masa mula dan tamat tidak boleh sama' });
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    const updateId = req.method === 'PUT' ? req.params.id : null;
    let weekId = req.method === 'POST' ? parseWeekId(req.params.id) : null;
    if (updateId) {
      const existing = await client.query(
        'select id_jadual_mingguan from tbl_jadual_bertugas where id_jadual = $1 for update',
        [updateId]
      );
      if (!existing.rowCount) {
        await client.query('rollback');
        return res.status(404).json({ message: 'Tugasan jadual tidak ditemui' });
      }
      weekId = existing.rows[0].id_jadual_mingguan;
    }
    const weekResult = await client.query(
      'select * from tbl_jadual_mingguan where id_jadual_mingguan = $1',
      [weekId]
    );
    const week = weekResult.rows[0];
    if (!week) {
      await client.query('rollback');
      return res.status(404).json({ message: 'Jadual mingguan tidak ditemui' });
    }
    if (req.user.nama_peranan === roles.chief && week.status_jadual === 'Dikunci') {
      await client.query('rollback');
      return res.status(409).json({ message: 'Jadual dikunci oleh Pentadbir Sistem' });
    }
    if (tarikh_tugas < String(week.tarikh_mula).slice(0, 10) || tarikh_tugas > String(week.tarikh_tamat).slice(0, 10)) {
      await client.query('rollback');
      return res.status(400).json({ message: 'Tarikh tugasan mesti berada dalam tempoh jadual mingguan' });
    }

    await client.query('select pg_advisory_xact_lock(7412, $1::int)', [id_pengguna]);
    const conflict = await assignmentConflict(client, {
      id_pengguna,
      tarikh_tugas,
      masa_mula,
      masa_tamat,
      id_jadual: updateId,
    });
    if (conflict) {
      await client.query('rollback');
      return res.status(409).json({ message: 'Pengawal mempunyai tugasan yang bertindih pada waktu ini' });
    }

    let result;
    if (updateId) {
      result = await client.query(
        `update tbl_jadual_bertugas
         set id_pengguna = $1, id_pos = $2, tarikh_tugas = $3, syif = $4,
             masa_mula = $5, masa_tamat = $6, catatan = $7, tarikh_kemaskini = now()
         where id_jadual = $8 returning *`,
        [id_pengguna, id_pos, tarikh_tugas, syif, masa_mula, masa_tamat, catatan || null, updateId]
      );
    } else {
      result = await client.query(
        `insert into tbl_jadual_bertugas
           (id_jadual_mingguan, id_pengguna, id_pos, tarikh_tugas, syif, masa_mula, masa_tamat, status_bertugas, catatan, dicipta_oleh)
         values ($1, $2, $3, $4, $5, $6, $7, 'Dijadualkan', $8, $9)
         returning *`,
        [weekId, id_pengguna, id_pos, tarikh_tugas, syif, masa_mula, masa_tamat, catatan || null, req.user.id_pengguna]
      );
    }
    await logAudit(client, req.user.id_pengguna, updateId ? 'UPDATE_ASSIGNMENT' : 'CREATE_ASSIGNMENT', `Tugasan #${result.rows[0].id_jadual}`, 'Jadual bertugas disimpan');
    await client.query('commit');
    res.status(updateId ? 200 : 201).json(result.rows[0]);
  } catch (error) {
    await client.query('rollback');
    console.error('Save schedule assignment error:', error);
    res.status(500).json({ message: 'Gagal menyimpan tugasan jadual' });
  } finally {
    client.release();
  }
};

const deleteAssignment = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `delete from tbl_jadual_bertugas s
       using tbl_jadual_mingguan w
       where s.id_jadual = $1 and w.id_jadual_mingguan = s.id_jadual_mingguan
         and ($2 <> $3 or w.status_jadual <> 'Dikunci')
       returning s.id_jadual, s.id_jadual_mingguan`,
      [req.params.id, req.user.nama_peranan, roles.chief]
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Tugasan tidak ditemui atau jadual dikunci' });
    await logAudit(client, req.user.id_pengguna, 'DELETE_ASSIGNMENT', `Tugasan #${req.params.id}`, 'Tugasan dipadam');
    res.json({ message: 'Tugasan dipadam' });
  } catch (error) {
    console.error('Delete assignment error:', error);
    res.status(500).json({ message: 'Gagal memadam tugasan' });
  } finally {
    client.release();
  }
};

const updateWeekStatus = async (req, res) => {
  const statusByAction = { confirm: 'Disahkan', lock: 'Dikunci', unlock: 'Draf' };
  const status = statusByAction[req.params.action];
  if (!status) return res.status(400).json({ message: 'Tindakan status jadual tidak sah' });
  const client = await pool.connect();
  try {
    const result = await client.query(
      `update tbl_jadual_mingguan
       set status_jadual = $1,
           disahkan_oleh = case when $1 = 'Disahkan' then $2 else disahkan_oleh end,
           tarikh_disahkan = case when $1 = 'Disahkan' then now() else tarikh_disahkan end
       where id_jadual_mingguan = $3
       returning *`,
      [status, req.user.id_pengguna, req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Jadual mingguan tidak ditemui' });
    await logAudit(client, req.user.id_pengguna, 'UPDATE_WEEK_STATUS', `Jadual #${req.params.id}`, status);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update week status error:', error);
    res.status(500).json({ message: 'Gagal mengemas kini status jadual' });
  } finally {
    client.release();
  }
};

const checkAttendance = async (req, res, action) => {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const assignment = await client.query(
      `select id_jadual, id_pengguna
       from tbl_jadual_bertugas
       where id_jadual = $1 and id_pengguna = $2 and tarikh_tugas = current_date
       for update`,
      [req.params.id, req.user.id_pengguna]
    );
    if (!assignment.rowCount) {
      await client.query('rollback');
      return res.status(404).json({ message: 'Tugasan hari ini tidak ditemui untuk akaun anda' });
    }
    const assignmentId = assignment.rows[0].id_jadual;
    if (action === 'check-in') {
      const attendance = await client.query(
        `insert into tbl_kehadiran_tugas (id_jadual, id_pengguna, masa_check_in, status_kehadiran)
         values ($1, $2, now(), 'Hadir')
         on conflict (id_jadual) do nothing
         returning *`,
        [assignmentId, req.user.id_pengguna]
      );
      if (!attendance.rowCount) {
        await client.query('rollback');
        return res.status(409).json({ message: 'Check-in telah direkodkan' });
      }
      await client.query("update tbl_jadual_bertugas set status_bertugas = 'Hadir' where id_jadual = $1", [assignmentId]);
      await client.query('commit');
      return res.json(attendance.rows[0]);
    }
    const result = await client.query(
      `update tbl_kehadiran_tugas
       set masa_check_out = now(), status_kehadiran = 'Selesai'
       where id_jadual = $1 and id_pengguna = $2 and masa_check_in is not null and masa_check_out is null
       returning *`,
      [assignmentId, req.user.id_pengguna]
    );
    if (!result.rowCount) {
      await client.query('rollback');
      return res.status(409).json({ message: 'Check-in diperlukan sebelum check-out' });
    }
    await client.query("update tbl_jadual_bertugas set status_bertugas = 'Selesai' where id_jadual = $1", [assignmentId]);
    await client.query('commit');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('rollback');
    console.error(`${action} attendance error:`, error);
    res.status(500).json({ message: 'Gagal mengemas kini kehadiran' });
  } finally {
    client.release();
  }
};

const checkIn = (req, res) => checkAttendance(req, res, 'check-in');
const checkOut = (req, res) => checkAttendance(req, res, 'check-out');

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted field');
  if (row.length || value) {
    row.push(value);
    if (row.some((cell) => cell.trim())) rows.push(row);
  }
  return rows;
};

const importSchedules = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Pilih fail CSV untuk diimport' });
  let client;
  let transactionStarted = false;
  let filePersisted = false;
  try {
    client = await pool.connect();
    if (path.extname(req.file.originalname).toLowerCase() !== '.csv') {
      return res.status(400).json({ message: 'Format fail mesti CSV' });
    }
    const rows = parseCsv(fs.readFileSync(req.file.path, 'utf8').replace(/^\uFEFF/, ''));
    const expectedHeaders = ['id_pengguna', 'id_pos', 'tarikh_tugas', 'syif', 'masa_mula', 'masa_tamat', 'catatan'];
    const headers = (rows.shift() || []).map((header) => header.trim().toLowerCase());
    if (expectedHeaders.some((header) => !headers.includes(header))) {
      return res.status(400).json({ message: `CSV perlu mempunyai lajur: ${expectedHeaders.join(', ')}` });
    }
    if (!rows.length) return res.status(400).json({ message: 'CSV tidak mengandungi tugasan untuk diimport' });
    const indexOf = Object.fromEntries(expectedHeaders.map((header) => [header, headers.indexOf(header)]));
    const weekResult = await client.query('select * from tbl_jadual_mingguan where id_jadual_mingguan = $1', [req.params.id]);
    const week = weekResult.rows[0];
    if (!week) return res.status(404).json({ message: 'Jadual mingguan tidak ditemui' });
    await client.query('begin');
    transactionStarted = true;
    let imported = 0;
    for (const [rowIndex, row] of rows.entries()) {
      const assignment = Object.fromEntries(expectedHeaders.map((header) => [header, row[indexOf[header]]?.trim() || '']));
      if (!/^[1-9]\d*$/.test(assignment.id_pengguna) || !/^[1-9]\d*$/.test(assignment.id_pos) || !validDate(assignment.tarikh_tugas)
        || !validShifts.includes(assignment.syif) || !validTime(assignment.masa_mula) || !validTime(assignment.masa_tamat)
        || timeInSeconds(assignment.masa_mula) === timeInSeconds(assignment.masa_tamat)
        || assignment.tarikh_tugas < String(week.tarikh_mula).slice(0, 10)
        || assignment.tarikh_tugas > String(week.tarikh_tamat).slice(0, 10)) {
        throw new Error(`Baris ${rowIndex + 2}: data tugasan tidak sah atau di luar minggu jadual`);
      }
      await client.query('select pg_advisory_xact_lock(7412, $1::int)', [assignment.id_pengguna]);
      const conflict = await assignmentConflict(client, assignment);
      if (conflict) throw new Error(`Baris ${rowIndex + 2}: pengawal mempunyai tugasan bertindih`);
      await client.query(
        `insert into tbl_jadual_bertugas
           (id_jadual_mingguan, id_pengguna, id_pos, tarikh_tugas, syif, masa_mula, masa_tamat, catatan, dicipta_oleh)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [req.params.id, assignment.id_pengguna, assignment.id_pos, assignment.tarikh_tugas, assignment.syif, assignment.masa_mula, assignment.masa_tamat, assignment.catatan || null, req.user.id_pengguna]
      );
      imported += 1;
    }
    await client.query(
      `insert into tbl_fail_jadual (id_jadual_mingguan, nama_fail, jenis_fail, path_fail, dimuat_naik_oleh)
       values ($1, $2, 'CSV', $3, $4)`,
      [req.params.id, req.file.originalname, `/uploads/${req.file.filename}`, req.user.id_pengguna]
    );
    await logAudit(client, req.user.id_pengguna, 'IMPORT_SCHEDULE_CSV', `Jadual #${req.params.id}`, `${imported} tugasan diimport`);
    await client.query('commit');
    transactionStarted = false;
    filePersisted = true;
    res.json({ imported });
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('rollback');
      } catch (rollbackError) {
        console.error('Rollback schedule CSV import error:', rollbackError);
      }
    }
    console.error('Import schedule CSV error:', error);
    const isInputError = error.message.startsWith('Baris') || error.message.startsWith('CSV');
    res.status(isInputError ? 400 : 500)
      .json({ message: isInputError ? error.message : 'Gagal mengimport jadual' });
  } finally {
    if (client) client.release();
    if (!filePersisted) await removeUploadedFile(req.file);
  }
};

const uploadSchedulePdf = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Pilih fail PDF' });
  if (req.file.mimetype !== 'application/pdf') {
    await removeUploadedFile(req.file);
    return res.status(400).json({ message: 'Format fail mesti PDF' });
  }
  let client;
  let transactionStarted = false;
  let filePersisted = false;
  try {
    client = await pool.connect();
    await client.query('begin');
    transactionStarted = true;
    const result = await client.query(
      `insert into tbl_fail_jadual (id_jadual_mingguan, nama_fail, jenis_fail, path_fail, dimuat_naik_oleh)
       select $1, $2, 'PDF', $3, $4
       where exists (select 1 from tbl_jadual_mingguan where id_jadual_mingguan = $1)
       returning *`,
      [req.params.id, req.file.originalname, `/uploads/${req.file.filename}`, req.user.id_pengguna]
    );
    if (!result.rowCount) {
      await client.query('rollback');
      transactionStarted = false;
      return res.status(404).json({ message: 'Jadual mingguan tidak ditemui' });
    }
    await logAudit(client, req.user.id_pengguna, 'UPLOAD_SCHEDULE_PDF', `Jadual #${req.params.id}`, req.file.originalname);
    await client.query('commit');
    transactionStarted = false;
    filePersisted = true;
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('rollback');
      } catch (rollbackError) {
        console.error('Rollback schedule PDF upload error:', rollbackError);
      }
    }
    console.error('Upload schedule PDF error:', error);
    res.status(500).json({ message: 'Gagal memuat naik PDF jadual' });
  } finally {
    if (client) client.release();
    if (!filePersisted) await removeUploadedFile(req.file);
  }
};

module.exports = {
  getWeeks,
  getWeek,
  getCoverage,
  getMySchedule,
  getPosReqs,
  addPosReq,
  checkConflict,
  saveAssignment,
  deleteAssignment,
  importSchedules,
  uploadSchedulePdf,
  updateWeekStatus,
  checkIn,
  checkOut,
};
