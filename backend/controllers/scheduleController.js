const fs = require('fs');
const path = require('path');
const { createHash } = require('node:crypto');
const pool = require('../config/db');
const { logAudit } = require('../utils/audit');
const { roles } = require('../middleware/auth');
const { todaySql, eligibleSql, checkInSql } = require('../utils/attendance');

const validShifts = ['Pagi', 'Petang', 'Malam', 'Office Hour'];

// PostgreSQL DATE must retain its calendar value, independent of Node's timezone.
const weekQuery = 'select *, tarikh_mula::text as tarikh_mula, tarikh_tamat::text as tarikh_tamat from tbl_jadual_mingguan where id_jadual_mingguan = $1';
const latestAssignmentChange = `left join lateral (
  select a.jenis_aktiviti as change_action, a.nilai_baharu::jsonb->'actor' as changed_by
  from tbl_audit_trail a where a.modul_sistem = 'Jadual Bertugas'
    and a.rekod_terlibat = 'Tugasan #' || s.id_jadual
  order by a.id_audit desc limit 1
) activity on true`;

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
  let client;
  try {
    client = await pool.connect();
    const result = await client.query('select *, tarikh_mula::text as tarikh_mula, tarikh_tamat::text as tarikh_tamat from tbl_jadual_mingguan order by tbl_jadual_mingguan.tarikh_mula desc');
    res.json(result.rows);
  } catch (error) {
    console.error('Get schedule weeks error:', error.code || error.name);
    res.status(500).json({ message: 'Gagal memuatkan jadual mingguan' });
  } finally {
    client?.release();
  }
};

const getWeek = async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      weekQuery,
      [req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Jadual mingguan tidak ditemui' });
    const activity = await client.query(
      `select id_audit, jenis_aktiviti as action, nilai_baharu::jsonb as change,
              (tarikh_masa_aktiviti at time zone 'Asia/Kuala_Lumpur') as changed_at
       from tbl_audit_trail
       where modul_sistem = 'Jadual Bertugas' and
         (case when modul_sistem = 'Jadual Bertugas' then nilai_baharu::jsonb end)->>'week_id' = $1
       order by id_audit desc limit 20`,
      [String(result.rows[0].id_jadual_mingguan)]
    );
    res.json({ ...result.rows[0], activity: activity.rows });
  } catch (error) {
    console.error('Get schedule week error:', error.code || error.name);
    res.status(500).json({ message: 'Gagal memuatkan jadual mingguan' });
  } finally {
    client?.release();
  }
};

