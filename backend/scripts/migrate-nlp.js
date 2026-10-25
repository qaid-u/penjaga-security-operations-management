const path = require('node:path');
const fs = require('node:fs/promises');
require('dotenv').config({path:path.join(__dirname,'../.env')});
const pool=require('../config/db');
async function main(){
  const client=await pool.connect();
  try{
    if(process.argv.includes('--inspect')){
      const result=await client.query("select to_regclass('public.tbl_job_nlp') is not null as jobs,exists(select 1 from information_schema.columns where table_schema='public' and table_name='tbl_hasil_nlp' and column_name='metadata') as metadata,exists(select 1 from information_schema.columns where table_schema='public' and table_name='tbl_laporan_harian' and column_name='nlp_context') as event_clarifications");
      console.log('NLP schema:',result.rows[0]);return;
    }
    await client.query('begin');
    await client.query("set local lock_timeout='5s'");
    await client.query("set local statement_timeout='60s'");
    await client.query('select pg_advisory_xact_lock(730004)');
    await client.query(await fs.readFile(path.join(__dirname,'../database/migrations/004_nlp_review.sql'),'utf8'));
    await client.query('commit');console.log('Additive NLP migration complete. Historical reports retained; no external analysis triggered.');
  }catch(error){await client.query('rollback');throw error;}finally{client.release();}
}
main().catch(error=>{console.error('NLP migration failed:',error.code||error.name);process.exitCode=1;}).finally(()=>pool.end());
