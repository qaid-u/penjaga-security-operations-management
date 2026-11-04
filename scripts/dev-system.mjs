import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {spawn} from 'node:child_process';
import net from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(path.join(root,'backend/package.json'));
require('dotenv').config({path:path.join(root,'backend/.env')});
const pool=require('./config/db');
const {schemaReady}=require('./services/nlpJobs');
const {loadModel}=require('./ml/nlpService');
const {validateModel}=require('./ml/textModel');
const owned=[];
let stopping=false;
function stop(){stopping=true;for(const child of owned)if(child.exitCode===null)child.kill();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
const listening=port=>new Promise(resolve=>{
  const socket=net.createConnection({host:'127.0.0.1',port});
  const done=value=>{socket.destroy();resolve(value);};
  socket.once('connect',()=>done(true));socket.once('error',()=>done(false));socket.setTimeout(1000,()=>done(false));
});
async function healthy(url,api=false){
  try{const response=await fetch(url,{signal:AbortSignal.timeout(1500)});if(!response.ok)return false;return api?(await response.json()).db==='Connected':(await response.text()).includes('PENJAGA');}catch{return false;}
}
function launch(args,cwd,env){
  const child=spawn(process.execPath,args,{cwd,env:{...process.env,...env},stdio:'inherit',windowsHide:true});owned.push(child);
  child.on('error',()=>{console.error('A local service could not start.');process.exitCode=1;stop();});
  child.on('exit',code=>{if(!stopping){console.error(`A local service stopped (${code}).`);process.exitCode=1;stop();}});
}
async function main(){
  if(process.env.NODE_ENV==='production')throw new Error('dev:system is for local development. Use the deployment guide for production.');
  const port=Number(process.env.PORT||3000);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Set a valid backend PORT.');
  if(!await schemaReady(pool))throw new Error('Database setup is incomplete. Run npm --prefix backend run db:migrate -- --init.');
  const model=await require('./services/automaticLearning').activeModel(pool,loadModel());validateModel(model);
  if(!(await pool.query("select 1 from tbl_kategori_insiden where status_kategori='Aktif' limit 1")).rowCount)throw new Error('No active incident categories are configured in PostgreSQL.');
  const api=`http://127.0.0.1:${port}`;
  if(await listening(port)){if(!await healthy(api+'/api/ready',true))throw new Error('The backend port is occupied but PENJAGA is not ready. Check the existing service.');}
  else launch(['server.js'],path.join(root,'backend'),{NLP_WORKER_ENABLED:'true'});
  if(await listening(5173)){if(!await healthy('http://127.0.0.1:5173/'))throw new Error('Port 5173 is occupied by another application.');}
  else launch([path.join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5173','--strictPort'],root,{VITE_API_URL:api+'/api',VITE_API_ORIGIN:api});
  const deadline=Date.now()+20000;
  while(!stopping&&Date.now()<deadline){
    if(await healthy(api+'/api/ready',true)&&await healthy('http://127.0.0.1:5173/')){
      console.log(`PENJAGA ready: http://127.0.0.1:5173/login\nAPI: ${api}/api/ready\nClassification model: ${model.version}`);
      if(owned.length)console.log('Press Ctrl+C to stop services started by this command. Existing services are reused.');
      return;
    }
    await delay(300);
  }
  throw new Error('Startup timed out. Check database connectivity and the service output.');
}
main().catch(error=>{console.error('PENJAGA startup:',error.code||error.message);process.exitCode=1;stop();}).finally(()=>pool.end());
