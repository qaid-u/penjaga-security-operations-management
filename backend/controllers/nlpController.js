const pool = require('../config/db');

const getReportAnalysis = async (req, res) => {
  const { reportId } = req.params;
  const client = await pool.connect();
  try {
    const result = await client.query('select * from tbl_hasil_nlp where id_laporan = $1', [reportId]);
    if (!result.rows[0]) return res.status(404).json({ message: 'Tiada data NLP' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Ralat pelayan' });
  } finally {
    client.release();
  }
};

const getTrainingData = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query('select * from tbl_kategori_insiden order by kategori');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Ralat pelayan' });
  } finally {
    client.release();
  }
};

const updateTrainingData = async (req, res) => {
  const { id } = req.params;
  const { skor_asas, kata_kunci, status_aktif } = req.body;
  const client = await pool.connect();
  try {
    await client.query(
      `update tbl_kategori_insiden 
       set skor_asas = coalesce($1, skor_asas),
           kata_kunci = coalesce($2, kata_kunci),
           status_aktif = coalesce($3, status_aktif)
       where id_kategori = $4`,
      [skor_asas, kata_kunci ? JSON.stringify(kata_kunci) : null, status_aktif, id]
    );
    res.json({ message: 'Data dikemas kini' });
  } catch (error) {
    res.status(500).json({ message: 'Ralat pelayan' });
  } finally {
    client.release();
  }
};

module.exports = { getReportAnalysis, getTrainingData, updateTrainingData };
