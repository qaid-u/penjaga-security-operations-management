const {configureDemo}=require('./phase5-demo-config');configureDemo();
const pool=require('../config/db');
const {createService,period}=require('../services/threeDService');
const {performance}=require('node:perf_hooks');
const fs=require('node:fs/promises');const path=require('node:path');const crypto=require('node:crypto');
const label=process.env.PHASE5_BENCHMARK || 'after';
async function main(){
  const queries=[];
  const instrument={query:(sql,params)=>pool.query(sql,params),async connect(){const client=await pool.connect();return{release:()=>client.release(),async query(sql,params){const started=performance.now();const result=await client.query(sql,params);if(/^\s*(select|with)/i.test(sql)){const explained=(await client.query(`explain (analyze,buffers,format json) ${sql}`,params)).rows[0]['QUERY PLAN'][0];queries.push({sql_hash:crypto.createHash('sha256').update(sql).digest('hex').slice(0,12),client_plus_explain_ms:performance.now()-started,rows:result.rowCount,execution_ms:explained['Execution Time'],planning_ms:explained['Planning Time'],plan:explained.Plan});}return result;}};}};
  const service=createService(instrument);const p=period({date:'2026-10-24',from:'2026-09-25',to:'2026-10-24',mapping:'all'});
  await service.overview(p);await service.summary(1,p);await service.incidents(p,{limit:20});
  const output={label,database:'isolated synthetic demo, 240 reports',queries};await fs.mkdir(path.join(__dirname,'../../docs/psm-evaluation/evidence'),{recursive:true});await fs.writeFile(path.join(__dirname,`../../docs/psm-evaluation/evidence/sql-${label}.json`),JSON.stringify(output,null,2));console.log(`Recorded ${queries.length} read query plans on synthetic demo.`);
}
main().catch((error)=>{console.error(error.message);process.exitCode=1;}).finally(()=>pool.end());
