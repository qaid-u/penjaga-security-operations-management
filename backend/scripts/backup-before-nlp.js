// Local-only private recovery snapshot. Never prints connection strings or row data.
const path=require('node:path');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
require('dotenv').config({path:path.join(__dirname,'../.env')});
const {dbOptions}=require('../config/dbOptions');
const options=dbOptions();
const taskRoot=path.resolve(__dirname,'../..');
const output=path.resolve(taskRoot,'.phase7-runtime.local');
if(!output.startsWith(taskRoot+path.sep))throw new Error('Invalid private backup path');
const url=options.connectionString?new URL(options.connectionString):null;
const host=url?url.hostname:options.host;
if(!['localhost','127.0.0.1','::1','[::1]'].includes(host))throw new Error('This helper only backs up an explicitly local development database.');
fs.mkdirSync(output,{recursive:true});
const destination=path.join(output,`before-nlp-${new Date().toISOString().replace(/[:.]/g,'-')}.dump`);
const environment={...process.env};
if(url)Object.assign(environment,{PGHOST:url.hostname,PGPORT:url.port||'5432',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGDATABASE:decodeURIComponent(url.pathname.slice(1))});
else Object.assign(environment,{PGHOST:options.host,PGPORT:String(options.port),PGUSER:options.user,PGPASSWORD:options.password,PGDATABASE:options.database});
try{
  execFileSync(process.platform==='win32'?'pg_dump.exe':'pg_dump',['--format=custom','--file',destination],{env:environment,windowsHide:true,stdio:'pipe'});
  console.log('Private local recovery snapshot created in ignored .phase7-runtime.local. No data exported to project documentation.');
}catch{console.error('Private backup failed. No migration attempted by this helper.');process.exitCode=1;}
