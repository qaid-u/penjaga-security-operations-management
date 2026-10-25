const path = require('path');
const fs = require('fs/promises');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../config/db');

async function main() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query("select current_setting('TimeZone') as timezone, (select count(*)::int from information_schema.tables where table_schema='public' and table_name like 'tbl_%') as tables");
    console.log('Database inspection:', rows[0]);
    if (process.argv.includes('--inspect')) return;
    await client.query('begin');
    await client.query("set local lock_timeout = '5s'");
    await client.query("set local statement_timeout = '60s'");
    await client.query('select pg_advisory_xact_lock(730003)');
    await client.query(await fs.readFile(path.join(__dirname, '../database/migrations/003_lokasi_3d.sql'), 'utf8'));
    await client.query(await fs.readFile(path.join(__dirname, '../database/migrations/005_djm_security_posts.sql'), 'utf8'));
    await client.query('commit');
    console.log('Official DJM post migration complete. Seven posts configured; existing record links and inactive exterior history preserved.');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally { client.release(); }
}
main().catch((error) => { console.error('Migration failed:', error.code || error.message); process.exitCode = 1; }).finally(() => pool.end());
