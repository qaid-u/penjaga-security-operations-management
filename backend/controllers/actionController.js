const pool = require('../config/db');
const { logAudit } = require('../utils/audit');

const getActions = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      select t.*, l.perincian, p.nama_penuh as ditugaskan_kepada_nama, nlp.kategori_insiden, nlp.tahap_risiko
      from tbl_tindakan_susulan t
      join tbl_laporan_harian l on l.id_laporan = t.id_laporan
      left join tbl_pengguna p on p.id_pengguna = t.ditugaskan_kepada
      left join tbl_hasil_nlp nlp on nlp.id_laporan = t.id_laporan
      order by t.tarikh_akhir asc nulls last
    `);
    const progress = await client.query(`
      select p.*, u.nama_penuh as pelapor_nama
      from tbl_progress_tindakan p
      join tbl_pengguna u on u.id_pengguna = p.dikemaskini_oleh
      order by p.tarikh_kemaskini asc
    `);
    const actions = result.rows.map(a => ({
      ...a,
      progress: progress.rows.filter(p => p.id_tindakan === a.id_tindakan)
    }));
    res.json(actions);
  } catch (error) {
    res.status(500).json({ message: 'Ralat pelayan' });
  } finally {
    client.release();
  }
};

const updateAction = async (req, res) => {
  const { id } = req.params;
  const { status_tindakan } = req.body;
  if (!status_tindakan) return res.status(400).json({ message: 'Maklumat tidak lengkap' });
  const client = await pool.connect();
  try {
    await client.query('update tbl_tindakan_susulan set status_tindakan = $1 where id_tindakan = $2', [status_tindakan, id]);
    await logAudit(client, req.user.id_pengguna, 'UPDATE_ACTION', \`Tindakan #\${id}\`, \`Ubah status: \${status_tindakan}\`);
    res.json({ message: 'Status tindakan dikemas kini' });
  } catch (error) {
    res.status(500).json({ message: 'Ralat pelayan' });
  } finally {
    client.release();
  }
};

const addProgress = async (req, res) => {
  const { id } = req.params;
  const { penerangan_progress, perlu_respon_ketua } = req.body;
  let attachments = [];
  if (req.files && req.files.length > 0) {
    attachments = req.files.map(f => '/uploads/' + f.filename);
  }
  const client = await pool.connect();
  try {
    await client.query(
      \`insert into tbl_progress_tindakan (id_tindakan, dikemaskini_oleh, penerangan_progress, lampiran_progress, perlu_respon_ketua)
       values ($1, $2, $3, $4, $5)\`,
      [id, req.user.id_pengguna, penerangan_progress, JSON.stringify(attachments), perlu_respon_ketua === 'true']
    );
    await logAudit(client, req.user.id_pengguna, 'ADD_PROGRESS', \`Tindakan #\${id}\`, 'Tambah nota progress');
    res.json({ message: 'Progress disimpan' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Ralat menyimpan progress' });
  } finally {
    client.release();
  }
};

module.exports = { getActions, updateAction, addProgress };
