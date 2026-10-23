const { logAudit } = require('../utils/audit');

const HOTSPOTS = ['HOTSPOT_MAIN_ENTRANCE','HOTSPOT_CENTRAL_BLOCK','HOTSPOT_LEFT_WING','HOTSPOT_RIGHT_WING','HOTSPOT_FRONT_PLAZA','HOTSPOT_LEFT_TOWER','HOTSPOT_RIGHT_TOWER'];
function fail(status, message) { const error = new Error(message); error.status = status; throw error; }
function positiveId(value) {
  if (!/^[1-9]\d*$/.test(String(value)) || Number(value) > 2147483647) fail(400, 'ID tidak sah');
  return Number(value);
}
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '2100-12-31') return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
function period(query = {}) {
  const date = query.date ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const from = query.from ?? date; const to = query.to ?? date;
  if (![date, from, to].every(validDate) || from > to || (Date.parse(to) - Date.parse(from)) / 86400000 > 365) fail(400, 'Tarikh tidak sah. Julat laporan maksimum 366 hari.');
  return { date, from, to, timezone: 'Asia/Kuala_Lumpur' };
}

// Half-open overlap includes yesterday's overnight duty in the selected KL day.
const dutyWhere = `s.tarikh_tugas between $2::date - 1 and $2::date
  and (s.tarikh_tugas + s.masa_mula) < ($2::date + interval '1 day')
  and (s.tarikh_tugas + s.masa_tamat + case when s.masa_tamat <= s.masa_mula then interval '1 day' else interval '0 day' end) > $2::date`;
const dutyCte = `duty as (
 select s.*, w.status_jadual,
   k.masa_check_in, k.masa_check_out,
   case when k.masa_check_out is not null and k.masa_check_in is null then 'Unknown'
        when k.masa_check_out is not null then 'Checked Out'
        when k.masa_check_in is not null then 'Checked In'
        else 'No Check-In Recorded' end as attendance_state
 from tbl_jadual_bertugas s join tbl_jadual_mingguan w using(id_jadual_mingguan)
 left join tbl_kehadiran_tugas k on k.id_jadual=s.id_jadual and k.id_pengguna=s.id_pengguna
 where s.id_pos = any($1::int[]) and ${dutyWhere}
)`;
const reportCte = `reports as (
 select l.id_laporan,l.id_pos,l.tajuk_laporan,l.tarikh_laporan,l.masa_laporan,l.status_laporan,
   case when n.tahap_risiko in ('Low','Medium','High','Critical') then n.tahap_risiko else 'Unknown' end as tahap_risiko,
   n.kategori_dikesan
 from tbl_laporan_harian l
 left join lateral (select tahap_risiko,kategori_dikesan from tbl_hasil_nlp where id_laporan=l.id_laporan order by tarikh_analisis desc,id_nlp desc limit 1) n on true
 where l.id_pos=any($1::int[]) and l.tarikh_laporan between $3::date and $4::date
)`;

