const pool = require('../config/db');

const getDashboard = async (req, res) => {
  const client = await pool.connect();
  try {
    const cards = await client.query(`
      select 
        (select count(*)::int from tbl_laporan_harian where tarikh_laporan = current_date) as laporan_hari_ini,
        (select count(*)::int from tbl_laporan_harian where status_laporan = 'Dihantar') as perlu_disemak,
        (select count(*)::int from tbl_tindakan_susulan where status_tindakan = 'Baru' or status_tindakan = 'Dalam Proses') as tindakan_tertunggak,
        (select count(*)::int from tbl_status_bertugas where tarikh = current_date) as jadual_hari_ini
    `);
    const trend = await client.query(`
      select to_char(tarikh_laporan, 'Day') as day, count(*)::int as cases
      from tbl_laporan_harian
      where tarikh_laporan >= current_date - interval '7 days'
      group by tarikh_laporan
      order by tarikh_laporan
    `);
    const pie = await client.query(`
      select kategori_insiden as name, count(*)::int as value
      from tbl_hasil_nlp nlp
      join tbl_laporan_harian l on l.id_laporan = nlp.id_laporan
      where l.tarikh_laporan >= current_date - interval '30 days'
      group by kategori_insiden
    `);
    res.json({ cards: cards.rows[0], trend: trend.rows, pie: pie.rows });
  } catch (error) {
    res.status(500).json({ message: 'Ralat pelayan' });
  } finally {
    client.release();
  }
};

const getGuardDashboard = async (req, res) => {
  const client = await pool.connect();
  try {
    const today = await client.query(`
      select
        (select count(*)::int from tbl_status_bertugas where id_pengguna = $1 and tarikh = current_date) as tugasan_hari_ini,
        (select count(*)::int from tbl_laporan_harian where dilapor_oleh = $1 and tarikh_laporan = current_date) as laporan_dihantar
    `, [req.user.id_pengguna]);
    const duty = await client.query(`
      select s.*, pos.nama_pos from tbl_status_bertugas s
      join tbl_pos_kawalan pos on pos.id_pos = s.id_pos
      where s.id_pengguna = $1 and s.tarikh >= current_date
      order by s.tarikh, s.masa_mula limit 5
    `, [req.user.id_pengguna]);
    res.json({ today: today.rows[0], duty: duty.rows });
  } catch (error) {
    res.status(500).json({ message: 'Ralat pelayan' });
  } finally {
    client.release();
  }
};

module.exports = { getDashboard, getGuardDashboard };