const getCoverage = async (req, res) => {
  const date = req.query.date;
  if (date !== undefined && !validDate(date)) return res.status(400).json({ message: 'Tarikh liputan tidak sah' });
  let client;
  try {
    client = await pool.connect();
    const weekResult = await client.query(
      weekQuery,
      [req.params.id]
    );
    const week = weekResult.rows[0];
    if (!week) return res.status(404).json({ message: 'Jadual mingguan tidak ditemui' });
    if (date && (date < week.tarikh_mula || date > week.tarikh_tamat)) return res.status(400).json({ message: 'Tarikh liputan mesti berada dalam minggu dipilih' });

    const [requirements, assignments] = [
      await client.query(
        `select k.id_pos, k.syif, k.bilangan_diperlukan, p.nama_pos
         from tbl_keperluan_pos k
         join tbl_pos_kawalan p on p.id_pos = k.id_pos
         where k.status_aktif = true
         order by p.nama_pos, k.syif`
      ),
      await client.query(
        `select s.*, s.tarikh_tugas::text as tarikh_tugas, p.nama_penuh, p.nama_pengguna, pos.nama_pos,
                ${req.query.overview === 'week' ? 'null as change_action, null as changed_by' : 'activity.change_action, activity.changed_by'}
         from tbl_jadual_bertugas s
         join tbl_pengguna p on p.id_pengguna = s.id_pengguna
         join tbl_pos_kawalan pos on pos.id_pos = s.id_pos
         ${req.query.overview === 'week' ? '' : latestAssignmentChange}
         where s.id_jadual_mingguan = $1 and ($2::date is null or s.tarikh_tugas = $2::date)
         order by s.tarikh_tugas, s.syif, pos.nama_pos, p.nama_penuh`,
        [req.params.id, date || null]
      ),
    ];

    if (req.query.overview === 'week') {
      const counts = new Map();
      for (const assignment of assignments.rows) {
        const key = [assignment.tarikh_tugas, assignment.id_pos, assignment.syif].join(':');
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      const days = [];
      for (const day = new Date(week.tarikh_mula); days.length < 7; day.setUTCDate(day.getUTCDate() + 1)) {
        const date = day.toISOString().slice(0, 10);
        if (date > week.tarikh_tamat) break;
        const shortage = requirements.rows.reduce((total, row) => total + Math.max(
          0, row.bilangan_diperlukan - (counts.get([date, row.id_pos, row.syif].join(':')) || 0)
        ), 0);
        days.push({ date, shortage });
      }
      return res.json({ days, hasRequirements: requirements.rows.some(row => row.bilangan_diperlukan > 0) });
    }
    const coverageByPost = requirements.rows.map((requirement) => {
      const matchingAssignments = assignments.rows.filter(
        (assignment) => assignment.id_pos === requirement.id_pos && assignment.syif === requirement.syif
      );
      const days = date ? 1 : Math.max(
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
      shortage: coverageByPost.reduce((sum, item) => sum + item.shortage, 0),
      activeDutyCount: assignments.rows.filter((item) => item.status_bertugas === 'Hadir').length,
      absentGuardCount: assignments.rows.filter((item) => item.status_bertugas === 'Tidak Hadir').length,
      uncoveredPosts: coverageByPost.filter((item) => item.shortage > 0),
    });
  } catch (error) {
    console.error('Get schedule coverage error:', error.code || error.name);
    res.status(500).json({ message: 'Gagal mengira liputan jadual' });
  } finally {
    client?.release();
  }
};

const getMySchedule = async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      `select s.*, s.tarikh_tugas::text as tarikh_tugas, pos.nama_pos, pos.nama_bangunan, pos.lokasi,
              (${checkInSql('s')} and a.masa_check_in is null) as can_check_in,
              (${eligibleSql('s')} and a.masa_check_in is not null and a.masa_check_out is null) as can_check_out,
              coalesce(a.status_kehadiran, 'Belum Hadir') as status_kehadiran,
              a.masa_check_in, a.masa_check_out, w.status_jadual, activity.change_action,
              activity.changed_by->>'role' as changed_by_role,
              (s.tarikh_tugas + s.masa_tamat + case when s.masa_tamat < s.masa_mula then interval '1 day' else interval '0 days' end
                > (now() at time zone 'Asia/Kuala_Lumpur')) as upcoming
       from tbl_jadual_bertugas s
       join tbl_pos_kawalan pos on pos.id_pos = s.id_pos
       join tbl_jadual_mingguan w using(id_jadual_mingguan)
       ${latestAssignmentChange}
       left join tbl_kehadiran_tugas a on a.id_jadual = s.id_jadual
       where s.id_pengguna = $1 and (s.tarikh_tugas >= ${todaySql} or ${eligibleSql('s')})
       order by s.tarikh_tugas, s.masa_mula`,
      [req.user.id_pengguna]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get guard schedule error:', error.code || error.name);
    res.status(500).json({ message: 'Gagal memuatkan jadual bertugas' });
  } finally {
    client?.release();
  }
};

const getPosReqs = async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      `select k.*, p.nama_pos
       from tbl_keperluan_pos k
       join tbl_pos_kawalan p on p.id_pos = k.id_pos
       order by p.nama_pos, k.syif`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get post requirements error:', error.code || error.name);
    res.status(500).json({ message: 'Gagal memuatkan keperluan pos' });
  } finally {
    client?.release();
  }
};

const addPosReq = async (req, res) => {
  const { id_pos, syif, bilangan_diperlukan, status_aktif = true } = req.body;
  const count = Number(bilangan_diperlukan);
  if (!id_pos || !validShifts.includes(syif) || !Number.isInteger(count) || count < 0) {
    return res.status(400).json({ message: 'Pos, syif dan bilangan pengawal tidak sah' });
  }
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      `insert into tbl_keperluan_pos (id_pos, syif, bilangan_diperlukan, status_aktif)
       values ($1, $2, $3, $4)
       on conflict (id_pos, syif)
       do update set bilangan_diperlukan = excluded.bilangan_diperlukan, status_aktif = excluded.status_aktif
       returning *`,
      [id_pos, syif, count, status_aktif === true || status_aktif === 'true']
    );
    await logAudit(client, req.user.id_pengguna, 'UPDATE_POST_REQUIREMENT', `Pos #${id_pos}`, `${syif}: ${count}`);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Save post requirement error:', error.code || error.name);
    res.status(500).json({ message: 'Gagal menyimpan keperluan pos' });
  } finally {
    client?.release();
  }
};

