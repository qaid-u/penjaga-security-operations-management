const { logAudit } = require('../utils/audit');

const HOTSPOTS = ['HOTSPOT_MAIN_ENTRANCE','HOTSPOT_CENTRAL_BLOCK','HOTSPOT_LEFT_WING','HOTSPOT_RIGHT_WING','HOTSPOT_FRONT_PLAZA','HOTSPOT_LEFT_TOWER','HOTSPOT_RIGHT_TOWER'];
function fail(status, message) { const error = new Error(message); error.status = status; throw error; }
function positiveId(value) {
  if (!['string', 'number'].includes(typeof value) || !/^[1-9]\d*$/.test(String(value)) || Number(value) > 2147483647) fail(400, 'ID tidak sah');
  return Number(value);
}
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '2100-12-31') return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
function period(query = {}) {
  const allowed = ['date','from','to','zone','mapping','post','risk','category','report_status','action_status','page','limit'];
  if (Object.keys(query).some((key) => !allowed.includes(key))) fail(400, 'Parameter pertanyaan tidak disokong');
  const date = query.date ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const from = query.from ?? date; const to = query.to ?? date;
  if (![date, from, to].every(validDate) || from > to || (Date.parse(to) - Date.parse(from)) / 86400000 > 365) fail(400, 'Tarikh tidak sah. Julat laporan maksimum 366 hari.');
  const choice = (key, values, fallback = '') => {
    const value = query[key] ?? fallback;
    if (typeof value !== 'string' || !values.includes(value)) fail(400, `Penapis ${key} tidak sah`);
    return value;
  };
  const category = query.category ?? '';
  if (typeof category !== 'string' || category.length > 100 || [...category].some((c) => c.charCodeAt(0) < 32)) fail(400, 'Kategori tidak sah');
  return { date, from, to, timezone: 'Asia/Kuala_Lumpur',
    zone: choice('zone', ['', ...HOTSPOTS]), mapping: choice('mapping', ['all','linked','unlinked'], 'linked'),
    post: query.post == null || query.post === '' ? null : positiveId(query.post),
    risk: choice('risk', ['', 'Low','Medium','High','Critical','Unknown','HighCritical']), category,
    report_status: choice('report_status', ['', 'Dihantar','Diluluskan','Ditolak']),
    action_status: choice('action_status', ['', 'Baru','Dalam Tindakan','Selesai']) };
}

const reportParams = (ids, p) => [ids, p.date, p.from, p.to, p.risk === 'HighCritical' ? ['High','Critical'] : p.risk ? [p.risk] : [], p.category || '', p.report_status || '', p.action_status || ''];

// Half-open overlap includes yesterday's overnight duty in the selected KL day.
const dutyWhere = `s.tarikh_tugas between $2::date - 1 and $2::date
  and (s.tarikh_tugas + s.masa_mula) < ($2::date + interval '1 day')
  and (s.tarikh_tugas + s.masa_tamat + case when s.masa_tamat <= s.masa_mula then interval '1 day' else interval '0 day' end) > $2::date`;
const dutyCte = `duty as (
 select s.*, w.status_jadual,
   k.masa_check_in, k.masa_check_out,
   case when k.masa_check_out is not null and (k.masa_check_in is null or k.masa_check_out < k.masa_check_in) then 'Unknown'
        when k.masa_check_out is not null then 'Checked Out'
        when k.masa_check_in is not null then 'Checked In'
        else 'No Check-In Recorded' end as attendance_state
 from tbl_jadual_bertugas s join tbl_jadual_mingguan w using(id_jadual_mingguan)
 left join tbl_kehadiran_tugas k on k.id_jadual=s.id_jadual and k.id_pengguna=s.id_pengguna
 where s.id_pos = any($1::int[]) and ${dutyWhere}
)`;
const reportCte = `classified as (
 select l.id_laporan,l.id_pos,l.tajuk_laporan,l.tarikh_laporan,l.masa_laporan,l.status_laporan,
   case when n.tahap_risiko in ('Low','Medium','High','Critical') then n.tahap_risiko else 'Unknown' end as tahap_risiko,
   n.kategori_dikesan
 from tbl_laporan_harian l
 left join lateral (select tahap_risiko,kategori_dikesan from tbl_hasil_nlp where id_laporan=l.id_laporan order by tarikh_analisis desc,id_nlp desc limit 1) n on true
 where l.id_pos=any($1::int[]) and l.tarikh_laporan between $3::date and $4::date
), reports as (select * from classified c where
 (cardinality($5::text[])=0 or c.tahap_risiko=any($5::text[]))
 and ($6::text='' or coalesce(c.kategori_dikesan,'Unknown')=$6)
 and ($7::text='' or c.status_laporan=$7)
 and ($8::text='' or exists(select 1 from tbl_tindakan_susulan a where a.id_laporan=c.id_laporan and a.status_tindakan=$8)))`;

