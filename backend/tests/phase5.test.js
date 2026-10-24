const {test}=require('node:test');const assert=require('node:assert/strict');
const {configureDemo}=require('../scripts/phase5-demo-config');configureDemo();
process.env.PORT='0';
const pool=require('../config/db');const jwt=require('jsonwebtoken');const {jwtSecret}=require('../middleware/auth');
const fs=require('node:fs/promises');const path=require('node:path');
const {referencesAttachment}=require('../utils/attachments');
const {dbOptions}=require('../config/dbOptions');
const {execFileSync}=require('node:child_process');

test('attachment references must match whole stored paths, including legacy scalar records',()=>{
  assert.equal(referencesAttachment('["/uploads/a.pdf-other"]','/uploads/a.pdf'),false);
  assert.equal(referencesAttachment('["/uploads/a.pdf"]','/uploads/a.pdf'),true);
  assert.equal(referencesAttachment('/uploads/a.pdf','/uploads/a.pdf'),true);
  assert.equal(referencesAttachment('malformed','/uploads/a.pdf'),false);
});

test('production DB TLS verifies certificates even with sslmode=require and connections are bounded',()=>{
  const options=dbOptions({NODE_ENV:'production',DATABASE_URL:'postgres://demo:fixture@example.invalid/demo?sslmode=require'});
  assert.equal(options.ssl.rejectUnauthorized,true);assert.ok(!options.connectionString.includes('sslmode='));assert.equal(options.connectionTimeoutMillis,5000);
  assert.equal(dbOptions({PGSSL:'true'}).ssl.rejectUnauthorized,true);
  assert.equal(dbOptions({PGSSLMODE:'disable',DATABASE_URL:'postgres://demo:fixture@localhost/demo'}).ssl,false);
});
test('production-mode CORS and security headers enforce explicit origin configuration',()=>{
  const output=execFileSync(process.execPath,[path.join(__dirname,'production-check.js')],{windowsHide:true,timeout:15000,encoding:'utf8'});
  const result=JSON.parse(output.trim().split('\n').at(-1));assert.equal(result.allowed,200);assert.equal(result.denied,403);assert.equal(result.origin,'https://phase5.example.invalid');assert.equal(result.nosniff,'nosniff');
});