const assignmentConflict = async (client, { id_pengguna, tarikh_tugas, masa_mula, masa_tamat, id_jadual }) => {
  const result = await client.query(
    `select s.id_jadual, s.tarikh_tugas::text, s.masa_mula::text, s.masa_tamat::text, p.nama_pos
     from tbl_jadual_bertugas s
     join tbl_pos_kawalan p on p.id_pos = s.id_pos
     where s.id_pengguna = $1
       and s.id_jadual <> coalesce($5::int, 0)
       and s.tarikh_tugas between $2::date - interval '1 day' and $2::date + interval '1 day'
       and (s.tarikh_tugas + s.masa_mula) <
           (($2::date + $4::time) + case when $4::time <= $3::time then interval '1 day' else interval '0 day' end)
       and ($2::date + $3::time) <
           ((s.tarikh_tugas + s.masa_tamat) + case when s.masa_tamat <= s.masa_mula then interval '1 day' else interval '0 day' end)
     order by s.tarikh_tugas, s.masa_mula, s.id_jadual
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
  let client;
  try {
    client = await pool.connect();
    const conflict = await assignmentConflict(client, { id_pengguna, tarikh_tugas, masa_mula, masa_tamat, id_jadual });
    res.json({
      ok: !conflict,
      critical: conflict ? ['Pengawal mempunyai tugasan yang bertindih pada waktu ini'] : [],
      conflict,
    });
  } catch (error) {
    console.error('Check schedule conflict error:', error.code || error.name);
    res.status(500).json({ message: 'Gagal menyemak konflik jadual' });
  } finally {
    client?.release();
  }
};

const copyWeek = async (req, res) => {
  const preview = req.method === 'GET';
  const { ids, version } = req.body || {};
  if (!preview && (!Array.isArray(ids) || !ids.length || ids.length > 500 ||
      !ids.every(id => Number.isSafeInteger(id) && id > 0) || new Set(ids).size !== ids.length)) {
    return res.status(400).json({ message: 'Pilih tugasan untuk disalin.' });
  }
  const client = await pool.connect();
  try {
    await client.query(preview ? 'begin read only' : 'begin');
    if (!preview) await client.query('select pg_advisory_xact_lock(7413, 1)');
    const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
    const source = (await client.query(weekQuery, [req.params.id])).rows[0];
    if (!source) fail(404, 'Jadual asal tidak ditemui.');
    const { start, end } = (await client.query(
      'select ($1::date + 7)::text as start, ($2::date + 7)::text as end',
      [source.tarikh_mula, source.tarikh_tamat]
    )).rows[0];
    const destinations = (await client.query(
      `select id_jadual_mingguan, status_jadual, tarikh_mula::text, tarikh_tamat::text
       from tbl_jadual_mingguan where tarikh_mula <= $2 and tarikh_tamat >= $1
       ${preview ? '' : 'for update'}`, [start, end]
    )).rows;
    const target = destinations[0];
    if (destinations.length > 1 || (target && (target.tarikh_mula !== start ||
        target.tarikh_tamat !== end || target.status_jadual !== 'Draf'))) {
      fail(409, 'Minggu berikutnya bertindih dengan jadual lain atau bukan draf.');
    }
    const rows = (await client.query(
      `select s.id_jadual, s.id_pengguna, s.id_pos, (s.tarikh_tugas + 7)::text as tarikh_tugas,
              s.syif, s.masa_mula::text, s.masa_tamat::text, p.nama_pos, u.nama_penuh,
              p.status_pos = 'Aktif' and u.status_akaun = 'Aktif' and r.nama_peranan = $2 as active
       from tbl_jadual_bertugas s
       join tbl_pos_kawalan p using(id_pos)
       join tbl_pengguna u on u.id_pengguna = s.id_pengguna
       join tbl_peranan r on r.id_peranan = u.id_peranan
       where s.id_jadual_mingguan = $1 order by s.tarikh_tugas, s.masa_mula, s.id_jadual limit 501`,
      [source.id_jadual_mingguan, roles.guard]
    )).rows;
    if (rows.length > 500) fail(400, 'Minggu ini melebihi had 500 tugasan untuk salinan.');
    const currentVersion = createHash('sha256').update(JSON.stringify([start, end, target, rows])).digest('hex');
    if (preview) {
      for (const row of rows) {
        row.conflict = row.active ? await assignmentConflict(client, { ...row, id_jadual: null }) : null;
      }
      await client.query('commit');
      return res.json({ start, end, version: currentVersion, rows });
    }
    const selected = rows.filter(row => ids.includes(row.id_jadual));
    if (version !== currentVersion || selected.length !== ids.length) fail(409, 'Jadual telah berubah. Semak pratonton semula.');
    if (selected.some(row => !row.active || row.tarikh_tugas < start || row.tarikh_tugas > end ||
        row.masa_mula === row.masa_tamat)) fail(409, 'Terdapat tugasan yang tidak boleh disalin. Semak pratonton semula.');
    const guardIds = [...new Set(selected.map(row => row.id_pengguna))].sort((a, b) => a - b);
    for (const id of guardIds) await client.query('select pg_advisory_xact_lock(7412, $1::int)', [id]);
    const destinationId = target?.id_jadual_mingguan || (await client.query(
      `insert into tbl_jadual_mingguan(tarikh_mula, tarikh_tamat, dicipta_oleh)
       values($1,$2,$3) returning id_jadual_mingguan`, [start, end, req.user.id_pengguna]
    )).rows[0].id_jadual_mingguan;
    for (const row of selected) {
      if (await assignmentConflict(client, { ...row, id_jadual: null })) {
        fail(409, 'Terdapat pertindihan tugasan. Semak pratonton semula.');
      }
      await insertAssignment(client, destinationId, row, req.user);
    }
    await logAudit(client, req.user.id_pengguna, 'COPY_SCHEDULE_WEEK', `Jadual #${destinationId}`, `${selected.length} tugasan disalin`);
    await client.query('commit');
    res.status(201).json({ id: destinationId, copied: selected.length, start });
  } catch (error) {
    await client.query('rollback');
    if (!error.status) console.error('Copy schedule error:', error.code || error.name);
    res.status(error.status || 500).json({ message: error.status ? error.message : 'Gagal menyalin jadual.' });
  } finally {
    client.release();
  }
};

