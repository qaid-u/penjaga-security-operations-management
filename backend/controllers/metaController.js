const pool = require('../config/db');

const getMeta = async (req, res) => {
  const client = await pool.connect();
  try {
    const [roles, posts, categories, checklist, guards] = await Promise.all([
      client.query('select id_peranan, nama_peranan from tbl_peranan order by id_peranan'),
      client.query("select * from tbl_pos_kawalan where status_pos = 'Aktif' order by nama_pos"),
      client.query("select * from tbl_kategori_insiden where status_kategori = 'Aktif' order by nama_kategori"),
      client.query('select id_checklist, nama_checklist from tbl_checklist where status_aktif = true order by id_checklist'),
      client.query(
        `select p.id_pengguna, p.nama_penuh, p.nama_pengguna
         from tbl_pengguna p join tbl_peranan r on r.id_peranan = p.id_peranan
         where r.nama_peranan = 'Pengawal Keselamatan' and p.status_akaun = 'Aktif'
         order by p.nama_penuh`
      ),
    ]);
    res.json({
      roles: roles.rows,
      posts: posts.rows,
      categories: categories.rows,
      incidentCategories: categories.rows,
      checklist: checklist.rows,
      guards: guards.rows,
    });
  } catch (error) {
    console.error('Get metadata error:', error);
    res.status(500).json({ message: 'Gagal memuatkan maklumat sistem' });
  } finally {
    client.release();
  }
};

module.exports = { getMeta };