test('Phase 5 security and legacy data regressions on separate synthetic database',async(t)=>{
  const server=require('../server');if(!server.listening)await new Promise((resolve)=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const token=(id,options={})=>jwt.sign({id},jwtSecret,{expiresIn:'5m',...options});
  const request=async(route,id,method='GET',body,headers={})=>{
    const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(id?{Authorization:`Bearer ${token(id)}`} : {}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
    const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}return{status:response.status,data,headers:response.headers};
  };
  const originalConnect=pool.connect.bind(pool),originalQuery=pool.query.bind(pool);
  const files=['phase5-owner.html','phase5-prefix.pdf'];
  const originals=(await pool.query('select id_laporan,lampiran_fail from tbl_laporan_harian where id_laporan in(1,2)')).rows;
  try {
    await t.test('S01 direct management APIs reject missing, expired, forged and guard tokens',async()=>{
      for(const route of ['/api/3d/overview','/api/3d/incidents','/api/3d/filters','/api/audit','/api/users','/api/posts']){
        assert.equal((await request(route,null)).status,401);assert.equal((await request(route,3)).status,403);
      }
      for(const auth of [`Bearer ${token(1,{expiresIn:-1})}`,`Basic ${token(1)}`,`Bearer ${jwt.sign({id:1},'incorrect-secret')}`,`Bearer ${token('1 OR 1=1')}`])assert.equal((await request('/api/3d/overview',null,'GET',undefined,{Authorization:auth})).status,401);
    });
    await t.test('S02 unexpected filters, malformed JSON and oversized pagination fail safely',async()=>{
      for(const query of ['extra=x','zone=UNVERIFIED','post=1%20OR%201=1','from=2026-10-24&to=2026-10-01','limit=100000','category[x]=y'])assert.equal((await request(`/api/3d/incidents?${query}`,1)).status,400);
      const response=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"username":'});assert.equal(response.status,400);assert.match((await response.json()).message,/JSON/);
      for(const body of [{username:{x:1},password:'x'},{username:'demo_admin',password:['x']}])assert.equal((await request('/api/auth/login',null,'POST',body)).status,400);
      assert.equal((await request('/api/posts',1,'POST',{nama_pos:{x:1}})).status,400);
      assert.equal((await request('/api/actions',1,'POST',{id_laporan:1,pegawai_bertanggungjawab:{x:1},tindakan_diambil:'x'})).status,400);
    });
    await t.test('S03 report review, mapping and action writes retain role restrictions',async()=>{
      for(const id of [1,3,4])assert.equal((await request('/api/reports/1/review',id,'PATCH',{status:'approved'})).status,403);
      for(const id of [2,3,4])assert.equal((await request('/api/actions/1',id,'PATCH',{status_tindakan:'Selesai'})).status,403);
      for(const id of [2,3,4])assert.equal((await request('/api/3d/locations/1/mapping',id,'PATCH',{id_pos:null})).status,403);
      assert.equal((await request('/api/actions/1/progress',1,'POST',{catatan_progress:'denied'})).status,403);
      assert.equal((await request('/api/nlp/1',2)).status,403);
    });
    await t.test('D02 legacy report/action/dashboard queries select latest NLP once per report',async()=>{
      const reportList=(await request('/api/reports?limit=100',1)).data;
      assert.equal(new Set(reportList.data.map((r)=>r.id_laporan)).size,reportList.data.length);
      const details=(await request('/api/reports/1',1)).data;assert.equal(details.report.tahap_risiko,'High');
      const dashboard=(await request('/api/dashboard',1)).data;assert.equal(dashboard.cards.total_laporan,240);
      assert.equal(dashboard.byRisk.reduce((n,r)=>n+r.value,0),240);
      assert.equal(dashboard.byRisk.find((r)=>r.name==='Unknown').value,1);
      assert.equal((await request('/api/reports/240',1)).data.report.tahap_risiko,'Unknown');
      const actions=(await request('/api/actions',1)).data;assert.equal(actions.length,3);
      assert.equal((await request('/api/reports/1',4)).status,403);
      const own=(await request('/api/reports?limit=100',4)).data;assert.ok(own.data.every((r)=>r.id_pengguna===4));
    });
    await t.test('S04 protected evidence uses exact ownership references and safe download headers',async()=>{
      for(const file of files)await fs.writeFile(path.join(__dirname,'../uploads',file),'%PDF-1.4\nsynthetic evidence');
      await pool.query('update tbl_laporan_harian set lampiran_fail=$1 where id_laporan=1',[JSON.stringify(['/uploads/phase5-owner.html'])]);
      await pool.query('update tbl_laporan_harian set lampiran_fail=$1 where id_laporan=2',[JSON.stringify(['/uploads/phase5-prefix.pdf-other'])]);
      assert.equal((await request('/uploads/phase5-owner.html',null)).status,401);
      assert.equal((await request('/uploads/phase5-owner.html',4)).status,404);
      assert.equal((await request('/uploads/phase5-prefix.pdf',1)).status,404);
      for(const id of [1,2,3]){const response=await request('/uploads/phase5-owner.html',id);assert.equal(response.status,200);assert.match(response.headers.get('content-disposition'),/^attachment/);assert.match(response.headers.get('content-type'),/^application\/pdf/);assert.equal(response.headers.get('x-content-type-options'),'nosniff');}
    });
    await t.test('S06 multipart validation and rejected-file cleanup work with the upgraded upload parser',async()=>{
      const before=new Set(await fs.readdir(path.join(__dirname,'../uploads')));
      for(const [type,content,status] of [['image/png','not a PNG',400],['application/pdf','%PDF-1.4 synthetic, missing required form fields',400],['application/pdf','%PDF-'+ 'x'.repeat(8*1024*1024),413]]){
        const form=new FormData();form.append('lampiran_fail',new Blob([content],{type}),'phase5-rejected.pdf');
        const response=await fetch(base+'/api/reports',{method:'POST',headers:{Authorization:`Bearer ${token(3)}`},body:form});assert.equal(response.status,status);
      }
      await new Promise((resolve)=>setTimeout(resolve,100));
      const after=await fs.readdir(path.join(__dirname,'../uploads'));assert.ok(after.every((file)=>before.has(file)));
    });
    await t.test('R03 connection failures return controlled errors rather than unhandled rejections',async()=>{
      pool.connect=(...args)=>typeof args[0]==='function' ? originalConnect(...args) : Promise.reject(new Error('private DSN details'));
      assert.equal((await request('/api/auth/login',null,'POST',{username:'demo_admin',password:'irrelevant'})).status,500);
      for(const route of ['/api/dashboard','/api/reports','/api/actions','/api/meta','/api/posts','/api/jadual/mingguan']){
        const response=await request(route,1);assert.equal(response.status,500);assert.ok(!JSON.stringify(response.data).includes('private DSN'));
      }
      pool.connect=originalConnect;
    });
    await t.test('S05 disabled accounts cannot use a still-valid JWT',async()=>{
      await pool.query("update tbl_pengguna set status_akaun='Tidak Aktif' where id_pengguna=4");
      assert.equal((await request('/api/auth/me',4)).status,403);
      await pool.query("update tbl_pengguna set status_akaun='Aktif' where id_pengguna=4");
    });
  } finally {
    pool.connect=originalConnect;pool.query=originalQuery;
    for(const row of originals)await pool.query('update tbl_laporan_harian set lampiran_fail=$1 where id_laporan=$2',[row.lampiran_fail,row.id_laporan]);
    await pool.query("update tbl_pengguna set status_akaun='Aktif' where id_pengguna=4");
    for(const file of files)await fs.unlink(path.join(__dirname,'../uploads',file)).catch(()=>{});
    await new Promise((resolve)=>server.close(resolve));await pool.end();
  }
});