const actorRole = actor => actor.nama_peranan === roles.admin ? 'Admin' : 'Ketua';

const notifyScheduleChange = (client, assignment, title, actor) => client.query(
  `insert into tbl_notifikasi
   (id_pengguna,tajuk_notifikasi,mesej_notifikasi,jenis_notifikasi,tahap_keutamaan)
   select $1,$2,concat(p.nama_pos,' · ',to_char($3::date,'DD/MM/YYYY'),' · ',left($4::time::text,5),'–',left($5::time::text,5),' · Oleh ',$7::text),
          'Jadual Bertugas','Medium'
   from tbl_pos_kawalan p where p.id_pos = $6`,
  [assignment.id_pengguna,title,assignment.tarikh_tugas,assignment.masa_mula,assignment.masa_tamat,assignment.id_pos,actorRole(actor)]
);

const logAssignmentChange = (client, assignment, actor, action, description) => client.query(
  `insert into tbl_audit_trail
     (id_pengguna, modul_sistem, jenis_aktiviti, penerangan_aktiviti, rekod_terlibat, status_aktiviti, tarikh_masa_aktiviti, nilai_baharu)
   select $1, 'Jadual Bertugas', $2, $3, $4, 'Berjaya', now() at time zone 'Asia/Kuala_Lumpur',
          jsonb_build_object('week_id', $5::int, 'date', $6::date, 'shift', $7::text,
            'post', p.nama_pos, 'guard', u.nama_penuh,
            'actor', jsonb_build_object('name', $8::text, 'role', $9::text))::text
   from tbl_pos_kawalan p cross join tbl_pengguna u where p.id_pos = $10 and u.id_pengguna = $11`,
  [actor.id_pengguna, action, description, `Tugasan #${assignment.id_jadual}`, assignment.id_jadual_mingguan,
    assignment.tarikh_tugas, assignment.syif, actor.nama_penuh, actorRole(actor), assignment.id_pos, assignment.id_pengguna]
);

const insertAssignment = async (client, weekId, assignment, actor) => {
  const result = await client.query(
    `insert into tbl_jadual_bertugas
       (id_jadual_mingguan, id_pengguna, id_pos, tarikh_tugas, syif, masa_mula, masa_tamat, status_bertugas, catatan, dicipta_oleh)
     values ($1, $2, $3, $4, $5, $6, $7, 'Dijadualkan', $8, $9)
     returning *`,
    [weekId, assignment.id_pengguna, assignment.id_pos, assignment.tarikh_tugas, assignment.syif,
      assignment.masa_mula, assignment.masa_tamat, assignment.catatan || null, actor.id_pengguna]
  );
  await logAssignmentChange(client, { ...result.rows[0], tarikh_tugas: assignment.tarikh_tugas }, actor, 'CREATE_ASSIGNMENT', 'Tugasan ditambah');
  return result;
};

