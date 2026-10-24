const pool = require('../config/db');

const getMeta = async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const [roles, posts, categories, checklist, guards] = [
      await client.query('select id_peranan, nama_peranan from tbl_peranan order by id_peranan'),
      await client.query("select * from tbl_pos_kawalan where status_pos = 'Aktif' order by nama_pos"),
      await client.query("select * from tbl_kategori_insiden where status_kategori = 'Aktif' order by nama_kategori"),
      await client.query('select id_checklist, nama_checklist from tbl_checklist where status_aktif = true order by id_checklist'),
      await client.query(
        `select p.id_pengguna, p.nama_penuh, p.nama_pengguna
         from tbl_pengguna p join tbl_peranan r on r.id_peranan = p.id_peranan
         where r.nama_peranan = 'Pengawal Keselamatan' and p.status_akaun = 'Aktif'
         order by p.nama_penuh`
      ),
    ];
    res.json({
      roles: roles.rows,
      posts: posts.rows,
      categories: categories.rows,
      incidentCategories: categories.rows,
      checklist: checklist.rows,
      guards: guards.rows,
    });
  } catch (error) {
    console.error('Get metadata error:', error.code || error.name);
    res.status(500).json({ message: 'Gagal memuatkan maklumat sistem' });
  } finally {
    client?.release();
  }
};

module.exports = require('../utils/asyncHandlers')({ getMeta });