function createService(pool) {
  async function locations(client = pool) {
    return (await client.query('select * from tbl_lokasi_3d order by id_lokasi')).rows;
  }
  async function scopedPosts(client, p) {
    return (await client.query(`select p.id_pos from tbl_pos_kawalan p where
      ($1::int is null or p.id_pos=$1) and
      ($2::text='' or exists(select 1 from tbl_lokasi_3d l where l.id_pos=p.id_pos and l.status_aktif and l.hotspot_id=$2)) and
      ($3::text='all' or ($3='linked')=exists(select 1 from tbl_lokasi_3d l where l.id_pos=p.id_pos and l.status_aktif))
      order by p.id_pos`, [p.post, p.zone || '', p.mapping || 'linked'])).rows.map((r) => r.id_pos);
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
       from tbl_tindakan_susulan a join reports r using(id_laporan) where ($8::text='' or a.status_tindakan=$8) group by r.id_pos)
     select p.id_pos,
       jsonb_build_object('assignments',coalesce(s.assignments,0),'confirmed',coalesce(s.confirmed,0),'draft',coalesce(s.draft,0)) as schedule,
       jsonb_build_object('checked_in',coalesce(s.checked_in,0),'checked_out',coalesce(s.checked_out,0),'no_check_in',coalesce(s.no_check_in,0),'unknown',coalesce(s.unknown_attendance,0)) as attendance,
       jsonb_build_object('total',coalesce(i.reports,0),'Low',coalesce(i.low,0),'Medium',coalesce(i.medium,0),'High',coalesce(i.high,0),'Critical',coalesce(i.critical,0),'Unknown',coalesce(i.unknown,0)) as incidents,
       jsonb_build_object('total',coalesce(a.total,0),'open',coalesce(a.open,0),'in_progress',coalesce(a.in_progress,0),'completed',coalesce(a.completed,0)) as follow_up
     from tbl_pos_kawalan p left join schedules s using(id_pos) left join incidents i using(id_pos) left join actions a using(id_pos)
     where p.id_pos=any($1::int[])`, reportParams(ids, p));
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
      const ids = await scopedPosts(client, p);
      const linkedIds = new Set(rows.filter((l) => l.status_aktif && ids.includes(l.id_pos)).map((l) => l.id_pos));
      const posts = await aggregates(client, ids, p);
      return { period: p, refreshed_at: new Date().toISOString(), locations: rows.map((location) => ({ ...location, in_scope: ids.includes(location.id_pos) && (!p.zone || p.zone === location.hotspot_id), metrics: location.status_aktif && (!p.zone || p.zone === location.hotspot_id) ? posts.find((post) => post.id_pos === location.id_pos) ?? null : null })),
        totals: { locations: rows.length, linked_posts: linkedIds.size, posts: ids.length, assignments: posts.reduce((n,p) => n+p.schedule.assignments,0), checked_in: posts.reduce((n,p) => n+p.attendance.checked_in,0), reports: posts.reduce((n,p) => n+p.incidents.total,0), high_critical: posts.reduce((n,p) => n+p.incidents.High+p.incidents.Critical,0), open_actions: posts.reduce((n,p) => n+p.follow_up.open,0), completed_actions: posts.reduce((n,p) => n+p.follow_up.completed,0), unmapped_reports: posts.filter((p) => !linkedIds.has(p.id_pos)).reduce((n,p) => n+p.incidents.total,0) } };
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
      const ids = await scopedPosts(client, p);
      if (!ids.includes(post.id_pos) || (p.zone && p.zone !== location.hotspot_id)) return { ...base, linked: true, in_scope: false, post };
      const params = reportParams([post.id_pos], p);
      const metrics = (await aggregates(client, params[0], p))[0];
      const assignments = (await client.query(`with ${dutyCte}
        select d.id_jadual,d.syif,d.tarikh_tugas::text,d.masa_mula::text,d.masa_tamat::text,d.status_bertugas,d.status_jadual,u.nama_penuh,
          d.attendance_state, (d.masa_check_in at time zone 'Asia/Kuala_Lumpur') as masa_check_in,
          (d.masa_check_out at time zone 'Asia/Kuala_Lumpur') as masa_check_out,
          (d.tarikh_tugas+d.masa_mula) at time zone 'Asia/Kuala_Lumpur' as starts_at,
          (d.tarikh_tugas+d.masa_tamat+case when d.masa_tamat<=d.masa_mula then interval '1 day' else interval '0 day' end) at time zone 'Asia/Kuala_Lumpur' as ends_at
        from duty d join tbl_pengguna u using(id_pengguna) order by d.tarikh_tugas,d.masa_mula,d.id_jadual limit 200`, params.slice(0,2))).rows;
      const reports = (await client.query(`with requested_period as (select $2::date as duty_date), ${reportCte}
        select id_laporan,id_pos,tajuk_laporan,tarikh_laporan::text,masa_laporan::text,status_laporan,tahap_risiko,kategori_dikesan
        from reports order by reports.tarikh_laporan desc,reports.masa_laporan desc,id_laporan desc limit 10`, params)).rows;
      const actions = (await client.query(`with requested_period as (select $2::date as duty_date), ${reportCte}
        select a.id_tindakan,a.id_laporan,a.status_tindakan,a.tahap_keutamaan,a.tarikh_mula::text,a.tarikh_selesai::text,
          pr.jenis_progress, (pr.tarikh_progress at time zone 'Asia/Kuala_Lumpur') as tarikh_progress,pr.perlu_respon_ketua
        from tbl_tindakan_susulan a join reports r using(id_laporan)
        left join lateral (select jenis_progress,tarikh_progress,perlu_respon_ketua from tbl_progress_tindakan where id_tindakan=a.id_tindakan order by tarikh_progress desc,id_progress desc limit 1) pr on true
        where ($8::text='' or a.status_tindakan=$8)
        order by (a.status_tindakan='Selesai'),a.tarikh_kemaskini desc,a.id_tindakan desc limit 20`, params)).rows;
      return { ...base, linked: true, post, metrics, assignments, reports, actions, limits: { assignments: 200, reports: 10, actions: 20 } };
    });
  }
  async function incidents(p, query = {}) {
    const page = query.page === undefined ? 1 : positiveId(query.page);
    const limit = query.limit === undefined ? 20 : positiveId(query.limit);
    if (limit > 50 || page > 10000) fail(400, 'Halaman atau had tidak sah');
    return snapshot(async (client) => {
      const ids = await scopedPosts(client, p);
      const params = reportParams(ids, p);
      const cte = `with requested_period as (select $2::date as duty_date), ${reportCte}`;
      const total = (await client.query(`${cte} select count(*)::int as total from reports`, params)).rows[0].total;
      const items = (await client.query(`${cte}
        select r.id_laporan,r.id_pos,r.tajuk_laporan,r.tarikh_laporan::text,r.masa_laporan::text,r.status_laporan,r.tahap_risiko,r.kategori_dikesan,p.nama_pos,
        coalesce((select jsonb_agg(jsonb_build_object('id_lokasi',l.id_lokasi,'hotspot_id',l.hotspot_id,'nama_paparan',l.nama_paparan) order by l.id_lokasi) from tbl_lokasi_3d l where l.id_pos=r.id_pos and l.status_aktif),'[]'::jsonb) as locations,
        (select count(*)::int from tbl_tindakan_susulan a where a.id_laporan=r.id_laporan and a.status_tindakan<>'Selesai' and ($8::text='' or a.status_tindakan=$8)) as open_actions,
        (select count(*)::int from tbl_tindakan_susulan a where a.id_laporan=r.id_laporan and a.status_tindakan='Selesai' and ($8::text='' or a.status_tindakan=$8)) as completed_actions,
        coalesce((select jsonb_agg(distinct a.status_tindakan) from tbl_tindakan_susulan a where a.id_laporan=r.id_laporan and ($8::text='' or a.status_tindakan=$8)),'[]'::jsonb) as action_statuses
        from reports r join tbl_pos_kawalan p using(id_pos)
        order by r.tarikh_laporan desc,r.masa_laporan desc,r.id_laporan desc limit $9 offset $10`, [...params,limit,(page-1)*limit])).rows;
      return { items, total, page, limit, period: p, refreshed_at: new Date().toISOString() };
    });
  }
  async function filters() {
    return snapshot(async (client) => ({
      posts: (await client.query('select id_pos,nama_pos,status_pos from tbl_pos_kawalan order by nama_pos,id_pos')).rows,
      categories: (await client.query("select distinct coalesce(n.kategori_dikesan,'Unknown') as category from tbl_laporan_harian l left join lateral (select kategori_dikesan from tbl_hasil_nlp where id_laporan=l.id_laporan order by tarikh_analisis desc,id_nlp desc limit 1) n on true order by category")).rows.map((r) => r.category),
      today: period().date, timezone: 'Asia/Kuala_Lumpur'
    }));
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
  return { locations, overview, summary, incidents, filters, map };
}
module.exports = { createService, period, positiveId, validDate, HOTSPOTS };