const saveDailyAssignments = async (req, res) => {
  const { date, assignments } = req.body || {};
  const isId = id => Number.isInteger(id) && id > 0 && id <= 2147483647;
  const weekId = Number(req.params.id);
  if (!isId(weekId) || !validDate(date) || !Array.isArray(assignments) || !assignments.length ||
      assignments.length > 40 || assignments.some(row => !row || !isId(row.id_pengguna) || !isId(row.id_pos) ||
        !validShifts.includes(row.syif) || !validTime(row.masa_mula) || !validTime(row.masa_tamat) ||
        timeInSeconds(row.masa_mula) === timeInSeconds(row.masa_tamat))) {
    return res.status(400).json({ message: 'Pilih antara 1 hingga 40 tugasan yang sah untuk satu hari.' });
  }

  const client = await pool.connect();
  const reject = (status, message, details = {}) => { throw Object.assign(new Error(message), { status, details }); };
  try {
    await client.query('begin');
    const week = (await client.query(weekQuery + ' for update', [weekId])).rows[0];
    if (!week) reject(404, 'Jadual mingguan tidak ditemui.');
    if (req.user.nama_peranan === roles.chief && week.status_jadual === 'Dikunci') reject(409, 'Jadual dikunci oleh Pentadbir Sistem.');
    if (date < week.tarikh_mula || date > week.tarikh_tamat) reject(400, 'Tarikh tugasan mesti berada dalam tempoh jadual mingguan.');

    const guardIds = [...new Set(assignments.map(row => row.id_pengguna))].sort((a, b) => a - b);
    for (const id of guardIds) await client.query('select pg_advisory_xact_lock(7412, $1::int)', [id]);
    const guards = await client.query(
      `select u.id_pengguna, u.nama_penuh from tbl_pengguna u join tbl_peranan r using(id_peranan)
       where u.id_pengguna = any($1::int[]) and u.status_akaun = 'Aktif' and r.nama_peranan = $2 for share of u`,
      [guardIds, roles.guard]
    );
    if (guards.rowCount !== guardIds.length) reject(409, 'Ada pengawal yang tidak lagi aktif. Semak pilihan anda.');
    const guardNames = new Map(guards.rows.map(row => [row.id_pengguna, row.nama_penuh]));

    for (const row of assignments) {
      const { id_pengguna, id_pos, syif, masa_mula, masa_tamat } = row;
      const slot = (await client.query(
        `select p.nama_pos, k.bilangan_diperlukan,
                (select count(*)::int from tbl_jadual_bertugas s where s.id_jadual_mingguan = $1
                 and s.tarikh_tugas = $2 and s.id_pos = $3 and s.syif = $4) as assigned
         from tbl_keperluan_pos k join tbl_pos_kawalan p using(id_pos)
         where k.id_pos = $3 and k.syif = $4 and k.status_aktif and p.status_pos = 'Aktif'
         for share of k, p`,
        [weekId, date, id_pos, syif]
      )).rows[0];
      const target = { id_pos, syif };
      if (!slot || slot.assigned >= slot.bilangan_diperlukan) {
        reject(409, `Kekosongan bagi ${slot?.nama_pos || 'pos ini'} · ${syif} telah berubah. Muat semula kekosongan.`, { target, refresh: true });
      }
      const assignment = { ...target, id_pengguna, tarikh_tugas: date, masa_mula, masa_tamat };
      const conflict = await assignmentConflict(client, assignment);
      if (conflict) reject(409, `${guardNames.get(id_pengguna)} bertindih dengan tugasan lain. Pilih pengawal lain.`, { target, conflict });
      await insertAssignment(client, weekId, assignment, req.user);
      if (week.status_jadual !== 'Draf') await notifyScheduleChange(client, assignment, 'Tugasan baharu', req.user);
    }
    await logAudit(client, req.user.id_pengguna, 'CREATE_DAILY_ASSIGNMENTS', `Jadual #${weekId}`, `${date}: ${assignments.length} tugasan disimpan`);
    await client.query('commit');
    res.status(201).json({ created: assignments.length });
  } catch (error) {
    await client.query('rollback');
    if (!error.status) console.error('Save daily assignments error:', error.code || error.name);
    res.status(error.status || 500).json({ message: error.status ? error.message : 'Gagal menyimpan tugasan harian.', ...error.details });
  } finally {
    client.release();
  }
};

