const pool = require('../config/db');

const buildFilters = (query) => {
  const params = [];
  const conditions = [];
  if (query.date) {
    params.push(query.date);
    conditions.push(`l.tarikh_laporan = $${params.length}::date`);
  }
  if (query.location) {
    params.push(query.location);
    conditions.push(`l.id_pos = $${params.length}::int`);
  }
  if (query.risk) {
    params.push(query.risk);
    conditions.push(`coalesce(n.tahap_risiko, l.tahap_risiko) = $${params.length}`);
  }
  return { params, where: conditions.length ? `where ${conditions.join(' and ')}` : '' };
};

const getDashboard = async (req, res) => {
  const client = await pool.connect();
  try {
    const { params, where } = buildFilters(req.query);
    const [cards, priority, trend, byCategory, byRisk, keywords, latest] = await Promise.all([
      client.query(
        `select count(*)::int as total_laporan,
                count(*) filter (where coalesce(n.tahap_risiko, l.tahap_risiko) in ('High', 'Critical'))::int as risiko_tinggi,
                count(*) filter (where l.lampiran_fail is not null and l.lampiran_fail <> '[]')::int as laporan_berlampiran
         from tbl_laporan_harian l
         left join tbl_hasil_nlp n on n.id_laporan = l.id_laporan
         ${where}`,
        params
      ),
      client.query(
        `select
           (select count(*)::int from tbl_laporan_harian where status_laporan = 'Dihantar') as laporan_menunggu_semakan,
           (select count(*)::int from tbl_laporan_harian l left join tbl_hasil_nlp n on n.id_laporan = l.id_laporan
             where l.status_laporan = 'Dihantar' and coalesce(n.tahap_risiko, l.tahap_risiko) in ('High', 'Critical')) as laporan_kritikal_menunggu,
           (select count(*)::int from tbl_tindakan_susulan where status_tindakan <> 'Selesai') as tindakan_terbuka,
           (select count(*)::int from tbl_laporan_harian l
             where l.status_laporan = 'Diluluskan' and l.perlu_tindakan_susulan = true
               and not exists (select 1 from tbl_tindakan_susulan a where a.id_laporan = l.id_laporan)) as laporan_perlu_tindakan,
           (select count(*)::int from tbl_progress_tindakan where jenis_progress = 'Permintaan Admin' and perlu_respon_ketua = true) as permintaan_kemaskini_ketua,
           (select count(*)::int from tbl_notifikasi where id_pengguna = $1 and status_bacaan = 'Belum Dibaca') as notifikasi_belum_dibaca`,
        [req.user.id_pengguna]
      ),
      client.query(
        `select to_char(l.tarikh_laporan, 'YYYY-MM-DD') as date, count(*)::int as laporan
         from tbl_laporan_harian l
         left join tbl_hasil_nlp n on n.id_laporan = l.id_laporan
         ${where} ${where ? 'and' : 'where'} l.tarikh_laporan >= current_date - interval '6 days'
         group by l.tarikh_laporan order by l.tarikh_laporan`,
        params
      ),
      client.query(
        `select coalesce(n.kategori_dikesan, 'Tidak Diklasifikasikan') as name, count(*)::int as value
         from tbl_laporan_harian l left join tbl_hasil_nlp n on n.id_laporan = l.id_laporan
         ${where} group by n.kategori_dikesan order by value desc`,
        params
      ),
      client.query(
        `select coalesce(n.tahap_risiko, l.tahap_risiko) as name, count(*)::int as value
         from tbl_laporan_harian l left join tbl_hasil_nlp n on n.id_laporan = l.id_laporan
         ${where} group by coalesce(n.tahap_risiko, l.tahap_risiko) order by value desc`,
        params
      ),
      client.query(
        `select keyword, count(*)::int as value from (
           select unnest(n.kata_kunci_dikesan) as keyword
           from tbl_laporan_harian l join tbl_hasil_nlp n on n.id_laporan = l.id_laporan
           ${where}
         ) matched group by keyword order by value desc, keyword limit 10`,
        params
      ),
      client.query(
        `select l.id_laporan, l.tajuk_laporan, l.tarikh_laporan, pos.nama_pos,
                coalesce(n.tahap_risiko, l.tahap_risiko) as tahap_risiko
         from tbl_laporan_harian l
         left join tbl_hasil_nlp n on n.id_laporan = l.id_laporan
         left join tbl_pos_kawalan pos on pos.id_pos = l.id_pos
         ${where}
         order by l.tarikh_laporan desc, l.masa_laporan desc limit 10`,
        params
      ),
    ]);
    const scheduleToday = await client.query(
      'select count(*)::int as count from tbl_jadual_bertugas where tarikh_tugas = current_date'
    );
    res.json({
      cards: {
        ...cards.rows[0],
        jadual_hari_ini: scheduleToday.rows[0].count,
        tindakan_belum_selesai: priority.rows[0].tindakan_terbuka,
      },
      priority: priority.rows[0],
      trend: trend.rows,
      byCategory: byCategory.rows,
      byRisk: byRisk.rows,
      keywords: keywords.rows,
      latest: latest.rows,
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ message: 'Gagal memuatkan dashboard' });
  } finally {
    client.release();
  }
};

const getGuardDashboard = async (req, res) => {
  const client = await pool.connect();
  try {
    const [today, duty] = await Promise.all([
      client.query(
        `select
           (select count(*)::int from tbl_jadual_bertugas where id_pengguna = $1 and tarikh_tugas = current_date) as tugasan_hari_ini,
           (select count(*)::int from tbl_laporan_harian where id_pengguna = $1 and tarikh_laporan = current_date) as laporan_dihantar`,
        [req.user.id_pengguna]
      ),
      client.query(
        `select s.*, pos.nama_pos, pos.nama_bangunan, pos.lokasi,
                coalesce(a.status_kehadiran, 'Belum Hadir') as status_kehadiran,
                a.masa_check_in, a.masa_check_out
         from tbl_jadual_bertugas s
         join tbl_pos_kawalan pos on pos.id_pos = s.id_pos
         left join tbl_kehadiran_tugas a on a.id_jadual = s.id_jadual
         where s.id_pengguna = $1 and s.tarikh_tugas >= current_date
         order by s.tarikh_tugas, s.masa_mula limit 5`,
        [req.user.id_pengguna]
      ),
    ]);
    res.json({ today: today.rows[0], duty: duty.rows });
  } catch (error) {
    console.error('Get guard dashboard error:', error);
    res.status(500).json({ message: 'Gagal memuatkan dashboard pengawal' });
  } finally {
    client.release();
  }
};

module.exports = { getDashboard, getGuardDashboard };
