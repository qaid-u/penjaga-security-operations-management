import { test, expect } from '@playwright/test';

const report = { id_laporan: 42, tajuk_laporan: 'Pemeriksaan pintu masuk utama', kandungan_laporan: 'Pintu masuk diperiksa. Kerosakan kunci telah dimaklumkan kepada penyelia.', nama_pos: 'Pos Pintu Utama', nama_penuh: 'Ahmad bin Ali', syif: 'Pagi', tarikh_laporan: '2026-10-29', masa_laporan: '09:30', tahap_risiko: 'High', status_laporan: 'Dihantar' };
const weeks = [{id_jadual_mingguan: 1, tarikh_mula:'2026-10-26',tarikh_tamat:'2026-11-01',status_jadual:'Draf'}, {id_jadual_mingguan:2,tarikh_mula:'2026-11-02',tarikh_tamat:'2026-11-08',status_jadual:'Disahkan'}];
async function setup(page, role='Pentadbir Sistem') {
  await page.emulateMedia({reducedMotion:'reduce'});
  const requests=[];
  const errors=[];
  page.on('pageerror', error=>errors.push(error.message));
  await page.addInitScript(role=>{localStorage.setItem('token','synthetic-ui-token');localStorage.setItem('penjaga_user', JSON.stringify({id_pengguna:1,nama_penuh:'Nur Aina Abdullah',nama_peranan:role}));},role);
  await page.route(url=>url.pathname.startsWith('/api/'),async route=>{
    const url=new URL(route.request().url());
    requests.push({path:url.pathname,body:route.request().postData()});
    const json = data=>route.fulfill({json:data});
    if(url.pathname==='/api/meta') return json({posts:[{id_pos:1,nama_pos:'Pos Pintu Utama'}],guards:[],checklist:[],categories:[]});
    if(url.pathname==='/api/dashboard') return json({cards:{total_laporan:38,risiko_tinggi:4,jadual_hari_ini:12,laporan_berlampiran:20},priority:{laporan_menunggu_semakan:6,laporan_kritikal_menunggu:2,laporan_perlu_tindakan:3,tindakan_terbuka:5,permintaan_kemaskini_ketua:2,notifikasi_belum_dibaca:4},latest:[report,{...report,id_laporan:43,tajuk_laporan:'Rondaan kawasan parkir',nama_pos:'Pos Parkir',tahap_risiko:'Low'},{...report,id_laporan:44,tajuk_laporan:'Semakan peralatan keselamatan',tahap_risiko:'Medium'}],byCategory:[{name:'Kerosakan',value:4}],byRisk:[{name:'High',value:4},{name:'Low',value:34}],trend:[{date:'2026-10-28',laporan:4},{date:'2026-10-29',laporan:7}],keywords:[{keyword:'pintu',value:3}]});
    if(url.pathname==='/api/dashboard/guard') return json({today:{tugasan_hari_ini:1,laporan_dihantar:0},duty:[{id_jadual:1,nama_pos:'Pos Pintu Utama',tarikh_tugas:'2026-10-29',syif:'Pagi',masa_mula:'07:00',masa_tamat:'16:00',status_kehadiran:'Belum Hadir'}]});
    if(url.pathname==='/api/reports') return json({data:[report],filters:{posts:[{id_pos:1,nama_pos:'Pos Pintu Utama'}]},meta:{total:1,totalPages:1}});
    if(url.pathname==='/api/reports/42') return json({report,analysis:null,analysisJob:{status:'failed'},checklist:[],reviews:[],actions:[]});
    if(url.pathname==='/api/reports/42/analysis') return json({analysis:null,job:{status:'failed'}});
    if(url.pathname==='/api/reports/42/review') return json({});
    if(url.pathname==='/api/jadual/mingguan') return json(weeks);
    if(/\/api\/jadual\/mingguan\/\d+$/.test(url.pathname)) return json(weeks.find(week=>url.pathname.endsWith(`/${week.id_jadual_mingguan}`)));
    if(url.pathname.endsWith('/coverage-summary')) return json({totalRequired:2,totalAssigned:1,shortage:1,activeDutyCount:1,absentGuardCount:0,uncoveredPosts:[],coverageByPost:[{id_pos:1,nama_pos:'Pos Pintu Utama',syif:'Pagi',required:2,assigned:1,assignments:[]}]});
    if(url.pathname==='/api/actions') return json([{id_tindakan:1,id_laporan:42,tajuk_laporan:report.tajuk_laporan,nama_pos:report.nama_pos,tahap_keutamaan:'High',status_tindakan:'Baru',tindakan_diambil:'Baiki kunci pintu utama',pegawai_bertanggungjawab:'Penyelia',progress_notes:[]}]);
    return json([]);
  });
  return {requests,errors};
}
async function noOverflow(page) { expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true); }

