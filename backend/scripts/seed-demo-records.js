const path=require('node:path');
require('dotenv').config({path:path.join(__dirname,'../.env')});
const {processNLP,context}=require('../ml/nlpService');
const {inputHash,PIPELINE_VERSION}=require('../services/nlpJobs');
const {dbOptions}=require('../config/dbOptions');
const BATCH='PENJAGA_DEMO_RECORDS_V1';
const TAG='[DEMO OPS V1]';
const shift=(date,days)=>new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
const scenarios=[
  ['Pemeriksaan laluan pejabat','Pada pukul 09:00, rondaan selesai di sekitar pejabat. Keadaan terkawal dan semua pintu diperiksa. Buku laporan dikemas kini.'],
  ['Semakan kemasukan tanpa pas','Pada pukul 15:20, individu tanpa pas cuba masuk tanpa izin ke ruang pejabat. Pengawal menolak akses dan memaklumkan ketua.'],
  ['Kejadian asap di bilik utiliti','Pada pukul 23:10, asap tebal dan api kecil dikesan pada sambungan kuasa di bilik utiliti. Bomba dihubungi dan kawasan dikosongkan.'],
  ['Pertengkaran di kaunter','Pada pukul 09:30, pergaduhan antara pelawat berlaku selepas pertengkaran di kaunter. Pengawal meleraikan mereka dan mengawal keadaan.'],
  ['Semakan peralatan simpanan','Pada pukul 15:00, radio komunikasi hilang dari rak simpanan. Rekod pinjaman dan rakaman kamera disemak bersama penyelia.'],
  ['Kerosakan papan kenyataan','Pada pukul 23:15, papan notis diconteng dan cermin dipecahkan dengan sengaja. Pengawal mengambil gambar untuk rekod vandalisme.'],
  ['Pemeriksaan pintu servis','Pada pukul 09:10, pintu belakang tidak berkunci dan laluan kecemasan terhalang oleh kotak. Petugas mengunci pintu dan mengalihkan halangan.'],
  ['Gangguan paparan kamera','Pada pukul 15:30, CCTV tidak berfungsi dan lampu rosak di ruang servis. Pemantauan manual dibuat dan unit fasiliti dimaklumkan.'],
];