// Every roster write path must reject non-guard, inactive or unknown accounts and inactive posts,
// matching the checks in saveDailyAssignments.
const assignableTarget = async (client, id_pengguna, id_pos) => (await client.query(
  `select exists(select 1 from tbl_pengguna u join tbl_peranan r using(id_peranan)
                 where u.id_pengguna = $1 and u.status_akaun = 'Aktif' and r.nama_peranan = $3) as guard_ok,
          exists(select 1 from tbl_pos_kawalan where id_pos = $2 and status_pos = 'Aktif') as post_ok`,
  [id_pengguna, id_pos, roles.guard]
)).rows[0];

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
  const isId = value => /^[1-9]\d{0,9}$/.test(String(value)) && Number(value) <= 2147483647;
  if (!isId(id_pengguna) || !isId(id_pos) || !validDate(tarikh_tugas) || !validShifts.includes(syif) || !validTime(masa_mula) || !validTime(masa_tamat)) {
    return res.status(400).json({ message: 'Maklumat tugasan jadual tidak sah' });
  }
  if (timeInSeconds(masa_mula) === timeInSeconds(masa_tamat)) {
    return res.status(400).json({ message: 'Masa mula dan tamat tidak boleh sama' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('begin');
    const updateId = req.method === 'PUT' ? req.params.id : null;
    let previous;
    let weekId = req.method === 'POST' ? parseWeekId(req.params.id) : null;
    if (updateId) {
      const existing = await client.query(
        'select *, tarikh_tugas::text from tbl_jadual_bertugas where id_jadual = $1 for update',
        [updateId]
      );
      if (!existing.rowCount) {
        if (client) await client.query('rollback');
        return res.status(404).json({ message: 'Tugasan jadual tidak ditemui' });
      }
      previous = existing.rows[0];
      weekId = previous.id_jadual_mingguan;
    }
    const weekResult = await client.query(
      weekQuery + ' for share',
      [weekId]
    );
    const week = weekResult.rows[0];
    if (!week) {
      if (client) await client.query('rollback');
      return res.status(404).json({ message: 'Jadual mingguan tidak ditemui' });
    }
    if (req.user.nama_peranan === roles.chief && week.status_jadual === 'Dikunci') {
      if (client) await client.query('rollback');
      return res.status(409).json({ message: 'Jadual dikunci oleh Pentadbir Sistem' });
    }
    if (tarikh_tugas < String(week.tarikh_mula).slice(0, 10) || tarikh_tugas > String(week.tarikh_tamat).slice(0, 10)) {
      if (client) await client.query('rollback');
      return res.status(400).json({ message: 'Tarikh tugasan mesti berada dalam tempoh jadual mingguan' });
    }

    // An unchanged guard/post on an edit keeps historical assignments editable after deactivation.
    const target = await assignableTarget(client, id_pengguna, id_pos);
    if (!target.guard_ok && String(previous?.id_pengguna) !== String(id_pengguna)) {
      if (client) await client.query('rollback');
      return res.status(409).json({ message: 'Hanya Pengawal Keselamatan yang aktif boleh ditugaskan' });
    }
    if (!target.post_ok && String(previous?.id_pos) !== String(id_pos)) {
      if (client) await client.query('rollback');
      return res.status(409).json({ message: 'Pos kawalan tidak wujud atau tidak aktif' });
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
      if (client) await client.query('rollback');
      return res.status(409).json({ message: 'Pengawal mempunyai tugasan yang bertindih pada waktu ini', conflict });
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
      result = await insertAssignment(client, weekId, { id_pengguna, id_pos, tarikh_tugas, syif, masa_mula, masa_tamat, catatan }, req.user);
    }
    if (week.status_jadual !== 'Draf') {
      const updated = { ...result.rows[0], tarikh_tugas };
      const reassigned = previous && previous.id_pengguna !== updated.id_pengguna;
      if (reassigned) await notifyScheduleChange(client, previous, 'Tugasan dibatalkan', req.user);
      const changed = !previous || ['id_pengguna','id_pos','tarikh_tugas','syif','masa_mula','masa_tamat','catatan']
        .some(key => previous[key] !== updated[key]);
      if (changed) await notifyScheduleChange(client, updated, !previous || reassigned ? 'Tugasan baharu' : 'Tugasan dikemas kini', req.user);
    }
    if (updateId) await logAssignmentChange(client, { ...result.rows[0], tarikh_tugas }, req.user, 'UPDATE_ASSIGNMENT', 'Tugasan disunting');
    await client.query('commit');
    res.status(updateId ? 200 : 201).json(result.rows[0]);
  } catch (error) {
    if (client) await client.query('rollback');
    console.error('Save schedule assignment error:', error.code || error.name);
    res.status(500).json({ message: 'Gagal menyimpan tugasan jadual' });
  } finally {
    client?.release();
  }
};

const deleteAssignment = async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    await client.query('begin');
    const result = await client.query(
      `delete from tbl_jadual_bertugas s
       using tbl_jadual_mingguan w
       where s.id_jadual = $1 and w.id_jadual_mingguan = s.id_jadual_mingguan
         and ($2 <> $3 or w.status_jadual <> 'Dikunci')
       returning s.*, s.tarikh_tugas::text, w.status_jadual`,
      [req.params.id, req.user.nama_peranan, roles.chief]
    );
    if (!result.rowCount) {
      await client.query('rollback');
      return res.status(404).json({ message: 'Tugasan tidak ditemui atau jadual dikunci' });
    }
    if (result.rows[0].status_jadual !== 'Draf') await notifyScheduleChange(client, result.rows[0], 'Tugasan dibatalkan', req.user);
    await logAssignmentChange(client, result.rows[0], req.user, 'DELETE_ASSIGNMENT', 'Tugasan dipadam');
    await client.query('commit');
    res.json({ message: 'Tugasan dipadam' });
  } catch (error) {
    if (client) await client.query('rollback');
    console.error('Delete assignment error:', error.code || error.name);
    res.status(500).json({ message: 'Gagal memadam tugasan' });
  } finally {
    client?.release();
  }
};

