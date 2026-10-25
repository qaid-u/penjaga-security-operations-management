// Run once against an approved target. Never replaces or resets existing accounts.
require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../config/db');
async function main() {
  const { BOOTSTRAP_USERNAME:username, BOOTSTRAP_PASSWORD:password, BOOTSTRAP_EMAIL:email, BOOTSTRAP_NAME:name } = process.env;
  if (!username || !email || !name || !password || password.length < 10) throw new Error('Set BOOTSTRAP_USERNAME, BOOTSTRAP_EMAIL, BOOTSTRAP_NAME and BOOTSTRAP_PASSWORD (10+ characters).');
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('select pg_advisory_xact_lock(7416, 2)');
    const admins = await client.query("select 1 from tbl_pengguna p join tbl_peranan r using(id_peranan) where r.nama_peranan='Pentadbir Sistem' and p.status_akaun='Aktif'");
    if (admins.rowCount) throw new Error('An active administrator already exists; no changes made.');
    const role = await client.query("select id_peranan from tbl_peranan where nama_peranan='Pentadbir Sistem'");
    if (!role.rowCount) throw new Error('Install roles.sql first.');
    await client.query('insert into tbl_pengguna(id_peranan,nama_penuh,emel,nama_pengguna,kata_laluan) values($1,$2,$3,$4,$5)', [role.rows[0].id_peranan,name,email,username,await bcrypt.hash(password,10)]);
    await client.query('commit'); console.log('Initial administrator created. No credentials printed.');
  } catch(error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
}
main().catch(error => { console.error(error.code || error.message); process.exitCode=1; }).finally(()=>pool.end());
