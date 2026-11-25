process.env.NLP_WORKER_ENABLED='false';
process.env.NLP_AI_REVIEW_ENABLED='false';
process.env.NLP_AUTO_TRAIN_ENABLED='false';
process.env.PORT='0';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const bcrypt=require('bcrypt');
const {configureDemo}=require('../scripts/phase5-demo-config');
configureDemo();
const {Pool}=require('pg');
const {dbOptions}=require('../config/dbOptions');

test('follow-up reply and read labels clear through real APIs on a disposable schema',async t=>{
  const schema=`penjaga_followup_test_${process.pid}_${Date.now()}`;
  const admin=new Pool(dbOptions());
  const pool=require('../config/db');
  pool.options.options=`-c search_path=${schema} -c timezone=Asia/Kuala_Lumpur`;
  let server;
  try{
    await admin.query(`create schema ${schema}`);
    await require('../database/migrate').migrate(pool,{initialize:true});
    const password='Original-password-123';
    const hash=await bcrypt.hash(password,10);
    await pool.query(`insert into tbl_pengguna(id_pengguna,id_peranan,nama_penuh,nama_pengguna,emel,kata_laluan,status_akaun) values
      (1,1,'Admin','admin','admin@example.invalid',$1,'Aktif'),(2,2,'Chief','chief','chief@example.invalid',$1,'Aktif'),
      (3,3,'Guard','guard','guard@example.invalid',$1,'Aktif')`,[hash]);
    await pool.query("insert into tbl_pos_kawalan(id_pos,nama_pos,status_pos) values(9001,'Pos ujian','Aktif')");
    await pool.query(`insert into tbl_laporan_harian(id_laporan,id_pengguna,id_pos,tajuk_laporan,syif,tarikh_laporan,masa_laporan,kandungan_laporan,status_laporan)
      select i,3,9001,'Laporan '||i,'Pagi',current_date,'09:00','Rekod ujian','Diluluskan' from generate_series(1,2) i`);
    await pool.query(`insert into tbl_tindakan_susulan(id_tindakan,id_laporan,pegawai_bertanggungjawab,tindakan_diambil)
      values(1,1,'Chief','Tindakan satu'),(2,2,'Chief','Tindakan dua')`);
    server=require('../server');if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));
    const root=`http://127.0.0.1:${server.address().port}`;
    const send=async(url,{method='GET',token,body}={})=>{
      const response=await fetch(root+url,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});
      return {status:response.status,data:await response.json()};
    };
    const tokenFor=async username=>{const result=await send('/api/auth/login',{method:'POST',body:{username,password}});assert.equal(result.status,200,username);return result.data.token;};
    const tokens={admin:await tokenFor('admin'),chief:await tokenFor('chief'),guard:await tokenFor('guard')};
    const ask=(id,note='Sila kemaskini')=>send(`/api/actions/${id}/request-update`,{method:'POST',token:tokens.admin,body:{catatan_progress:note}});
    const reply=(id,note='Sudah disemak')=>send(`/api/actions/${id}/progress`,{method:'POST',token:tokens.chief,body:{catatan_progress:note}});
    const setStatus=(id,status_tindakan)=>send(`/api/actions/${id}`,{method:'PATCH',token:tokens.admin,body:{status_tindakan}});
    const notesFor=async id=>(await send('/api/actions',{token:tokens.admin})).data.find(a=>a.id_tindakan===id).progress_notes;
    const pending=async id=>(await notesFor(id)).filter(n=>n.perlu_respon_ketua).length;
    const dashboardPending=async()=>(await send('/api/dashboard',{token:tokens.admin})).data.priority.permintaan_kemaskini_ketua;

    await t.test("the chief's reply answers every open request on that action only",async()=>{
      assert.equal((await ask(1)).status,201);
      assert.equal((await ask(1,'Gambar juga')).status,201);
      assert.equal((await ask(2)).status,201);
      assert.equal(await pending(1),2);
      assert.equal(await dashboardPending(),3);
      assert.equal((await reply(1)).status,201);
      assert.equal(await pending(1),0);
      assert.equal(await pending(2),1);
      assert.equal(await dashboardPending(),1);
    });

    await t.test('a later request waits for a reply again',async()=>{
      assert.equal((await ask(1,'Satu lagi')).status,201);
      assert.equal(await pending(1),1);
    });

    await t.test('only Selesai closes open requests, and reopening does not revive them',async()=>{
      assert.equal((await setStatus(2,'Dalam Tindakan')).status,200);
      assert.equal(await pending(2),1);
      assert.equal((await setStatus(2,'Selesai')).status,200);
      assert.equal(await pending(2),0);
      assert.equal((await setStatus(2,'Baru')).status,200);
      assert.equal(await pending(2),0);
      assert.equal((await setStatus(999,'Selesai')).status,404);
    });

    await t.test('only the administrator can mark chief notes as seen, up to the newest one shown',async()=>{
      const shown=(await reply(2,'Catatan pertama')).data;
      assert.equal(shown.dilihat_admin,false);
      assert.equal((await reply(2,'Tiba selepas paparan dimuat')).status,201);
      const mark=(token,id=2,upToId=shown.id_progress)=>send(`/api/actions/${id}/progress/seen`,{method:'POST',token,body:{upToId}});
      assert.equal((await mark(undefined)).status,401);
      assert.equal((await mark(tokens.chief)).status,403);
      assert.equal((await mark(tokens.guard)).status,403);
      assert.ok((await notesFor(2)).every(n=>n.jenis_progress!=='Kemaskini Ketua'||!n.dilihat_admin));
      assert.deepEqual((await mark(tokens.admin)).data,{updated:1});
      const chiefNotes=(await notesFor(2)).filter(n=>n.jenis_progress==='Kemaskini Ketua');
      assert.deepEqual(chiefNotes.map(n=>n.dilihat_admin),[true,false]);
      assert.ok((await notesFor(1)).every(n=>!n.dilihat_admin),'another action is untouched');
      for(const bad of [0,-1,1.5,'3',2147483648,undefined])assert.equal((await send('/api/actions/2/progress/seen',{method:'POST',token:tokens.admin,body:{upToId:bad}})).status,400,String(bad));
      assert.equal((await mark(tokens.admin,'abc')).status,400);
      assert.equal((await mark(tokens.admin,999)).status,404);
    });
  }finally{
    if(server)await new Promise(resolve=>server.close(resolve));
    await admin.query(`drop schema if exists ${schema} cascade`);
    await admin.end();
    await pool.end();
  }
});
