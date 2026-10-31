const path=require('node:path');
require('dotenv').config({path:path.join(__dirname,'../.env')});
const pool=require('../config/db');
const {loadMigrations,migrationStatus,migrate}=require('../database/migrate');

async function main(args=process.argv.slice(2)) {
  if(args.some(arg=>!['--inspect','--init'].includes(arg)) || (args.includes('--inspect')&&args.includes('--init')))throw new Error('Use --inspect for read-only status, --init for a fresh database, or no flags to upgrade.');
  if(args.includes('--inspect')){
    const client=await pool.connect();
    try {
      await client.query('begin isolation level repeatable read read only');
      const status=await migrationStatus(client,await loadMigrations());
      const metadata=(await client.query("select current_setting('TimeZone') as timezone, (select count(*)::int from pg_tables where schemaname=current_schema()) as tables")).rows[0];
      await client.query('commit');
      console.log(JSON.stringify({...metadata,...status},null,2));
      if(status.unknown.length || status.migrations.some(m=>m.status==='changed'))process.exitCode=1;
    } catch(error){await client.query('rollback').catch(()=>{});throw error;}
    finally{client.release();}
  } else console.log(JSON.stringify(await migrate(pool,{initialize:args.includes('--init')}),null,2));
}
if(require.main===module)main().catch(error=>{
  // Database error detail can contain operational records. Print only the code and constraint.
  console.error('Database migration failed:',error.code||error.message,error.constraint||'');
  process.exitCode=1;
}).finally(()=>pool.end());
module.exports={main};
