const pool = require('../config/db');
const { logAudit } = require('../utils/audit');

const parseKeywords = (value) => {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
};

const getReportAnalysis = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'select * from tbl_hasil_nlp where id_laporan = $1',
      [req.params.reportId || req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Tiada data NLP' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get NLP analysis error:', error);
    res.status(500).json({ message: 'Gagal memuatkan analisis NLP' });
  } finally {
    client.release();
  }
};

const getTrainingData = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query('select * from tbl_kategori_insiden order by id_kategori_insiden');
    res.json(result.rows);
  } catch (error) {
    console.error('Get NLP categories error:', error);
    res.status(500).json({ message: 'Gagal memuatkan kategori NLP' });
  } finally {
    client.release();
  }
};

const createTrainingData = async (req, res) => {
  const { nama_kategori, tahap_keutamaan, penerangan_kategori, kata_kunci_rujukan } = req.body;
  const keywords = parseKeywords(kata_kunci_rujukan);
  if (!nama_kategori?.trim() || !['Low', 'Medium', 'High', 'Critical'].includes(tahap_keutamaan) || !keywords.length) {
    return res.status(400).json({ message: 'Nama kategori, tahap keutamaan dan sekurang-kurangnya satu kata kunci diperlukan' });
  }
  const client = await pool.connect();
  try {
    const result = await client.query(
      `insert into tbl_kategori_insiden (nama_kategori, tahap_keutamaan, penerangan_kategori, kata_kunci_rujukan)
       values ($1, $2, $3, $4) returning *`,
      [nama_kategori.trim(), tahap_keutamaan, penerangan_kategori?.trim() || null, keywords]
    );
    await logAudit(client, req.user.id_pengguna, 'CREATE_NLP_CATEGORY', result.rows[0].nama_kategori, 'Tambah kategori NLP');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'Nama kategori tersebut telah wujud' });
    console.error('Create NLP category error:', error);
    res.status(500).json({ message: 'Gagal menambah kategori NLP' });
  } finally {
    client.release();
  }
};

const updateTrainingData = async (req, res) => {
  const { nama_kategori, tahap_keutamaan, penerangan_kategori, kata_kunci_rujukan, status_kategori } = req.body;
  if (tahap_keutamaan !== undefined && !['Low', 'Medium', 'High', 'Critical'].includes(tahap_keutamaan)) {
    return res.status(400).json({ message: 'Tahap keutamaan tidak sah' });
  }
  if (status_kategori !== undefined && !['Aktif', 'Tidak Aktif'].includes(status_kategori)) {
    return res.status(400).json({ message: 'Status kategori tidak sah' });
  }
  const keywords = kata_kunci_rujukan === undefined ? null : parseKeywords(kata_kunci_rujukan);
  if (keywords && !keywords.length) return res.status(400).json({ message: 'Sekurang-kurangnya satu kata kunci diperlukan' });

  const client = await pool.connect();
  try {
    const result = await client.query(
      `update tbl_kategori_insiden
       set nama_kategori = coalesce($1, nama_kategori),
           tahap_keutamaan = coalesce($2, tahap_keutamaan),
           penerangan_kategori = coalesce($3, penerangan_kategori),
           kata_kunci_rujukan = coalesce($4, kata_kunci_rujukan),
           status_kategori = coalesce($5, status_kategori)
       where id_kategori_insiden = $6
       returning *`,
      [
        nama_kategori?.trim() || null,
        tahap_keutamaan || null,
        penerangan_kategori?.trim() || null,
        keywords,
        status_kategori || null,
        req.params.id,
      ]
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Kategori NLP tidak ditemui' });
    await logAudit(client, req.user.id_pengguna, 'UPDATE_NLP_CATEGORY', result.rows[0].nama_kategori, 'Kemas kini kategori NLP');
    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'Nama kategori tersebut telah wujud' });
    console.error('Update NLP category error:', error);
    res.status(500).json({ message: 'Gagal mengemas kini kategori NLP' });
  } finally {
    client.release();
  }
};

const deleteTrainingData = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const used = await client.query(
      'select 1 from tbl_laporan_harian where id_kategori_insiden = $1 limit 1',
      [req.params.id]
    );
    if (used.rowCount) {
      const result = await client.query(
        `update tbl_kategori_insiden set status_kategori = 'Tidak Aktif'
         where id_kategori_insiden = $1 returning nama_kategori`,
        [req.params.id]
      );
      if (!result.rowCount) {
        await client.query('rollback');
        return res.status(404).json({ message: 'Kategori NLP tidak ditemui' });
      }
      await client.query('commit');
      return res.json({ deactivated: true });
    }
    const result = await client.query(
      'delete from tbl_kategori_insiden where id_kategori_insiden = $1 returning nama_kategori',
      [req.params.id]
    );
    if (!result.rowCount) {
      await client.query('rollback');
      return res.status(404).json({ message: 'Kategori NLP tidak ditemui' });
    }
    await client.query('commit');
    res.json({ deactivated: false });
  } catch (error) {
    await client.query('rollback');
    console.error('Delete NLP category error:', error);
    res.status(500).json({ message: 'Gagal memadam kategori NLP' });
  } finally {
    client.release();
  }
};

module.exports = { getReportAnalysis, getTrainingData, createTrainingData, updateTrainingData, deleteTrainingData };
