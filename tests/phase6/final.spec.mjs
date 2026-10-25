import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {configureDemo}=require('../../backend/scripts/phase5-demo-config');
configureDemo('penjaga_phase6_demo');
const {Pool}=require('../../backend/node_modules/pg');
const {dbOptions}=require('../../backend/config/dbOptions');
const pool=new Pool(dbOptions());
const password=process.env.PHASE6_DEMO_PASSWORD;
if(!password)throw new Error('Set PHASE6_DEMO_PASSWORD to the synthetic database password.');
const output='docs/psm/evidence';
const tokens={};
const results=[];
test.describe.configure({mode:'serial'});
test.afterAll(async()=>{await pool.end();});
async function call(request,method,path,role,data,expected=200){
  const response=await request[method](`http://127.0.0.1:3098${path}`,{headers:role?{Authorization:`Bearer ${tokens[role]}`}:{},...(data?{data}:{})});
  expect(response.status(),`${method} ${path}: ${await response.text()}`).toBe(expected);
  results.push({method,path,status:response.status()});
  return response;
}
test('P6-01 synthetic final operational workflow and explicit unsupported boundaries',async({request})=>{
  await fs.mkdir(output,{recursive:true});
  expect((await pool.query('select version from phase6_demo_manifest')).rows[0].version).toBe(1);
  for(const role of ['admin','chief','guard_a','guard_b'])tokens[role]=(await (await call(request,'post','/api/auth/login',null,{username:`demo_${role}`,password})).json()).token;
  await call(request,'get','/api/auth/me',null,null,401);
  await call(request,'get','/api/users','guard_a',null,403);
  await call(request,'get','/api/3d/overview','guard_a',null,403);
  await call(request,'post','/api/auth/change-password','guard_a',{currentPassword:password,newPassword:'Only-Synthetic-Change!'},404);
  const day=(await (await call(request,'get','/api/3d/filters','admin')).json()).today;
  // Calendar dates are supplied by PostgreSQL, not Node Date coercion.
  const week=(await pool.query('select id_jadual_mingguan,tarikh_mula::text,tarikh_tamat::text from tbl_jadual_mingguan where current_date between tarikh_mula and tarikh_tamat order by id_jadual_mingguan desc limit 1')).rows[0];
  let assignment=(await pool.query("select * from tbl_jadual_bertugas where catatan='DEMO Phase 6 API workflow' and tarikh_tugas=current_date order by id_jadual limit 1")).rows[0];
  const payload={id_pengguna:3,id_pos:1,tarikh_tugas:day,syif:'Pagi',masa_mula:'09:00',masa_tamat:'17:00',catatan:'DEMO Phase 6 API workflow'};
  if(!assignment)assignment=await (await call(request,'post',`/api/jadual/mingguan/${week.id_jadual_mingguan}/assignments`,'admin',payload,201)).json();
  const conflict=await (await call(request,'post','/api/jadual/check-conflict','chief',payload)).json();expect(conflict.ok).toBe(false);
  await call(request,'post',`/api/jadual/mingguan/${week.id_jadual_mingguan}/assignments`,'chief',payload,409);
  await call(request,'post',`/api/jadual/mingguan/${week.id_jadual_mingguan}/confirm`,'admin');
  await call(request,'post',`/api/jadual/mingguan/${week.id_jadual_mingguan}/lock`,'admin');
  await call(request,'put',`/api/jadual/assignments/${assignment.id_jadual}`,'chief',payload,409);
  await call(request,'post',`/api/jadual/mingguan/${week.id_jadual_mingguan}/unlock`,'admin');
  const coverage=await (await call(request,'get',`/api/jadual/mingguan/${week.id_jadual_mingguan}/coverage-summary`,'admin')).json();
  expect(coverage.totalRequired).toBe(14);expect(Number.isFinite(coverage.shortage)).toBe(true);
  const attendance=(await pool.query('select * from tbl_kehadiran_tugas where id_jadual=$1',[assignment.id_jadual])).rows[0];
  if(!attendance)await call(request,'post',`/api/jadual/assignments/${assignment.id_jadual}/check-in`,'guard_a');
  await call(request,'post',`/api/jadual/assignments/${assignment.id_jadual}/check-in`,'guard_a',null,409);
  if(!attendance?.masa_check_out)await call(request,'post',`/api/jadual/assignments/${assignment.id_jadual}/check-out`,'guard_a');
  await call(request,'post',`/api/jadual/assignments/${assignment.id_jadual}/check-in`,'guard_b',null,404);
  const overnight={id_pengguna:4,id_pos:2,tarikh_tugas:day,syif:'Malam',masa_mula:'23:00',masa_tamat:'07:00',catatan:'DEMO Phase 6 overnight'};
  if(!(await pool.query("select 1 from tbl_jadual_bertugas where catatan='DEMO Phase 6 overnight' and tarikh_tugas=current_date")).rowCount)await call(request,'post',`/api/jadual/mingguan/${week.id_jadual_mingguan}/assignments`,'admin',overnight,201);
  await call(request,'post','/api/reports','guard_a',{id_pos:1,tajuk_laporan:'DEMO invalid checklist',kandungan_laporan:'rondaan',syif:'Pagi',tarikh_laporan:day,masa_laporan:'10:00',checklist:[{id_checklist:1,jawapan:'invalid'}]},400);
  let report=(await pool.query("select * from tbl_laporan_harian where tajuk_laporan='DEMO Phase 6 pencerobohan' and tarikh_laporan=current_date order by id_laporan limit 1")).rows[0];
  if(!report){
    const form={id_pos:'1',tajuk_laporan:'DEMO Phase 6 pencerobohan',kandungan_laporan:'Simulasi pencerobohan di zon sintetik. Tiada insiden sebenar.',syif:'Pagi',tarikh_laporan:day,masa_laporan:'10:00',checklist:JSON.stringify([{id_checklist:1,jawapan:'Ya',catatan:'DEMO sahaja'}]),lampiran_fail:{name:'demo-evidence.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=','base64')}};
    const response=await request.post('http://127.0.0.1:3098/api/reports',{headers:{Authorization:`Bearer ${tokens.guard_a}`},multipart:form});
    expect(response.status(),await response.text()).toBe(201);const saved=await response.json();expect(saved.nlp).toBeNull();expect(saved.analysisJob.status).toBe('pending');report=saved.report;
  }
  await call(request,'post',`/api/reports/${report.id_laporan}/reanalyse`,'admin',{} ,202);
  let completed;
  await expect.poll(async()=>{
    completed=await (await request.get(`http://127.0.0.1:3098/api/reports/${report.id_laporan}/analysis`,{headers:{Authorization:`Bearer ${tokens.guard_a}`}})).json();
    return completed.job?.status;
  },{timeout:30000}).toBe('completed');
  expect(completed.analysis.metadata.eventStatus).toBe('drill');
  expect(completed.analysis.metadata.baseline.riskLevel).toBe('High');
  expect(completed.analysis.metadata.review.status).toBe('unavailable');
  const detail=await (await call(request,'get',`/api/reports/${report.id_laporan}`,'guard_a')).json();expect(detail.checklist).toHaveLength(1);
  await call(request,'get',`/api/reports/${report.id_laporan}`,'guard_b',null,403);
  const upload=JSON.parse(detail.report.lampiran_fail)[0];await call(request,'get',upload,null,null,401);await call(request,'get',upload,'guard_b',null,404);await call(request,'get',upload,'guard_a');
  await call(request,'patch',`/api/reports/${report.id_laporan}/review`,'admin',{status:'approved'},403);
  if(detail.report.status_laporan==='Dihantar')await call(request,'patch',`/api/reports/${report.id_laporan}/review`,'chief',{status:'approved',comment:'Semakan sintetik',requiresFollowUp:true});
  let action=(await pool.query('select * from tbl_tindakan_susulan where id_laporan=$1',[report.id_laporan])).rows[0];
  if(!action)action=await (await call(request,'post','/api/actions','admin',{id_laporan:report.id_laporan,pegawai_bertanggungjawab:'DEMO Admin',tindakan_diambil:'Semakan keselamatan sintetik',tahap_keutamaan:'High'},201)).json();
  await call(request,'patch',`/api/actions/${action.id_tindakan}`,'admin',{status_tindakan:'Dalam Tindakan',catatan_tindakan:'DEMO sahaja'});
  if(!(await pool.query('select 1 from tbl_progress_tindakan where id_tindakan=$1',[action.id_tindakan])).rowCount)await call(request,'post',`/api/actions/${action.id_tindakan}/progress`,'chief',{catatan_progress:'DEMO Semakan pintu selesai'},201);
  const notices=await (await call(request,'get','/api/notifications','chief')).json();expect(notices.length).toBeGreaterThan(0);
  await call(request,'patch',`/api/notifications/${notices[0].id_notifikasi}/read`,'chief');
  const summary=await (await call(request,'get',`/api/3d/locations/1/summary?date=${day}&from=${day}&to=${day}`,'admin')).json();expect(summary.linked).toBe(true);expect(summary.reports.some(r=>r.id_laporan===report.id_laporan)).toBe(true);
  const analysis=await (await call(request,'get',`/api/nlp/analysis/${report.id_laporan}`,'admin')).json();expect(analysis.metadata.eventStatus).toBe('drill');
  const model=JSON.parse(await fs.readFile('backend/ml/model/nlp-model.json','utf8'));expect(model.weights).toBeUndefined();
  const privateFile=await request.get('/.phase6-build.local/slides.json');expect(privateFile.status()).toBe(403);
  await fs.writeFile(`${output}/phase6-workflow-results.json`,JSON.stringify({date:new Date().toISOString(),database:'penjaga_phase6_demo',checks:results,limitations:['Password change endpoint missing (404 confirmed)','Attendance is restricted to assignments dated current_date','Saved Naive Bayes artifact has no runtime weights'],applicationProducedReportId:report.id_laporan},null,2)+'\n');
});
async function login(page,user){
  await page.goto('/login');await page.getByLabel('Nama pengguna').fill(`demo_${user}`);await page.getByLabel('Kata laluan',{exact:true}).fill(password);await page.getByRole('button',{name:'Log Masuk',exact:true}).click();await expect(page).toHaveURL(user.startsWith('guard')?/pengawal$/:/dashboard$/);
}
test('P6-02 actual synthetic application screenshots',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  const capture=async(name)=>{
    const buffer=await page.screenshot({fullPage:true});
    for(let attempt=0;attempt<4;attempt++){
      try{await fs.writeFile(`${output}/${name}.png`,buffer);return;}
      catch(error){if(attempt===3)throw error;await new Promise(resolve=>setTimeout(resolve,250));}
    }
  };
  await page.goto('/login');await capture('01-login');await login(page,'admin');await expect(page.getByRole('heading',{name:/Dashboard/}).first()).toBeVisible();await capture('02-admin-dashboard');
  for(const [route,name]of [['/jadual','04-schedule-management'],['/nlp','07-nlp-categories'],['/tindakan','08-follow-up-actions'],['/pengguna','09-user-management']]){
    await page.goto(route);await expect(page.locator('main')).toBeVisible();await page.waitForLoadState('networkidle');await capture(name);
    if(route==='/nlp'){
      await page.getByRole('button',{name:'Buka ringkasan',exact:true}).first().click();
      await expect(page.getByText('Skor keutamaan',{exact:true}).first()).toBeVisible();
      await capture('16-stored-nlp-analysis');
    }
  }
  await page.goto('/3d-command-centre');await expect(page.locator('canvas')).toBeVisible();await capture('10-3d-overview');
  await page.getByRole('button',{name:/01.*Pos Lobi Utama/}).click();await expect(page.getByRole('heading',{name:'Pos Lobi Utama',exact:true})).toBeVisible();await capture('11-selected-hotspot');
  await page.locator('.building-canvas').screenshot({path:`${output}/17-building-canvas.png`});
  await page.getByLabel('Panel lokasi',{exact:true}).screenshot({path:`${output}/12-information-panel.png`});
  await page.getByLabel('Paparan operasi').selectOption('incidents');await capture('13-incident-mode');
  await page.getByLabel('Pos keselamatan bangunan').selectOption('POST_DJM_MAIN_LOBBY');await capture('14-zone-navigation');
  await page.getByRole('region',{name:'Sejarah laporan'}).screenshot({path:`${output}/15-incident-history.png`});
  await page.getByRole('button',{name:'Logout',exact:true}).click();await login(page,'guard_a');await capture('03-guard-dashboard');
  await page.goto('/jadual');await page.waitForLoadState('networkidle');await capture('05-attendance');
  await page.goto('/laporan');await page.waitForLoadState('networkidle');await capture('06-report-submission');
});