test('desktop dashboard prioritizes daily work and keeps analytics accessible',async({page},testInfo)=>{
  const {errors}=await setup(page);
  await page.goto('/dashboard');
  await expect(page.getByRole('heading',{name:'Ringkasan operasi'})).toBeVisible();
  await expect(page.locator('.workspace-metrics > a')).toHaveCount(3);
  await expect(page.getByRole('link',{name:'Pengguna',exact:true})).toBeHidden();
  await expect(page.getByRole('heading',{name:'Kategori insiden'})).toHaveCount(0);
  await page.locator('.ops-dashboard-latest > summary').click();
  await expect(page.getByRole('heading',{name:'Laporan terkini'})).toBeVisible();
  await noOverflow(page);
  await page.screenshot({path:testInfo.outputPath('dashboard-desktop.png'),fullPage:true});
  await page.getByRole('button',{name:'Statistik & trend'}).click();
  await expect(page.getByRole('heading',{name:'Kategori insiden'})).toBeVisible();
  await page.locator('.workspace-management > summary').click();
  await expect(page.getByRole('link',{name:'Pengguna',exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});

test('phone navigation opens, traps focus, closes with Escape and navigates',async({page},testInfo)=>{
  await page.setViewportSize({width:390,height:844});
  const {errors}=await setup(page);
  await page.goto('/dashboard');
  await expect(page.locator('.ops-dashboard-latest > summary')).toBeVisible();
  await noOverflow(page);
  await page.screenshot({path:testInfo.outputPath('dashboard-phone.png'),fullPage:true});
  await page.getByRole('button',{name:'Buka menu penuh'}).click();
  const drawer=page.getByRole('dialog',{name:'Menu utama'});
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('button',{name:'Tutup menu',exact:true})).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(drawer.getByRole('button',{name:'Logout'})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Buka menu penuh'})).toBeFocused();
  await page.getByRole('navigation',{name:'Navigasi mudah alih'}).getByRole('link',{name:'Laporan'}).click();
  await expect(page.getByRole('heading',{name:'Pemantauan laporan'})).toBeVisible();
  await noOverflow(page);
  await page.screenshot({path:testInfo.outputPath('reports-phone.png'),fullPage:true});
  expect(errors).toEqual([]);
});

test('chief reviews inside a report and must explicitly choose follow-up before approval',async({page},testInfo)=>{
  const api=await setup(page,'Ketua Pengawal');
  await page.goto('/semakan');
  await expect(page.getByRole('button',{name:'Lulus',exact:true})).toHaveCount(0);
  await expect(page.getByLabel('Pos kawalan',{exact:true})).toBeHidden();
  await page.getByRole('button',{name:'Detail',exact:true}).click();
  const detail=page.getByRole('dialog',{name:'Dokumen Laporan #42'});
  await expect(detail).toBeVisible();
  await detail.getByRole('button',{name:'Lulus',exact:true}).click();
  await expect(page.getByText('Sila tentukan sama ada laporan ini memerlukan tindakan susulan atau tidak.',{exact:true})).toBeVisible();
  expect(api.requests.filter(r=>r.path.endsWith('/review'))).toHaveLength(0);
  await detail.getByLabel('Perlu tindakan susulan',{exact:true}).check();
  await detail.getByLabel('Catatan semakan').fill('Sila baiki kunci.');
  await page.screenshot({path:testInfo.outputPath('report-decision.png')});
  await detail.getByRole('button',{name:'Lulus',exact:true}).click();
  const confirmation=page.getByRole('dialog',{name:'Luluskan laporan?'});
  await expect(confirmation.getByRole('button',{name:'Batal'})).toBeFocused();
  await confirmation.getByRole('button',{name:'Luluskan',exact:true}).click();
  await expect.poll(()=>api.requests.filter(r=>r.path.endsWith('/review')).length).toBe(1);
  expect(JSON.parse(api.requests.find(r=>r.path.endsWith('/review')).body)).toEqual({status:'approved',comment:'Sila baiki kunci.',requiresFollowUp:true});
  await expect(confirmation).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(detail).toHaveCount(0);
  expect(api.errors).toEqual([]);
});

test('admin can read reports without chief approval controls',async({page})=>{
  await setup(page);
  await page.goto('/semakan?report=42');
  await expect(page.getByRole('dialog',{name:'Dokumen Laporan #42'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Lulus',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Tolak',exact:true})).toHaveCount(0);
});

test('schedule separates settings from coverage and can change weeks',async({page},testInfo)=>{
  const {errors}=await setup(page);
  await page.goto('/jadual');
  await page.locator('.ops-coverage-disclosure > summary').click();
  await expect(page.getByRole('heading',{name:'Ringkasan Liputan'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Tetapan Keperluan Pos'})).toHaveCount(0);
  await page.getByLabel('Minggu jadual').selectOption('2');
  await expect(page.getByLabel('Minggu jadual')).toHaveValue('2');
  await expect(page.getByLabel('Tarikh tugasan')).toHaveValue('2026-11-02');
  await page.screenshot({path:testInfo.outputPath('schedule-desktop.png'),fullPage:true});
  await page.getByRole('button',{name:'Tetapan & import'}).click();
  await expect(page.getByRole('heading',{name:'Tetapan Keperluan Pos'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Import CSV'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Ringkasan Liputan'})).toHaveCount(0);
  for(const width of [768,390]) {await page.setViewportSize({width,height:900});await noOverflow(page);}
  expect(errors).toEqual([]);
});

test('follow-up forms are disclosed on demand and guard navigation stays role-specific',async({page})=>{
  await setup(page);
  await page.goto('/tindakan');
  await expect(page.getByRole('button',{name:'Simpan tindakan'})).toBeHidden();
  await expect(page.getByRole('button',{name:'Minta kemaskini',exact:true})).toBeHidden();
  await page.locator('.ops-action-record > summary').first().click();
  await page.getByText('Kemas kini & sejarah',{exact:false}).click();
  await expect(page.getByRole('button',{name:'Minta kemaskini',exact:true})).toBeVisible();
  await page.getByText('Tambah tindakan baharu',{exact:false}).click();
  await expect(page.getByRole('button',{name:'Simpan tindakan'})).toBeVisible();
});

test('guard home has two clear tasks and no management navigation',async({page},testInfo)=>{
  const {errors}=await setup(page,'Pengawal Keselamatan');
  await page.setViewportSize({width:390,height:844});
  await page.goto('/pengawal');
  await expect(page.getByRole('heading',{name:'Tugasan saya'})).toBeVisible();
  await expect(page.locator('.workspace-metric')).toHaveCount(2);
  await expect(page.getByRole('link',{name:'Pengguna',exact:true})).toHaveCount(0);
  await noOverflow(page);
  await page.screenshot({path:testInfo.outputPath('guard-phone.png'),fullPage:true});
  expect(errors).toEqual([]);
});

test('guard can switch between report writing and history without losing a draft',async({page})=>{
  await setup(page,'Pengawal Keselamatan');
  await page.goto('/laporan');
  await page.getByLabel('Tajuk laporan',{exact:true}).fill('Draf rondaan');
  await page.getByRole('button',{name:'Laporan saya',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Laporan Saya',exact:true})).toBeVisible();
  await expect(page.getByLabel('Tajuk laporan',{exact:true})).toBeHidden();
  await page.getByRole('button',{name:'Buka laporan',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Dokumen Laporan #42'})).toBeVisible();
  await page.getByRole('button',{name:'Tutup',exact:true}).click();
  await page.getByRole('button',{name:'Tulis laporan',exact:true}).click();
  await expect(page.getByLabel('Tajuk laporan',{exact:true})).toHaveValue('Draf rondaan');
});