function createService(pool) {
  async function locations(client = pool) {
    return (await client.query('select * from tbl_lokasi_3d order by id_lokasi')).rows;
  }
  async function aggregates(client, ids, p) {
    if (!ids.length) return [];
    const result = await client.query(`with ${dutyCte}, ${reportCte},
     schedules as (select id_pos,count(*)::int as assignments,
       count(*) filter(where status_jadual in ('Disahkan','Dikunci'))::int as confirmed,
       count(*) filter(where status_jadual not in ('Disahkan','Dikunci'))::int as draft,
       count(*) filter(where attendance_state='Checked In')::int as checked_in,
       count(*) filter(where attendance_state='Checked Out')::int as checked_out,
       count(*) filter(where attendance_state='No Check-In Recorded')::int as no_check_in,
       count(*) filter(where attendance_state='Unknown')::int as unknown_attendance from duty group by id_pos),
     incidents as (select id_pos,count(*)::int as reports,
       count(*) filter(where tahap_risiko='Low')::int as low,
       count(*) filter(where tahap_risiko='Medium')::int as medium,
       count(*) filter(where tahap_risiko='High')::int as high,
       count(*) filter(where tahap_risiko='Critical')::int as critical,
       count(*) filter(where tahap_risiko='Unknown')::int as unknown from reports group by id_pos),
     actions as (select r.id_pos,count(*)::int as total,
       count(*) filter(where a.status_tindakan<>'Selesai')::int as open,
       count(*) filter(where a.status_tindakan='Dalam Tindakan')::int as in_progress,
       count(*) filter(where a.status_tindakan='Selesai')::int as completed
       from tbl_tindakan_susulan a join reports r using(id_laporan) group by r.id_pos)
     select p.id_pos,
       jsonb_build_object('assignments',coalesce(s.assignments,0),'confirmed',coalesce(s.confirmed,0),'draft',coalesce(s.draft,0)) as schedule,
       jsonb_build_object('checked_in',coalesce(s.checked_in,0),'checked_out',coalesce(s.checked_out,0),'no_check_in',coalesce(s.no_check_in,0),'unknown',coalesce(s.unknown_attendance,0)) as attendance,
       jsonb_build_object('total',coalesce(i.reports,0),'Low',coalesce(i.low,0),'Medium',coalesce(i.medium,0),'High',coalesce(i.high,0),'Critical',coalesce(i.critical,0),'Unknown',coalesce(i.unknown,0)) as incidents,
       jsonb_build_object('total',coalesce(a.total,0),'open',coalesce(a.open,0),'in_progress',coalesce(a.in_progress,0),'completed',coalesce(a.completed,0)) as follow_up
     from tbl_pos_kawalan p left join schedules s using(id_pos) left join incidents i using(id_pos) left join actions a using(id_pos)
     where p.id_pos=any($1::int[])`, [ids, p.date, p.from, p.to]);
    return result.rows;
  }
  async function snapshot(fn) {
    const client = await pool.connect();
    try { await client.query('begin isolation level repeatable read read only'); const result = await fn(client); await client.query('commit'); return result; }
    catch (error) { await client.query('rollback'); throw error; }
    finally { client.release(); }
  }
  async function overview(p) {
    return snapshot(async (client) => {
      const rows = await locations(client);
      const ids = [...new Set(rows.filter((l) => l.status_aktif && l.id_pos).map((l) => l.id_pos))];
      const posts = await aggregates(client, ids, p);
      return { period: p, refreshed_at: new Date().toISOString(), locations: rows.map((location) => ({ ...location, metrics: location.status_aktif ? posts.find((post) => post.id_pos === location.id_pos) ?? null : null })),
        totals: { locations: rows.length, linked_posts: ids.length, assignments: posts.reduce((n,p) => n+p.schedule.assignments,0), reports: posts.reduce((n,p) => n+p.incidents.total,0), high_critical: posts.reduce((n,p) => n+p.incidents.High+p.incidents.Critical,0), open_actions: posts.reduce((n,p) => n+p.follow_up.open,0) } };
    });
  }
  async function summary(id, p) {
    return snapshot(async (client) => {
      const location = (await client.query('select * from tbl_lokasi_3d where id_lokasi=$1', [id])).rows[0];
      if (!location) fail(404, 'Lokasi 3D tidak ditemui');
      const base = { location, period: p, refreshed_at: new Date().toISOString() };
      if (!location.status_aktif || !location.id_pos) return { ...base, linked: false, reason: !location.status_aktif ? 'Lokasi dinyahaktifkan' : 'Belum dipautkan kepada pos kawalan', post: null };
      const post = (await client.query('select id_pos,nama_pos,nama_bangunan,lokasi,waktu_operasi,status_pos from tbl_pos_kawalan where id_pos=$1', [location.id_pos])).rows[0];
      if (!post) return { ...base, linked: false, reason: 'Pautan pos tidak lagi tersedia', post: null };
      const params = [[post.id_pos],p.date,p.from,p.to];
      const metrics = (await aggregates(client, params[0], p))[0];
      const assignments = (await client.query(`with ${dutyCte}
        select d.id_jadual,d.syif,d.tarikh_tugas::text,d.masa_mula::text,d.masa_tamat::text,d.status_bertugas,d.status_jadual,u.nama_penuh,
          d.attendance_state, (d.masa_check_in at time zone 'Asia/Kuala_Lumpur') as masa_check_in,
          (d.masa_check_out at time zone 'Asia/Kuala_Lumpur') as masa_check_out,
          (d.tarikh_tugas+d.masa_mula) at time zone 'Asia/Kuala_Lumpur' as starts_at,
          (d.tarikh_tugas+d.masa_tamat+case when d.masa_tamat<=d.masa_mula then interval '1 day' else interval '0 day' end) at time zone 'Asia/Kuala_Lumpur' as ends_at
        from duty d join tbl_pengguna u using(id_pengguna) order by d.tarikh_tugas,d.masa_mula,d.id_jadual limit 200`, params.slice(0,2))).rows;
      const reports = (await client.query(`with ${reportCte} select *,tarikh_laporan::text as tarikh_laporan from reports order by tarikh_laporan desc,masa_laporan desc,id_laporan desc limit 10`, [params[0],p.date,p.from,p.to])).rows;
      const actions = (await client.query(`with ${reportCte}
        select a.id_tindakan,a.id_laporan,a.status_tindakan,a.tahap_keutamaan,a.tarikh_mula::text,a.tarikh_selesai::text,
          pr.jenis_progress, (pr.tarikh_progress at time zone 'Asia/Kuala_Lumpur') as tarikh_progress,pr.perlu_respon_ketua
        from tbl_tindakan_susulan a join reports r using(id_laporan)
        left join lateral (select jenis_progress,tarikh_progress,perlu_respon_ketua from tbl_progress_tindakan where id_tindakan=a.id_tindakan order by tarikh_progress desc,id_progress desc limit 1) pr on true
        order by (a.status_tindakan='Selesai'),a.tarikh_kemaskini desc,a.id_tindakan desc limit 20`, params)).rows;
      return { ...base, linked: true, post, metrics, assignments, reports, actions, limits: { assignments: 200, reports: 10, actions: 20 } };
    });
  }
  async function map(id, body, userId) {
    if (!body || !Object.hasOwn(body, 'id_pos') || Object.keys(body).some((key) => key !== 'id_pos')) fail(400, 'Hantar id_pos sahaja; null untuk nyahpaut');
    const postId = body.id_pos === null ? null : positiveId(body.id_pos);
    const client = await pool.connect();
    try {
      await client.query('begin');
      const old = (await client.query('select * from tbl_lokasi_3d where id_lokasi=$1 for update', [id])).rows[0];
      if (!old) fail(404, 'Lokasi 3D tidak ditemui');
      if (!HOTSPOTS.includes(old.hotspot_id)) fail(400, 'Pengecam hotspot tidak dibenarkan');
      if (postId !== null) {
        const post = (await client.query("select id_pos from tbl_pos_kawalan where id_pos=$1 and status_pos='Aktif' for share", [postId])).rows[0];
        if (!post) fail(400, 'Pos aktif tidak ditemui');
      }
      const updated = (await client.query('update tbl_lokasi_3d set id_pos=$1,tarikh_kemaskini=now() where id_lokasi=$2 returning *', [postId,id])).rows[0];
      await logAudit(client, userId, 'UPDATE_3D_MAPPING', `Lokasi3D #${id}`, 'Kemaskini pautan hotspot kepada pos', 'Berjaya', JSON.stringify({ hotspot_id: old.hotspot_id, id_pos_lama: old.id_pos, id_pos_baharu: postId }));
      await client.query('commit'); return updated;
    } catch (error) { await client.query('rollback'); throw error; }
    finally { client.release(); }
  }
  return { locations, overview, summary, map };
}
module.exports = { createService, period, positiveId, validDate, HOTSPOTS };
