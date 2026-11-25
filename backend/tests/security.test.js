process.env.NLP_WORKER_ENABLED='false';
process.env.NLP_AI_REVIEW_ENABLED='false';
process.env.NLP_AUTO_TRAIN_ENABLED='false';
process.env.PORT='0';
// Lets one test process present several client addresses through X-Forwarded-For.
process.env.TRUST_PROXY='1';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const bcrypt=require('bcrypt');
const {configureDemo}=require('../scripts/phase5-demo-config');
configureDemo();
const {Pool}=require('pg');
const {dbOptions}=require('../config/dbOptions');
const {passwordProblem}=require('../utils/passwordPolicy');
const {createRateLimiter}=require('../middleware/rateLimit');

test('password policy rejects guessable passwords and accepts passphrases',()=>{
  for(const weak of ['short1!','Password123!','Penjaga2026!!','1234567890123','aaaaaaaaaaaa','x'.repeat(73),'界'.repeat(25),undefined]){
    assert.ok(passwordProblem(weak),`expected rejection: ${weak}`);
  }
  assert.ok(passwordProblem('Amirhakim2026!',{username:'amirhakim'}));
  for(const strong of ['Original-password-123','hujan lebat petang selasa','ci-admin-fixture-only']){
    assert.equal(passwordProblem(strong,{username:'ci-admin'}),null,strong);
  }
});

test('rate limiter reports the first rejection of a window only',()=>{
  let reports=0;
  const limiter=createRateLimiter({max:2,windowMs:60_000,key:()=>'same',onLimit:()=>reports++});
  const res={set(){return this;},status(){return this;},json(){return this;}};
  for(let i=0;i<6;i++)limiter({},res,()=>{});
  assert.equal(reports,1);
});

test('an unattended browser session expires after the idle limit',async()=>{
  const {isIdle,startIdleWatch,IDLE_LIMIT_MS,ACTIVITY_KEY}=await import(pathToFileURL(path.join(__dirname,'../../src/utils/idleSession.js')));
  const storage=value=>({getItem:key=>key===ACTIVITY_KEY?value:null});
  const now=Date.now();
  assert.equal(isIdle(storage(String(now-IDLE_LIMIT_MS)),now),true);
  assert.equal(isIdle(storage(String(now-IDLE_LIMIT_MS+1000)),now),false);
  assert.equal(isIdle(storage(null),now),false);
  const listened=[];
  startIdleWatch(()=>{},{storage:{getItem:()=>null,setItem(){}},target:{addEventListener:name=>listened.push(name),removeEventListener(){},setInterval:()=>0,clearInterval(){}}})();
  assert.ok(listened.includes('wheel'));
  assert.equal(listened.includes('scroll'),false,'a page that scrolls itself must not count as activity');
});

