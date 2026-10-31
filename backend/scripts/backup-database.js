const fs=require('node:fs/promises');
const path=require('node:path');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const run=promisify(execFile);
require('dotenv').config({path:path.join(__dirname,'../.env')});
const {dbOptions}=require('../config/dbOptions');

function clientEnvironment(env=process.env) {
  const result={...env};
  const options=dbOptions(env);
  if(options.connectionString){
    const url=new URL(options.connectionString);
    Object.assign(result,{PGHOST:url.hostname.replace(/^\[|\]$/g,''),PGPORT:url.port||'5432',PGDATABASE:decodeURIComponent(url.pathname.slice(1)),PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password)});
    for(const [key,value] of url.searchParams){
      const variable={sslrootcert:'PGSSLROOTCERT',sslcert:'PGSSLCERT',sslkey:'PGSSLKEY',options:'PGOPTIONS',application_name:'PGAPPNAME'}[key];
      if(variable)result[variable]=value;
      else throw new Error('Backup connection URL contains an unsupported option; configure PostgreSQL client environment variables instead.');
    }
  } else Object.assign(result,{PGHOST:options.host,PGPORT:String(options.port),PGDATABASE:options.database,PGUSER:options.user,PGPASSWORD:options.password});
  result.PGSSLMODE=options.ssl?'verify-full':'disable';
  result.PGCONNECT_TIMEOUT='5';
  result.PGOPTIONS=result.PGOPTIONS||options.options;
  return result;
}

async function backup({directory,env=process.env}={}) {
  const output=directory||path.resolve(__dirname,'../../.database-backups.local',new Date().toISOString().replaceAll(':','-'));
  // mkdir without recursive refuses reuse of an existing backup directory.
  await fs.mkdir(path.dirname(output),{recursive:true});
  await fs.mkdir(output,{mode:0o700});
  const clientEnv=clientEnvironment(env);
  const options=dbOptions(env);
  const exe=name=>env.PG_BIN?path.join(env.PG_BIN,name+(process.platform==='win32'?'.exe':'')):name;
  const caFile=path.join(output,'root-cert.local');
  try {
    if(options.ssl?.ca){await fs.writeFile(caFile,options.ssl.ca,{mode:0o600,flag:'wx'});clientEnv.PGSSLROOTCERT=caFile;}
    const dump=path.join(output,'database.dump');
    await run(exe('pg_dump'),['--format=custom','--no-owner','--no-privileges','--file',dump],{env:clientEnv,windowsHide:true,timeout:300000});
    await fs.chmod(dump,0o600);
    // Check the archive can be read before declaring the backup complete.
    await run(exe('pg_restore'),['--list',dump],{env:clientEnv,windowsHide:true,timeout:30000,maxBuffer:8*1024*1024});
    const uploads=path.resolve(__dirname,'../uploads');
    let hasUploads=false;
    try{await fs.access(uploads);hasUploads=true;}catch(error){if(error.code!=='ENOENT')throw error;}
    if(hasUploads)await fs.cp(uploads,path.join(output,'uploads'),{recursive:true,dereference:false,errorOnExist:true,force:false});
    const manifest={createdAt:new Date().toISOString(),database:'database.dump',format:'PostgreSQL custom archive',uploads:hasUploads?'uploads':null,dumpBytes:(await fs.stat(dump)).size,restoreTested:false,consistency:'Run with application writers stopped; database dump alone is transactionally consistent.'};
    await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o600,flag:'wx'});
    return {directory:output,...manifest};
  } finally {await fs.unlink(caFile).catch(error=>{if(error.code!=='ENOENT')throw error;});}
}
if(require.main===module){
  if(process.argv.length>2){console.error('Usage: node scripts/backup-database.js (configure PG_BIN and database environment variables)');process.exitCode=1;}
  else backup().then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error('Backup failed:',error.code||error.name);process.exitCode=1;});
}
module.exports={backup,clientEnvironment};
