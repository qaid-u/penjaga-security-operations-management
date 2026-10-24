// Optional local standalone PostgreSQL cluster when the existing app role lacks CREATEDB.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../../.phase5-runtime.local');
const data=path.join(root,'data');
const exe=(name)=>process.platform==='win32'?`${name}.exe`:name;
fs.mkdirSync(root,{recursive:true});
const configFile=path.join(root,'connection.json');
let config;
if(fs.existsSync(configFile))config=JSON.parse(fs.readFileSync(configFile,'utf8'));
else {config={host:'127.0.0.1',port:55435,user:'phase5_demo',password:crypto.randomBytes(32).toString('hex')};fs.writeFileSync(configFile,JSON.stringify(config),{mode:0o600,flag:'wx'});}
if(!fs.existsSync(path.join(data,'PG_VERSION'))) {
  const passwordFile=path.join(root,'init-password.local');
  fs.writeFileSync(passwordFile,config.password,{mode:0o600});
  try {execFileSync(exe('initdb'),['-D',data,'-U',config.user,'-A','scram-sha-256','--pwfile',passwordFile,'--encoding=UTF8','--locale=C'],{windowsHide:true,stdio:'pipe'});}
  finally {fs.unlinkSync(passwordFile);}
}
try {execFileSync(exe('pg_ctl'),['-D',data,'status'],{windowsHide:true,stdio:'pipe'});console.log('Isolated PostgreSQL cluster already running on 127.0.0.1:55435.');}
catch {execFileSync(exe('pg_ctl'),['-D',data,'-l',path.join(root,'postgres.log'),'-o','-h 127.0.0.1 -p 55435','-w','start'],{windowsHide:true,stdio:'ignore'});console.log('Started isolated PostgreSQL cluster on 127.0.0.1:55435. Credentials remain in ignored local runtime directory.');}
