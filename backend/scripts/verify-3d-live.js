// Read-only operational checks against the configured DB; login writes normal audit records.
const path = require('node:path');
require('dotenv').config({path:path.join(__dirname,'../.env')});
process.env.PORT='0';
const server=require('../server');
const pool=require('../config/db');
const { execFile } = require('node:child_process');
async function main() {
  if (!server.listening) await new Promise((resolve)=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}/api`;
  await new Promise((resolve,reject)=>execFile(process.execPath,[path.join(__dirname,'smoke-test.js')],{env:{...process.env,API_BASE_URL:base}},(error,stdout,stderr)=>{if(error)return reject(new Error(stderr || 'Existing smoke test failed'));console.log(stdout.trim());resolve();}));
  const response=await fetch(`${base}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:process.env.SMOKE_USERNAME||'admin',password:process.env.SMOKE_PASSWORD||'Password123!'})});
  if(!response.ok)throw new Error(`Login failed: ${response.status}`);
  const login=await response.json(); const headers={Authorization:`Bearer ${login.token}`};
  for(const endpoint of ['/3d/locations','/3d/overview']) {
    const result=await fetch(base+endpoint,{headers}); if(!result.ok)throw new Error(`${endpoint}: ${result.status}`);
    const data=await result.json(); console.log(endpoint, result.status, endpoint.endsWith('locations')?{locations:data.length}:{locations:data.locations.length,linked_posts:data.totals.linked_posts});
    if(endpoint.endsWith('locations'))for(const location of data){const summary=await fetch(`${base}/3d/locations/${location.id_lokasi}/summary`,{headers});if(!summary.ok)throw new Error(`Summary failed: ${summary.status}`);}
  }
  console.log('All configured location summaries responded successfully. No mappings were changed.');
  const filtersResponse=await fetch(`${base}/3d/filters`,{headers});
  if(!filtersResponse.ok)throw new Error(`Filter references: ${filtersResponse.status}`);
  const filters=await filtersResponse.json();
  console.log('/3d/filters',filtersResponse.status,{posts:filters.posts.length,categories:filters.categories.length,timezone:filters.timezone});
  const start=new Date(`${filters.today}T00:00:00Z`);start.setUTCDate(start.getUTCDate()-365);
  const params=new URLSearchParams({date:filters.today,from:start.toISOString().slice(0,10),to:filters.today,mapping:'all'});
  const overviewResponse=await fetch(`${base}/3d/overview?${params}`,{headers});
  if(!overviewResponse.ok)throw new Error(`Advanced overview: ${overviewResponse.status}`);
  const overview=await overviewResponse.json();
  for(const suffix of ['', '&risk=HighCritical', '&mapping=unlinked']) {
    // Replace mapping instead of sending duplicate query parameters.
    const query=new URLSearchParams(params);
    if(suffix.includes('risk'))query.set('risk','HighCritical');
    if(suffix.includes('unlinked'))query.set('mapping','unlinked');
    const result=await fetch(`${base}/3d/incidents?${query}`,{headers});
    if(!result.ok)throw new Error(`Incident history: ${result.status}`);
    const data=await result.json();
    if(!suffix && data.total!==overview.totals.reports)throw new Error('History and overview counts differ');
    console.log('/3d/incidents',result.status,{filter:suffix||'all',reports:data.total,returned:data.items.length});
  }
}
main().catch((error)=>{console.error(error.message);process.exitCode=1;}).finally(async()=>{await new Promise((resolve)=>server.close(resolve));await pool.end();});
