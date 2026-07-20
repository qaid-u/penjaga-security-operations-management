const pool = require('../config/db');

const getMeta = async (req, res) => {
  const client = await pool.connect();
  try {
    const roles = await client.query('select * from tbl_peranan order by id_peranan');
    const posts = await client.query('select * from tbl_pos_kawalan where status_pos = $1 order by nama_pos', ['Aktif']);
    const cats = await client.query('select * from tbl_kategori_insiden where status_aktif = true order by kategori');
    res.json({ roles: roles.rows, posts: posts.rows, incidentCategories: cats.rows });
  } catch (error) {
    res.status(500).json({ message: 'Ralat pelayan' });
  } finally {
    client.release();
  }
};

module.exports = { getMeta };
