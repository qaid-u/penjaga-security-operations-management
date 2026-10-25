import { test, expect } from '@playwright/test';
import { mockOperations } from './operations-fixture.mjs';
async function login(page, role='Pentadbir Sistem') {
  await page.addInitScript((nama_peranan)=>localStorage.setItem('penjaga_user',JSON.stringify({id_pengguna:1,nama_peranan,nama_penuh:'Ujian Tempatan'})),role);
  await page.emulateMedia({reducedMotion:'reduce'});
}
const entrance = (page)=>page.getByRole('button',{name:/01.*Pos Lobi Utama/});
const left = (page)=>page.getByRole('button',{name:/03.*Pos Tingkat 3 Pejabat Setiausaha Kerajaan Johor/});

test('API-driven panel, missing fields, separate indicators, manual refresh and date parameters',async({page})=>{
  const fixture=await mockOperations(page,{linked:true,delayFirst:700}); await login(page); await page.goto('/3d-command-centre');
  await expect(entrance(page)).toBeVisible();
  expect(fixture.requests.filter((r)=>r.url.endsWith('/summary'))).toHaveLength(0);
  await entrance(page).click(); await expect(page.getByText('Memuatkan ringkasan lokasi...')).toBeVisible();
  await expect(page.getByLabel('Panel lokasi').getByText('Pos Ujian API',{exact:true})).toBeVisible();
  await expect(page.getByText('Pengawal Ujian API',{exact:true})).toBeVisible();
  await expect(page.getByText('Laporan Ujian API',{exact:true})).toBeVisible();
  await expect(page.getByText(/Status pos: Aktif/)).toContainText('Maklumat tidak tersedia');
  await expect(page.getByRole('link',{name:'Lihat Jadual',exact:true})).toHaveAttribute('href','/jadual');
  await expect(page.getByRole('link',{name:'Lihat Laporan',exact:true})).toHaveAttribute('href','/semakan');
  await page.getByLabel('Paparan operasi').selectOption('incidents');
  await expect(entrance(page)).toContainText('Klasifikasi tertinggi: High');
  await page.getByLabel('Paparan operasi').selectOption('attendance');
  await expect(entrance(page)).toContainText('1 daftar masuk');
  const count=fixture.requests.filter((r)=>r.url.endsWith('/summary')).length;
  await page.getByRole('button',{name:'Muat semula data',exact:true}).click();
  await expect.poll(()=>fixture.requests.filter((r)=>r.url.endsWith('/summary')).length).toBeGreaterThan(count);
  await page.getByLabel('Tarikh tugas (MYT)').fill('2026-10-23');
  await expect.poll(()=>fixture.requests.some((r)=>r.url.endsWith('/summary') && r.params.includes('date=2026-10-23'))).toBe(true);
});
test('rapid hotspot switching does not display a late response for the previous location',async({page})=>{
  await mockOperations(page,{linked:true,delayFirst:1800}); await login(page); await page.goto('/3d-command-centre');
  await entrance(page).click(); await expect(page.getByText('Memuatkan ringkasan lokasi...')).toBeVisible();
  await left(page).click(); await expect(page.getByRole('heading',{name:'Pos Tingkat 3 Pejabat Setiausaha Kerajaan Johor',exact:true})).toBeVisible();
  await expect(page.getByText(/Tiada rekod operasi dipautkan/)).toBeVisible();
  await page.waitForTimeout(2000); // Let the old server response arrive after selection changed.
  await expect(page.getByLabel('Panel lokasi').getByText('Pos Ujian API',{exact:true})).toHaveCount(0);
  await expect(page.locator('.building-hotspot')).toHaveCount(0);
});
test('API failure is recoverable without remounting or hiding the model',async({page})=>{
  const fixture=await mockOperations(page,{linked:true,failSummary:true}); await login(page); await page.goto('/3d-command-centre');
  await entrance(page).click(); await expect(page.getByRole('alert')).toContainText('Ralat ujian sementara');
  await expect(page.locator('canvas')).toBeVisible(); await page.getByRole('button',{name:'Zum masuk',exact:true}).click();
  fixture.recover(); await page.getByRole('button',{name:'Cuba semula lokasi'}).click();
  await expect(page.getByLabel('Panel lokasi').getByText('Pos Ujian API',{exact:true})).toBeVisible();
});
test('administrator can link/unlink existing posts and refresh summary; chief cannot see mapping UI',async({page})=>{
  const fixture=await mockOperations(page); await login(page); await page.route('**/api/posts',(route)=>route.fulfill({json:[
    {id_pos:91,nama_pos:'Pos Lobi Utama',status_pos:'Aktif',nama_bangunan:'Bangunan Dato’ Jaafar Muhammad'},
    {id_pos:92,nama_pos:'Pos Lobi Utama',status_pos:'Aktif',nama_bangunan:'Other building'},
    {id_pos:93,nama_pos:'Pos Bilik Kawalan CCTV',status_pos:'Aktif',nama_bangunan:'Bangunan Dato’ Jaafar Muhammad'}
  ]}));
  await page.goto('/3d-command-centre'); await entrance(page).click(); await expect(page.getByText(/Tiada rekod operasi dipautkan/)).toBeVisible();
  await page.getByText('Pemetaan lokasi — Pentadbir Sistem',{exact:true}).click();
  const select=page.getByLabel('Pautan Pos Lobi Utama',{exact:true});
  await expect(select.locator('option')).toHaveCount(2);
  await expect(select.locator('option[value="92"], option[value="93"]')).toHaveCount(0);
  await select.selectOption('91');
  await select.locator('..').getByRole('button',{name:'Simpan pautan'}).click();
  await expect(page.getByLabel('Panel lokasi').getByText('Pos Ujian API',{exact:true})).toBeVisible();
  await select.selectOption(''); await select.locator('..').getByRole('button',{name:'Simpan pautan'}).click();
  await expect(page.getByText(/Tiada rekod operasi dipautkan/)).toBeVisible();
  expect(fixture.requests.filter((r)=>r.method==='PATCH')).toHaveLength(2);
});
test('chief reads operational data without mapping controls; overview errors leave canvas usable',async({page})=>{
  await mockOperations(page,{linked:true}); await login(page,'Ketua Pengawal'); await page.goto('/3d-command-centre');
  await entrance(page).click(); await expect(page.getByLabel('Panel lokasi').getByText('Pos Ujian API',{exact:true})).toBeVisible();
  await expect(page.getByText('Pemetaan lokasi — Pentadbir Sistem',{exact:true})).toHaveCount(0);
  await page.route('**/api/3d/overview?**',(route)=>route.fulfill({status:503,json:{message:'Data sementara tidak tersedia'}}));
  await page.getByRole('button',{name:'Muat semula data',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Snapshot terdahulu mungkin lapuk');
  await expect(page.locator('canvas')).toBeVisible(); await expect(entrance(page)).toContainText('Data tidak tersedia');
});
test('expired authentication redirects through the existing Axios interceptor',async({page})=>{
  await login(page); await page.route('**/api/3d/**',(route)=>route.fulfill({status:401,json:{message:'Sesi tamat'}}));
  // Seed auth once; a full redirect must not restore the expired identity.
  await page.addInitScript(()=>{if(sessionStorage.getItem('visited'))localStorage.clear();else sessionStorage.setItem('visited','1');});
  await page.goto('/3d-command-centre'); await expect(page).toHaveURL(/\/login$/);
});