const updateWeekStatus = async (req, res) => {
  const statusByAction = { confirm: 'Disahkan', lock: 'Dikunci', unlock: 'Draf' };
  const status = statusByAction[req.params.action];
  if (!status) return res.status(400).json({ message: 'Tindakan status jadual tidak sah' });
  let client;
  try {
    client = await pool.connect();
    await client.query('begin');
    const previous = (await client.query(weekQuery + ' for update', [req.params.id])).rows[0];
    if (!previous) {
      await client.query('rollback');
      return res.status(404).json({ message: 'Jadual mingguan tidak ditemui' });
    }
    const result = await client.query(
      `update tbl_jadual_mingguan
       set status_jadual = $1::text,
           disahkan_oleh = case when $1::text = 'Disahkan' then $2::int else disahkan_oleh end,
           tarikh_disahkan = case when $1::text = 'Disahkan' then now() else tarikh_disahkan end
       where id_jadual_mingguan = $3
       returning *`,
      [status, req.user.id_pengguna, req.params.id]
    );
    if (previous.status_jadual === 'Draf' && status !== 'Draf') {
      await client.query(
        `insert into tbl_notifikasi
         (id_pengguna,tajuk_notifikasi,mesej_notifikasi,jenis_notifikasi,tahap_keutamaan)
         select distinct id_pengguna,'Jadual bertugas tersedia',
                concat('Semak tugasan anda bagi ', $2::date, ' hingga ', $3::date, '.'),
                'Jadual Bertugas','Medium'
         from tbl_jadual_bertugas where id_jadual_mingguan = $1 and tarikh_tugas >= ${todaySql} - 1`,
        [req.params.id,previous.tarikh_mula,previous.tarikh_tamat]
      );
    }
    await logAudit(client, req.user.id_pengguna, 'UPDATE_WEEK_STATUS', `Jadual #${req.params.id}`, status);
    await client.query('commit');
    res.json(result.rows[0]);
  } catch (error) {
    if (client) await client.query('rollback');
    console.error('Update week status error:', error.code || error.name);
    res.status(500).json({ message: 'Gagal mengemas kini status jadual' });
  } finally {
    client?.release();
  }
};