async function seedDemoRecords(pool){
  const client=await pool.connect();
  try{
    await client.query('begin');
    await client.query('select pg_advisory_xact_lock(7419,1)');
    const previous=(await client.query("select nilai_baharu from tbl_audit_trail where jenis_aktiviti='SEED_DEMO_RECORDS' and rekod_terlibat=$1 order by id_audit desc limit 1",[BATCH])).rows[0];
    if(previous){await client.query('commit');return {alreadyPresent:true,...JSON.parse(previous.nilai_baharu)};}
    const actors={};
    for(const [key,username,role] of [['admin','test_admin','Pentadbir Sistem'],['chief','test_ketua','Ketua Pengawal'],['guard','test_pengawal','Pengawal Keselamatan']]){
      const found=await client.query("select p.id_pengguna from tbl_pengguna p join tbl_peranan r using(id_peranan) where p.nama_pengguna=$1 and p.emel=$1||'@example.invalid' and p.status_akaun='Aktif' and r.nama_peranan=$2",[username,role]);
      if(found.rowCount!==1)throw new Error(`Designated active test account required: ${username}`);
      actors[key]=found.rows[0].id_pengguna;
    }
    const posts=(await client.query("select id_pos from tbl_pos_kawalan where status_pos='Aktif' order by id_pos")).rows;
    if(!posts.length)throw new Error('No active security posts');
    const refs=await context(client);
    if(!refs.categories.length)throw new Error('No active incident categories');
    const checklist=(await client.query('select id_checklist from tbl_checklist where status_aktif order by id_checklist')).rows;
    const today=(await client.query("select (now() at time zone 'Asia/Kuala_Lumpur')::date::text as date")).rows[0].date;
    const summary={batch:BATCH,anchorDate:today,reports:0,submitted:0,approved:0,rejected:0,actions:0,pendingFollowUps:0,assignments:0,attendance:0,skippedConflicts:0,skippedLocked:0};
    for(let i=0;i<28;i++){
      const [title,text]=scenarios[i%scenarios.length];
      const date=shift(today,i-27),post=posts[i%posts.length].id_pos;
      const stage=i%7,status=stage<2?'Dihantar':stage===2?'Ditolak':'Diluluskan';
      const needs=status==='Diluluskan'&&stage!==3;
      const analysis=await processNLP(text,{context:refs,selectedPostId:post});
      const category=refs.categories.find(row=>row.name===analysis.topCategory)?.id||null;
      const report=(await client.query(`insert into tbl_laporan_harian(id_pengguna,id_pos,id_kategori_insiden,tajuk_laporan,syif,tarikh_laporan,masa_laporan,kandungan_laporan,status_laporan,perlu_tindakan_susulan,lampiran_fail,nlp_context)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'[]','{}') returning *`,[actors.guard,post,category,`${TAG} ${String(i+1).padStart(2,'0')} · ${title}`,['Pagi','Petang','Malam'][i%3],date,['09:00','15:30','23:15'][i%3],text,status,needs])).rows[0];
      const metadata={...analysis,schemaVersion:3,pipelineVersion:PIPELINE_VERSION,inputHash:inputHash(report),synthetic:true,demoBatch:BATCH,review:{status:'unavailable',provider:'none',reason:'DEMO_RECORD'},provenance:'Fictional operational example; not an actual incident or training observation.'};
      const saved=(await client.query(`insert into tbl_hasil_nlp(id_laporan,teks_diproses,kata_kunci_dikesan,kategori_dikesan,skor_risiko,tahap_risiko,ringkasan_automatik,tahap_keyakinan,metadata)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id_nlp`,[report.id_laporan,analysis.cleanText,analysis.matchedKeywords||[],analysis.topCategory,analysis.riskScore,analysis.riskLevel,analysis.summary,analysis.confidence,metadata])).rows[0];
      await client.query('update tbl_laporan_harian set tahap_risiko=$1 where id_laporan=$2',[analysis.riskLevel,report.id_laporan]);
      await client.query("insert into tbl_job_nlp(id_laporan,input_hash,pipeline_version,status,attempts,id_nlp,requested_by,completed_at) values($1,$2,$3,'completed',1,$4,$5,now())",[report.id_laporan,inputHash(report),PIPELINE_VERSION+':demo-v1',saved.id_nlp,actors.guard]);
      for(const item of checklist)await client.query("insert into tbl_jawapan_checklist(id_laporan,id_checklist,jawapan,catatan) values($1,$2,'Ya',$3)",[report.id_laporan,item.id_checklist,TAG+' Jawapan contoh untuk demonstrasi.']);
      summary.reports++;
      if(status==='Dihantar')summary.submitted++;else{
        summary[status==='Diluluskan'?'approved':'rejected']++;
        await client.query("insert into tbl_pengesahan_laporan(id_laporan,id_pengguna_pengesah,status_pengesahan,catatan_pengesahan,tarikh_pengesahan) values($1,$2,$3,$4,$5::date+$6::time+interval '20 minutes')",[report.id_laporan,actors.chief,status,TAG+' Semakan contoh; bukan pengesahan insiden sebenar.',date,report.masa_laporan]);
      }
      if(needs&&stage===6)summary.pendingFollowUps++;
      if(needs&&stage!==6){
        const actionStatus=['Baru','Dalam Tindakan','Selesai'][summary.actions%3];
        const priority=['Low','Medium','High','Critical'].includes(analysis.riskLevel)?analysis.riskLevel:'Medium';
        const action=(await client.query(`insert into tbl_tindakan_susulan(id_laporan,pegawai_bertanggungjawab,tindakan_diambil,status_tindakan,tahap_keutamaan,tarikh_mula,tarikh_selesai,catatan_tindakan)
          values($1,$2,$3,$4,$5,$6,$7,$8) returning id_tindakan`,[report.id_laporan,TAG+' Pegawai contoh',TAG+' Pemeriksaan dan pembaikan contoh berkaitan laporan.',actionStatus,priority,date,actionStatus==='Selesai'?shift(date,1):null,TAG+' Rekod tindakan simulasi.'])).rows[0];
        if(actionStatus!=='Baru')await client.query("insert into tbl_progress_tindakan(id_tindakan,id_pengguna,catatan_progress,jenis_progress) values($1,$2,$3,'Kemaskini Ketua')",[action.id_tindakan,actors.chief,TAG+' Pemeriksaan contoh telah dilakukan dan kemajuan direkodkan.']);
        summary.actions++;
      }
    }
    for(let offset=-7;offset<=6;offset++){
      const date=shift(today,offset);
      const bounds=(await client.query("select date_trunc('week',$1::date::timestamp)::date::text as first,(date_trunc('week',$1::date::timestamp)::date+6)::text as last",[date])).rows[0];
      let week=(await client.query('select id_jadual_mingguan,status_jadual from tbl_jadual_mingguan where tarikh_mula=$1 and tarikh_tamat=$2 order by id_jadual_mingguan desc limit 1',[bounds.first,bounds.last])).rows[0];
      if(week?.status_jadual==='Dikunci'){summary.skippedLocked++;continue;}
      const conflict=await client.query(`select 1 from tbl_jadual_bertugas where id_pengguna=$1 and tarikh_tugas+masa_mula<$2::date+time '16:00'
        and tarikh_tugas+masa_tamat+case when masa_tamat<masa_mula then interval '1 day' else interval '0' end>$2::date+time '08:00' limit 1`,[actors.guard,date]);
      if(conflict.rowCount){summary.skippedConflicts++;continue;}
      if(!week)week=(await client.query("insert into tbl_jadual_mingguan(tarikh_mula,tarikh_tamat,tajuk_jadual,status_jadual,dicipta_oleh,disahkan_oleh,tarikh_disahkan,catatan) values($1,$2,$3,'Disahkan',$4,$4,now(),$5) returning id_jadual_mingguan,status_jadual",[bounds.first,bounds.last,TAG+' Jadual contoh',actors.admin,TAG+' Tugasan simulasi, bukan arahan penempatan sebenar.'])).rows[0];
      const assignment=(await client.query("insert into tbl_jadual_bertugas(id_jadual_mingguan,id_pengguna,id_pos,tarikh_tugas,syif,masa_mula,masa_tamat,status_bertugas,catatan,dicipta_oleh) values($1,$2,$3,$4,'Pagi','08:00','16:00',$5,$6,$7) returning id_jadual",[week.id_jadual_mingguan,actors.guard,posts[(offset+7)%posts.length].id_pos,date,offset<0?'Selesai':'Dijadualkan',TAG+' Tugasan contoh untuk demonstrasi.',actors.admin])).rows[0];
      summary.assignments++;
      if(offset<0){await client.query("insert into tbl_kehadiran_tugas(id_jadual,id_pengguna,masa_check_in,masa_check_out,status_kehadiran,catatan) values($1,$2,$3::date+time '08:00',$3::date+time '16:00','Selesai',$4)",[assignment.id_jadual,actors.guard,date,TAG+' Kehadiran simulasi; bukan bukti kehadiran sebenar.']);summary.attendance++;}
    }
    await client.query("insert into tbl_audit_trail(modul_sistem,jenis_aktiviti,penerangan_aktiviti,rekod_terlibat,nilai_baharu,status_aktiviti) values('Demo data','SEED_DEMO_RECORDS',$1,$2,$3,'Berjaya')",[TAG+' Rekod contoh ditambah atas permintaan pemilik projek.',BATCH,JSON.stringify(summary)]);
    await client.query('commit');return {alreadyPresent:false,...summary};
  }catch(error){await client.query('rollback').catch(()=>{});throw error;}finally{client.release();}
}
if(require.main===module){
  const options=dbOptions();const host=options.connectionString?new URL(options.connectionString).hostname:options.host;
  if(process.env.NODE_ENV==='production'||!['localhost','127.0.0.1','::1','[::1]'].includes(host)){console.error('Demo records are restricted to local development PostgreSQL.');process.exitCode=1;}
  else{const pool=require('../config/db');seedDemoRecords(pool).then(summary=>console.log(JSON.stringify(summary,null,2))).catch(error=>{console.error('Demo seed failed:',error.code||error.message);process.exitCode=1;}).finally(()=>pool.end());}
}
module.exports={seedDemoRecords};
