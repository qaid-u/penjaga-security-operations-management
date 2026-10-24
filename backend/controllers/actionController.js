const pool = require('../config/db');
const { logAudit } = require('../utils/audit');

const getActions = async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const [actions, progress] = [
      await client.query(
        `select a.*, l.tajuk_laporan, l.tarikh_laporan, l.id_pengguna,
                p.nama_penuh, pos.nama_pos, n.kategori_dikesan, n.tahap_risiko
         from tbl_tindakan_susulan a
         join tbl_laporan_harian l on l.id_laporan = a.id_laporan
         join tbl_pengguna p on p.id_pengguna = l.id_pengguna
         join tbl_pos_kawalan pos on pos.id_pos = l.id_pos
         left join lateral (select * from tbl_hasil_nlp where id_laporan=l.id_laporan order by tarikh_analisis desc,id_nlp desc limit 1) n on true
         order by a.tarikh_mula desc, a.id_tindakan desc`
      ),
      await client.query(
        `select pr.*, u.nama_penuh, r.nama_peranan,
                pr.catatan_progress, pr.lampiran_fail, pr.tarikh_progress
         from tbl_progress_tindakan pr
         join tbl_pengguna u on u.id_pengguna = pr.id_pengguna
         join tbl_peranan r on r.id_peranan = u.id_peranan
         order by pr.tarikh_progress`
      ),
    ];
    res.json(actions.rows.map((action) => ({
      ...action,
      progress_notes: progress.rows.filter((note) => note.id_tindakan === action.id_tindakan),
    })));
  } catch (error) {
    console.error('Get actions error:', error.code || error.name);
    res.status(500).json({ message: 'Gagal memuatkan tindakan susulan' });
  } finally {
    client?.release();
  }
};

const createAction = async (req, res) => {
  const { id_laporan, pegawai_bertanggungjawab, tindakan_diambil, tahap_keutamaan, tarikh_mula, catatan_tindakan } = req.body;
  if (!id_laporan || typeof pegawai_bertanggungjawab !== 'string' || typeof tindakan_diambil !== 'string' || !pegawai_bertanggungjawab.trim() || !tindakan_diambil.trim()) {
    return res.status(400).json({ message: 'Laporan, pegawai bertanggungjawab dan tindakan diambil diperlukan' });
  }
  if (tahap_keutamaan && !['Low', 'Medium', 'High', 'Critical'].includes(tahap_keutamaan)) {
    return res.status(400).json({ message: 'Tahap keutamaan tidak sah' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('begin');
    const report = await client.query(
      'select status_laporan from tbl_laporan_harian where id_laporan = $1 for update',
      [id_laporan]
    );
    if (!report.rowCount) {
      if (client) await client.query('rollback');
      return res.status(404).json({ message: 'Laporan tidak ditemui' });
    }
    if (report.rows[0].status_laporan !== 'Diluluskan') {
      if (client) await client.query('rollback');
      return res.status(409).json({ message: 'Tindakan hanya boleh dibuat untuk laporan yang diluluskan' });
    }
    const existing = await client.query('select 1 from tbl_tindakan_susulan where id_laporan = $1', [id_laporan]);
    if (existing.rowCount) {
      if (client) await client.query('rollback');
      return res.status(409).json({ message: 'Laporan ini sudah mempunyai tindakan susulan' });
    }
    const result = await client.query(
      `insert into tbl_tindakan_susulan
         (id_laporan, pegawai_bertanggungjawab, tindakan_diambil, tahap_keutamaan, tarikh_mula, catatan_tindakan)
       values ($1, $2, $3, $4, coalesce($5::date, current_date), $6)
       returning *`,
      [
        id_laporan,
        pegawai_bertanggungjawab.trim(),
        tindakan_diambil.trim(),
        tahap_keutamaan || 'Medium',
        tarikh_mula || null,
        catatan_tindakan?.trim() || null,
      ]
    );
    await logAudit(client, req.user.id_pengguna, 'CREATE_ACTION', `Laporan #${id_laporan}`, 'Cipta tindakan susulan');
    await client.query('commit');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (client) await client.query('rollback');
    console.error('Create action error:', error.code || error.name);
    res.status(500).json({ message: 'Gagal mencipta tindakan susulan' });
  } finally {
    client?.release();
  }
};

const updateAction = async (req, res) => {
  const { status_tindakan, catatan_tindakan } = req.body;
  const validStatuses = ['Baru', 'Dalam Tindakan', 'Selesai'];
  if (!validStatuses.includes(status_tindakan)) {
    return res.status(400).json({ message: 'Status tindakan tidak sah' });
  }
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      `update tbl_tindakan_susulan
       set status_tindakan = $1,
           catatan_tindakan = coalesce($2, catatan_tindakan),
           tarikh_selesai = case when $1 = 'Selesai' then current_date else null end,
           tarikh_kemaskini = now()
       where id_tindakan = $3 returning *`,
      [status_tindakan, catatan_tindakan?.trim() || null, req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Tindakan tidak ditemui' });
    await logAudit(client, req.user.id_pengguna, 'UPDATE_ACTION', `Tindakan #${req.params.id}`, `Status: ${status_tindakan}`);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update action error:', error.code || error.name);
    res.status(500).json({ message: 'Gagal mengemas kini tindakan' });
  } finally {
    client?.release();
  }
};

const saveProgress = async (req, res, type) => {
  const { catatan_progress } = req.body;
  if (typeof catatan_progress !== 'string' || !catatan_progress.trim()) return res.status(400).json({ message: 'Catatan progress diperlukan' });
  const uploads = req.files || [];
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      `insert into tbl_progress_tindakan
         (id_tindakan, id_pengguna, catatan_progress, jenis_progress, perlu_respon_ketua, lampiran_fail)
       select $1, $2, $3, $4, $5, $6
       where exists (select 1 from tbl_tindakan_susulan where id_tindakan = $1)
       returning *`,
      [
        req.params.id,
        req.user.id_pengguna,
        catatan_progress.trim(),
        type,
        type === 'Permintaan Admin',
        JSON.stringify(uploads.map((file) => `/uploads/${file.filename}`)),
      ]
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Tindakan tidak ditemui' });
    await logAudit(client, req.user.id_pengguna, type === 'Permintaan Admin' ? 'REQUEST_ACTION_UPDATE' : 'ADD_ACTION_PROGRESS', `Tindakan #${req.params.id}`, type);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Save action progress error:', error.code || error.name);
    res.status(500).json({ message: 'Gagal menyimpan progress tindakan' });
  } finally {
    client?.release();
  }
};

const addProgress = (req, res) => saveProgress(req, res, 'Kemaskini Ketua');
const requestUpdate = (req, res) => saveProgress(req, res, 'Permintaan Admin');

module.exports = require('../utils/asyncHandlers')({ getActions, createAction, updateAction, addProgress, requestUpdate });