test('security controls through real APIs on a disposable schema',async t=>{
  const schema=`penjaga_security_test_${process.pid}_${Date.now()}`;
  const admin=new Pool(dbOptions());
  const pool=require('../config/db');
  pool.options.options=`-c search_path=${schema} -c timezone=Asia/Kuala_Lumpur`;
  let server;
  try{
    await admin.query(`create schema ${schema}`);
    await require('../database/migrate').migrate(pool,{initialize:true});
    const password='Original-password-123';
    const hash=await bcrypt.hash(password,10);
    await pool.query(`insert into tbl_pengguna(id_pengguna,id_peranan,nama_penuh,nama_pengguna,emel,kata_laluan,status_akaun,no_kad_pengenalan) values
      (1,1,'Admin','admin','admin@example.invalid',$1,'Aktif','000000-00-0000'),(2,2,'Chief','chief','chief@example.invalid',$1,'Aktif',null),
      (3,3,'Guard','guard','guard@example.invalid',$1,'Aktif',null),(4,3,'Retired','retired','retired@example.invalid',$1,'Tidak Aktif',null)`,[hash]);
    await pool.query("select setval(pg_get_serial_sequence('tbl_pengguna','id_pengguna'),10)");
    server=require('../server');if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));
    const root=`http://127.0.0.1:${server.address().port}`;
    const send=async(url,{method='GET',token,body,ip='203.0.113.1',headers={}}={})=>{
      const form=body instanceof FormData;
      const response=await fetch(root+url,{method,headers:{'X-Forwarded-For':ip,'User-Agent':'security-test',...(body&&!form?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{}),...headers},body:body&&!form?JSON.stringify(body):body});
      const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}
      return {status:response.status,data,headers:response.headers};
    };
    const login=(username,secret=password,ip)=>send('/api/auth/login',{method:'POST',ip,body:{username,password:secret}});
    const tokenFor=async username=>{const result=await login(username);assert.equal(result.status,200,username);return result.data.token;};
    // Some security events are written after the response has been sent.
    const auditRow=async action=>{
      for(let attempt=0;attempt<40;attempt++){
        const {rows}=await pool.query('select * from tbl_audit_trail where jenis_aktiviti=$1 order by id_audit desc limit 1',[action]);
        if(rows[0])return rows[0];
        await new Promise(resolve=>setTimeout(resolve,50));
      }
      assert.fail(`no ${action} audit row`);
    };

    await t.test('login does not reveal which accounts exist or are disabled',async()=>{
      const unknown=await login('nobody','wrong-password-here','203.0.113.10');
      const wrong=await login('guard','wrong-password-here','203.0.113.11');
      const disabled=await login('retired','wrong-password-here','203.0.113.12');
      for(const result of [unknown,wrong,disabled]){assert.equal(result.status,401);assert.deepEqual(result.data,unknown.data);}
      assert.equal((await login('retired',password,'203.0.113.13')).status,403);
      const row=await auditRow('LOGIN_BLOCKED');
      assert.equal(row.alamat_ip,'203.0.113.13');assert.equal(row.peranti_pengguna,'security-test');
    });

    await t.test('one account is locked after repeated guesses from many addresses and admins are alerted',async()=>{
      for(let i=0;i<10;i++)assert.equal((await login('chief','wrong-password-here',`198.51.100.${i}`)).status,401);
      const blocked=await login('CHIEF ',password,'198.51.100.99');
      assert.equal(blocked.status,429);assert.ok(Number(blocked.headers.get('retry-after'))>0);
      assert.equal((await auditRow('LOGIN_RATE_LIMITED')).alamat_ip,'198.51.100.99');
      let alerts=0;
      for(let attempt=0;attempt<40&&!alerts;attempt++){
        alerts=(await pool.query("select count(*)::int n from tbl_notifikasi where id_pengguna=1 and jenis_notifikasi='Keselamatan'")).rows[0].n;
        if(!alerts)await new Promise(resolve=>setTimeout(resolve,50));
      }
      assert.equal(alerts,1);
    });

    await t.test('sign-out revokes only the token that signed out',async()=>{
      const first=await tokenFor('guard');const second=await tokenFor('guard');
      const out=await send('/api/auth/logout',{method:'POST',token:first});
      assert.equal(out.status,200);assert.equal(out.data.revoked,true);
      assert.equal((await send('/api/auth/me',{token:first})).status,401);
      assert.equal((await send('/api/auth/me',{token:second})).status,200);
      assert.equal((await auditRow('LOGOUT')).id_pengguna,3);
    });

    await t.test('a denied role is recorded',async()=>{
      const token=await tokenFor('guard');
      assert.equal((await send('/api/users',{token})).status,403);
      const row=await auditRow('ACCESS_DENIED');
      assert.equal(row.id_pengguna,3);assert.match(row.penerangan_aktiviti,/GET \/api\/users/);assert.equal(row.status_aktiviti,'Gagal');
    });

    await t.test('user management is validated, audited and cannot lock out the acting admin',async()=>{
      const token=await tokenFor('admin');
      for(const patch of [{status_akaun:'Tidak Aktif'},{id_peranan:3}])assert.equal((await send('/api/users/1',{method:'PATCH',token,body:patch})).status,409);
      assert.equal((await send('/api/users/abc',{method:'PATCH',token,body:{status_akaun:'Aktif'}})).status,400);
      assert.equal((await send('/api/users/3',{method:'PATCH',token,body:{id_peranan:999}})).status,400);
      const fresh={id_peranan:3,nama_penuh:'New Guard',nama_pengguna:'newguard',emel:'new@example.invalid',kata_laluan:'Password123!'};
      assert.equal((await send('/api/users',{method:'POST',token,body:fresh})).status,400);
      assert.equal((await send('/api/users',{method:'POST',token,body:{...fresh,kata_laluan:'hujan lebat petang selasa'}})).status,201);
      assert.equal((await auditRow('CREATE_USER')).alamat_ip,'203.0.113.1');
      assert.equal((await send('/api/users/3',{method:'PATCH',token,body:{status_akaun:'Aktif'}})).status,200);
      assert.equal((await auditRow('UPDATE_USER')).id_pengguna,1);
      const list=await send('/api/users',{token});
      assert.equal(list.status,200);
      for(const user of list.data){assert.equal('no_kad_pengenalan' in user,false);assert.equal('kata_laluan' in user,false);}
    });

    await t.test('multipart uploads still record the client address',async()=>{
      await pool.query(`insert into tbl_pos_kawalan(id_pos,nama_pos) values(901,'Security post');
        insert into tbl_laporan_harian(id_laporan,id_pengguna,id_pos,tajuk_laporan,syif,tarikh_laporan,masa_laporan,kandungan_laporan,status_laporan)
        values(901,3,901,'Lock','Pagi','2026-10-01','09:00','Synthetic','Diluluskan');
        insert into tbl_tindakan_susulan(id_tindakan,id_laporan,pegawai_bertanggungjawab,tindakan_diambil) values(901,901,'Officer','Check lock')`);
      const body=new FormData();body.set('catatan_progress','Lock checked');
      // The chief is locked out by the earlier test, so sign a session for that account directly.
      const token=require('jsonwebtoken').sign({id:2},require('../middleware/auth').jwtSecret,{expiresIn:'5m'});
      const result=await send('/api/actions/901/progress',{method:'POST',token,body,ip:'203.0.113.77'});
      assert.equal(result.status,201);
      assert.equal((await auditRow('ADD_ACTION_PROGRESS')).alamat_ip,'203.0.113.77');
    });

    await t.test('the security summary is for administrators only',async()=>{
      const summary=await send('/api/audit/security-summary',{token:await tokenFor('admin')});
      assert.equal(summary.status,200);assert.equal(summary.data.alert,true);
      assert.ok(summary.data.totals.LOGIN_FAILED>=10);assert.equal(summary.data.totals.LOGIN_RATE_LIMITED,1);
      assert.ok(summary.data.sources.length>0);
      assert.equal((await send('/api/audit/security-summary',{token:await tokenFor('guard')})).status,403);
    });

    await t.test('the audit trail cannot be rewritten or erased',async()=>{
      for(const statement of ["update tbl_audit_trail set penerangan_aktiviti='rewritten'",'delete from tbl_audit_trail','truncate tbl_audit_trail']){
        await assert.rejects(pool.query(statement),{code:'42501'},statement);
      }
    });

    await t.test('responses carry strict headers and unknown web origins are refused',async()=>{
      const health=await send('/api/health');
      assert.match(health.headers.get('content-security-policy'),/default-src 'none'/);
      assert.equal(health.headers.get('x-frame-options'),'DENY');
      assert.equal(health.headers.get('x-content-type-options'),'nosniff');
      assert.equal((await send('/api/health',{headers:{Origin:'https://attacker.example'}})).status,403);
      const local=await send('/api/health',{headers:{Origin:'http://localhost:4180'}});
      assert.equal(local.status,200);assert.equal(local.headers.get('access-control-allow-origin'),'http://localhost:4180');
      assert.equal(local.headers.get('access-control-allow-credentials'),null);
    });
  }finally{
    if(server)await new Promise(resolve=>server.close(resolve));
    await pool.end().catch(()=>{});
    await admin.query(`drop schema if exists ${schema} cascade`);
    await admin.end();
  }
});
