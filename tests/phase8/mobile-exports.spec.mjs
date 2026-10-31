import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const reports=Array.from({length:25},(_,i)=>({id_laporan:i+1,tajuk_laporan:'Laporan '+(i+1),nama_penuh:'Pengawal',nama_pos:'Pos '+(i+1),status_laporan:'Dihantar',tahap_risiko:'Low',tarikh_laporan:'2026-10-31',kandungan_laporan:'Full details stay inside the selected report.'}));
const posts=reports.map((r,i)=>({id_pos:i+1,nama_pos:r.nama_pos,nama_bangunan:i<12?'Bangunan A':'Bangunan B'}));
const stats={cards:{total_laporan:25,risiko_tinggi:3,laporan_berlampiran:15,jadual_hari_ini:8},priority:{laporan_menunggu_semakan:9,laporan_perlu_tindakan:2,tindakan_terbuka:4},latest:reports.slice(0,5),byRisk:[{name:'Low',value:22},{name:'High',value:3}],byCategory:[{name:'Kerosakan Aset',value:25}],trend:[{date:'2026-10-31',laporan:25}],keywords:[]};
async function setup(page,role='Pentadbir Sistem') {
  const requests=[],errors=[];page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(role=>{localStorage.setItem('token','synthetic-mobile');localStorage.setItem('penjaga_user',JSON.stringify({id_pengguna:1,nama_penuh:'Test User',nama_peranan:role}));},role);
  await page.route(url=>url.pathname.startsWith('/api/'),async route=>{
    const url=new URL(route.request().url());requests.push(url);
    if(url.pathname==='/api/meta')return route.fulfill({json:{posts,guards:[],roles:[],categories:[],checklist:[]}});
    if(url.pathname==='/api/notifications/unread-count')return route.fulfill({json:{unread:0}});
    if(url.pathname==='/api/dashboard')return route.fulfill({json:stats});
    if(url.pathname==='/api/reports/export.csv'||url.pathname==='/api/audit'&&url.searchParams.get('format')==='csv')return route.fulfill({contentType:'text/csv',body:'ID,Tajuk\r\n1,Filtered export'});
    if(url.pathname==='/api/reports'){const limit=Number(url.searchParams.get('limit')||8),page=Number(url.searchParams.get('page')||1);return route.fulfill({json:{data:reports.slice((page-1)*limit,page*limit),filters:{posts},meta:{total:25,totalPages:Math.ceil(25/limit)}}});}
    if(url.pathname==='/api/audit')return route.fulfill({json:{data:[],meta:{total:0,totalPages:0}}});
    const week={id_jadual_mingguan:1,tarikh_mula:'2026-10-26',tarikh_tamat:'2026-11-01',status_jadual:'Draf'};
    if(url.pathname==='/api/jadual/mingguan')return route.fulfill({json:[week]});
    if(url.pathname==='/api/jadual/mingguan/1')return route.fulfill({json:week});
    if(url.pathname.endsWith('coverage-summary'))return route.fulfill({json:{totalRequired:25,totalAssigned:0,shortage:25,activeDutyCount:0,absentGuardCount:0,uncoveredPosts:[],coverageByPost:posts.map(p=>({...p,syif:'Pagi',required:1,assigned:0,assignments:[]}))}});
    if(url.pathname==='/api/actions')return route.fulfill({json:reports.map((r,i)=>({...r,id_tindakan:i+1,id_laporan:r.id_laporan,pegawai_bertanggungjawab:'Penyelia',status_tindakan:i%2?'Dalam Tindakan':'Baru',tahap_keutamaan:'High',tindakan_diambil:'Repair requested',progress_notes:[]}))});
    return route.fulfill({json:[]});
  });return {requests,errors};
}
const noOverflow=async page=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
test('phone post browser searches all records, narrows buildings and opens one post',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});const api=await setup(page);await page.goto('/jadual');
  await expect(page.locator('.ops-post-record')).toHaveCount(6);
  await expect(page.getByRole('button',{name:'Tugaskan pengawal sekarang'}).first()).toBeHidden();
  await page.getByLabel('Cari pos atau bangunan').fill('Pos 25');
  await expect(page.locator('.ops-post-record')).toHaveCount(1);
  await page.locator('.ops-post-record > summary').click();await expect(page.getByRole('button',{name:'Tugaskan pengawal sekarang'})).toBeVisible();
  await page.getByLabel('Cari pos atau bangunan').fill('');await page.getByRole('combobox',{name:'Bangunan',exact:true}).selectOption('Bangunan B');
  await expect(page.locator('.ops-post-record > summary').first()).toContainText('Pos 13');
  await page.getByRole('button',{name:'Seterusnya',exact:true}).click();await expect(page.locator('.ops-post-record > summary').first()).toContainText('Pos 19');
  for(const width of [320,768,390]){await page.setViewportSize({width,height:844});await noOverflow(page);}
  await noOverflow(page);await page.screenshot({path:info.outputPath('schedule-mobile.png'),fullPage:true});expect(api.errors).toEqual([]);
});
test('phone follow-ups show six compact summaries and preserve chief permissions',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});const api=await setup(page,'Ketua Pengawal');await page.goto('/tindakan');
  await expect(page.locator('.ops-action-record')).toHaveCount(6);
  await page.getByLabel('Cari tindakan').fill('Laporan 25');await expect(page.locator('.ops-action-record')).toHaveCount(1);
  await page.locator('.ops-action-record > summary').click();await page.getByText('Kemas kini & sejarah',{exact:false}).click();
  await expect(page.getByRole('button',{name:'Hantar progress kepada Admin'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Selesai',exact:true})).toHaveCount(0);
  await noOverflow(page);await page.screenshot({path:info.outputPath('actions-mobile.png'),fullPage:true});expect(api.errors).toEqual([]);
});
for(const [mode,value,from,to] of [['week','2026-12-31','2026-12-28','2027-01-03'],['month','2024-02','2024-02-01','2024-02-29'],['year','2025','2025-01-01','2025-12-31']])test('report CSV '+mode+' uses complete period and keeps report filters',async({page})=>{
  const api=await setup(page);await page.goto('/semakan');await page.getByPlaceholder('Cari tajuk, pengawal, pos').fill('needle');await page.getByRole('button',{name:'CSV',exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.getByRole('combobox',{name:'Tempoh eksport',exact:true}).selectOption(mode);
  await dialog.locator('input').fill(value);const download=page.waitForEvent('download');await dialog.getByRole('button',{name:'Muat turun',exact:true}).click();await download;
  const url=api.requests.find(u=>u.pathname.endsWith('export.csv'));expect(url.searchParams.get('from')).toBe(from);expect(url.searchParams.get('to')).toBe(to);expect(url.searchParams.get('search')).toBe('needle');expect(url.searchParams.get('status')).toBe('Dihantar');
});
test('audit export has the same weekly option and phone layout',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});const api=await setup(page);await page.goto('/audit');await page.getByRole('button',{name:'CSV',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('combobox',{name:'Tempoh eksport',exact:true}).selectOption('week');await dialog.locator('input').fill('2026-12-31');await page.screenshot({path:info.outputPath('export-mobile.png')});await noOverflow(page);
  const download=page.waitForEvent('download');await dialog.getByRole('button',{name:'Muat turun',exact:true}).click();await download;
  const url=api.requests.find(u=>u.searchParams.get('format')==='csv');expect(url.searchParams.get('from')).toBe('2026-12-28');expect(url.searchParams.get('to')).toBe('2027-01-03');
});
for(const role of ['Pentadbir Sistem','Ketua Pengawal'])test(role+' sees concise dashboard before models and can download visual snapshot',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});const api=await setup(page,role);await page.goto('/login');await expect(page).toHaveURL(/dashboard$/);
  await expect(page.getByRole('region',{name:'Dashboard ringkas'})).toBeVisible();
  expect(await page.evaluate(()=>Boolean(document.querySelector('.ops-dashboard-summary').compareDocumentPosition(document.querySelector('.ops-dashboard-model'))&Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await page.getByRole('button',{name:'Muat turun dashboard',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('combobox',{name:'Tempoh eksport',exact:true}).selectOption('month');await dialog.getByLabel('Bulan eksport').fill('2024-02');await dialog.getByRole('combobox',{name:'Format muat turun',exact:true}).selectOption('svg');
  const event=page.waitForEvent('download');await dialog.getByRole('button',{name:'Muat turun',exact:true}).click();const download=await event;expect(download.suggestedFilename()).toBe('penjaga-dashboard.svg');const svg=await fs.readFile(await download.path(),'utf8');expect(svg).toContain('2024-02-01');expect(svg).toContain('2024-02-29');expect(svg).toContain('25');expect(svg).toContain('<svg');
  await noOverflow(page);await page.screenshot({path:info.outputPath('dashboard-mobile.png'),fullPage:true});expect(api.errors).toEqual([]);
});

test('failed exports stay open for retry',async({page})=>{
  await setup(page);await page.goto('/semakan');
  await page.route('**/api/reports/export.csv*',route=>route.fulfill({status:503,json:{message:'Temporary outage'}}));
  await page.getByRole('button',{name:'CSV',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Muat turun',exact:true}).click();
  await expect(dialog.getByText('Eksport gagal. Sila kecilkan tempoh atau cuba lagi.',{exact:true})).toBeVisible();
  await page.unroute('**/api/reports/export.csv*');const download=page.waitForEvent('download');await dialog.getByRole('button',{name:'Muat turun',exact:true}).click();await download;await expect(dialog).not.toBeVisible();
});
test('dashboard CSV includes period and print view hides navigation and model',async({page})=>{
  await setup(page);await page.goto('/dashboard');await page.getByRole('button',{name:'Muat turun dashboard',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('combobox',{name:'Tempoh eksport',exact:true}).selectOption('year');await dialog.locator('input').fill('2025');const event=page.waitForEvent('download');await dialog.getByRole('button',{name:'Muat turun',exact:true}).click();const download=await event;expect(download.suggestedFilename()).toBe('penjaga-dashboard.csv');const csv=await fs.readFile(await download.path(),'utf8');expect(csv).toContain('2025-01-01');expect(csv).toContain('2025-12-31');expect(csv).toContain('25');
  await page.emulateMedia({media:'print'});await expect(page.getByRole('region',{name:'Dashboard ringkas'})).toBeVisible();await expect(page.locator('.workspace-sidebar')).toBeHidden();await expect(page.locator('.ops-dashboard-model')).toBeHidden();
});

test('normal-motion report dialog stays attached to the viewport',async({page})=>{
  await setup(page);await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:390,height:844});
  await page.route('**/api/reports/1',route=>route.fulfill({json:{report:reports[0],analysis:null,analysisJob:{status:'failed'},checklist:[],reviews:[],actions:[]}}));
  await page.goto('/semakan');await page.getByRole('button',{name:'Detail',exact:true}).first().click();const dialog=page.getByRole('dialog',{name:'Dokumen Laporan #1'});await expect(dialog).toBeVisible();const box=await dialog.boundingBox();expect(Math.abs(box.y)).toBeLessThan(2);expect(Math.abs(box.height-844)).toBeLessThan(2);await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
});
