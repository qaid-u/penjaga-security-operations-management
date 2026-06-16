require("dotenv").config({ path: ".env" });

const { Pool } = require("pg");

const passwordHash =
  "$2b$10$9Lo0uAtINIJStdbyFpxxN.pbdkklKScVMsUbFYxlIdG1iMGKsxyDi";

const guards = [
  ["Pengawal Zulkifli", "zulkifli", "zulkifli@penjaga.local", "880101010014", "012-3000014"],
  ["Pengawal Aisyah", "aisyah", "aisyah@penjaga.local", "890202020015", "012-3000015"],
  ["Pengawal Syafiq", "syafiq", "syafiq@penjaga.local", "900303030016", "012-3000016"],
  ["Pengawal Kavitha", "kavitha", "kavitha@penjaga.local", "910404040017", "012-3000017"],
  ["Pengawal Azlan", "azlan", "azlan@penjaga.local", "920505050018", "012-3000018"],
  ["Pengawal Nurul", "nurul", "nurul@penjaga.local", "930606060019", "012-3000019"],
  ["Pengawal Daniel", "daniel", "daniel@penjaga.local", "940707070020", "012-3000020"],
  ["Pengawal Hidayah", "hidayah", "hidayah@penjaga.local", "950808080021", "012-3000021"],
  ["Pengawal Lokman", "lokman", "lokman@penjaga.local", "960909090022", "012-3000022"],
  ["Pengawal Priya", "priya", "priya@penjaga.local", "971010100023", "012-3000023"],
  ["Pengawal Syahmi", "syahmi", "syahmi@penjaga.local", "981111110024", "012-3000024"],
  ["Pengawal Intan", "intan", "intan@penjaga.local", "991212120025", "012-3000025"],
  ["Pengawal Firdaus", "firdaus", "firdaus@penjaga.local", "870113130026", "012-3000026"],
  ["Pengawal Salmah", "salmah", "salmah@penjaga.local", "860214140027", "012-3000027"],
  ["Pengawal Ganesan", "ganesan", "ganesan@penjaga.local", "850315150028", "012-3000028"],
  ["Pengawal Iman", "iman", "iman@penjaga.local", "840416160029", "012-3000029"],
  ["Pengawal Roslan", "roslan", "roslan@penjaga.local", "830517170030", "012-3000030"],
  ["Pengawal Amirah", "amirah", "amirah@penjaga.local", "820618180031", "012-3000031"],
  ["Pengawal Vijay", "vijay", "vijay@penjaga.local", "810719190032", "012-3000032"],
  ["Pengawal Nabila", "nabila", "nabila@penjaga.local", "800820200033", "012-3000033"],
];

async function main() {
  const pool = new Pool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const roleResult = await client.query(
      "SELECT id_peranan FROM tbl_peranan WHERE nama_peranan = $1",
      ["Pengawal Keselamatan"],
    );

    if (!roleResult.rowCount) {
      throw new Error("Role Pengawal Keselamatan not found");
    }

    let inserted = 0;
    const roleId = roleResult.rows[0].id_peranan;

    for (const guard of guards) {
      const result = await client.query(
        `INSERT INTO tbl_pengguna
          (nama_penuh, nama_pengguna, kata_laluan, emel, no_kad_pengenalan, no_telefon, id_peranan, status_akaun)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'Aktif')
         ON CONFLICT (nama_pengguna) DO NOTHING
         RETURNING id_pengguna`,
        [guard[0], guard[1], passwordHash, guard[2], guard[3], guard[4], roleId],
      );

      inserted += result.rowCount;
    }

    const totalResult = await client.query(
      `SELECT COUNT(*)::int AS total
       FROM tbl_pengguna pengguna
       JOIN tbl_peranan peranan ON peranan.id_peranan = pengguna.id_peranan
       WHERE peranan.nama_peranan = $1
        AND pengguna.status_akaun = 'Aktif'`,
      ["Pengawal Keselamatan"],
    );

    await client.query("COMMIT");
    console.log(
      JSON.stringify(
        {
          inserted,
          totalActiveGuards: totalResult.rows[0].total,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