const checkAttendance = async (req, res, action) => {
  let client;
  try {
    client = await pool.connect();
    await client.query('begin');
    const assignment = await client.query(
      `select id_jadual, id_pengguna
       from tbl_jadual_bertugas
       where id_jadual = $1 and id_pengguna = $2 and ${action === 'check-in' ? checkInSql() : eligibleSql()}
       for update`,
      [req.params.id, req.user.id_pengguna]
    );
    if (!assignment.rowCount) {
      if (client) await client.query('rollback');
      return res.status(404).json({ message: 'Tugasan yang layak untuk kehadiran tidak ditemui untuk akaun anda' });
    }
    const assignmentId = assignment.rows[0].id_jadual;
    if (action === 'check-in') {
      const attendance = await client.query(
        `insert into tbl_kehadiran_tugas (id_jadual, id_pengguna, masa_check_in, status_kehadiran)
         values ($1, $2, now() at time zone 'Asia/Kuala_Lumpur', 'Hadir')
         on conflict (id_jadual) do nothing
         returning *`,
        [assignmentId, req.user.id_pengguna]
      );
      if (!attendance.rowCount) {
        if (client) await client.query('rollback');
        return res.status(409).json({ message: 'Check-in telah direkodkan' });
      }
      await client.query("update tbl_jadual_bertugas set status_bertugas = 'Hadir' where id_jadual = $1", [assignmentId]);
      await client.query('commit');
      return res.json(attendance.rows[0]);
    }
    const result = await client.query(
      `update tbl_kehadiran_tugas
       set masa_check_out = now() at time zone 'Asia/Kuala_Lumpur', status_kehadiran = 'Selesai'
       where id_jadual = $1 and id_pengguna = $2 and masa_check_in is not null and masa_check_out is null
       returning *`,
      [assignmentId, req.user.id_pengguna]
    );
    if (!result.rowCount) {
      if (client) await client.query('rollback');
      return res.status(409).json({ message: 'Check-in diperlukan sebelum check-out' });
    }
    await client.query("update tbl_jadual_bertugas set status_bertugas = 'Selesai' where id_jadual = $1", [assignmentId]);
    await client.query('commit');
    res.json(result.rows[0]);
  } catch (error) {
    if (client) await client.query('rollback');
    console.error(`${action} attendance error:`, error);
    res.status(500).json({ message: 'Gagal mengemas kini kehadiran' });
  } finally {
    client?.release();
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
    await client.query('begin');
    transactionStarted = true;
    const weekResult = await client.query(weekQuery + ' for share', [req.params.id]);
    const week = weekResult.rows[0];
    if (!week) {
      await client.query('rollback');
      transactionStarted = false;
      return res.status(404).json({ message: 'Jadual mingguan tidak ditemui' });
    }
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
      const target = await assignableTarget(client, assignment.id_pengguna, assignment.id_pos);
      if (!target.guard_ok) throw new Error(`Baris ${rowIndex + 2}: pengguna bukan Pengawal Keselamatan yang aktif`);
      if (!target.post_ok) throw new Error(`Baris ${rowIndex + 2}: pos kawalan tidak wujud atau tidak aktif`);
      await client.query('select pg_advisory_xact_lock(7412, $1::int)', [assignment.id_pengguna]);
      const conflict = await assignmentConflict(client, assignment);
      if (conflict) throw new Error(`Baris ${rowIndex + 2}: pengawal mempunyai tugasan bertindih`);
      await insertAssignment(client, req.params.id, assignment, req.user);
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
        if (client) await client.query('rollback');
      } catch (rollbackError) {
        console.error('Rollback schedule CSV import error:', rollbackError);
      }
    }
    console.error('Import schedule CSV error:', error.code || error.name);
    const isInputError = error.message.startsWith('Baris') || error.message.startsWith('CSV');
    res.status(isInputError ? 400 : 500)
      .json({ message: isInputError ? error.message : 'Gagal mengimport jadual' });
  } finally {
    if (client) client?.release();
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
      if (client) await client.query('rollback');
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
        if (client) await client.query('rollback');
      } catch (rollbackError) {
        console.error('Rollback schedule PDF upload error:', rollbackError);
      }
    }
    console.error('Upload schedule PDF error:', error.code || error.name);
    res.status(500).json({ message: 'Gagal memuat naik PDF jadual' });
  } finally {
    if (client) client?.release();
    if (!filePersisted) await removeUploadedFile(req.file);
  }
};

module.exports = require('../utils/asyncHandlers')({
  getWeeks,
  getWeek,
  getCoverage,
  getMySchedule,
  getPosReqs,
  addPosReq,
  checkConflict,
  copyWeek,
  saveAssignment,
  saveDailyAssignments,
  deleteAssignment,
  importSchedules,
  uploadSchedulePdf,
  updateWeekStatus,
  checkIn,
  checkOut,
});
