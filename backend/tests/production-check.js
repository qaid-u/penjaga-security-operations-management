// A production-mode configuration check against the isolated synthetic database, not a deployment.
require('../scripts/phase5-demo-config').configureDemo();
process.env.NODE_ENV='production';process.env.JWT_SECRET=require('node:crypto').randomBytes(32).toString('hex');process.env.FRONTEND_URL='https://phase5.example.invalid';process.env.PORT='0';
const pool=require('../config/db');const server=require('../server');
async function main(){if(!server.listening)await new Promise((resolve)=>server.once('listening',resolve));const base=`http://127.0.0.1:${server.address().port}`;
  const allowed=await fetch(base+'/api/health',{headers:{Origin:'https://phase5.example.invalid'}});
  const denied=await fetch(base+'/api/health',{headers:{Origin:'https://untrusted.example.invalid'}});
  console.log(JSON.stringify({allowed:allowed.status,origin:allowed.headers.get('access-control-allow-origin'),denied:denied.status,nosniff:allowed.headers.get('x-content-type-options')}));
}
main().catch(()=>{process.exitCode=1;}).finally(async()=>{await new Promise((resolve)=>server.close(resolve));await pool.end();});
