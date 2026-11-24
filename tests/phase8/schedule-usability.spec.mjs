import { test, expect } from '@playwright/test';

const week = { id_jadual_mingguan: 1, tarikh_mula: '2026-11-02', tarikh_tamat: '2026-11-08', status_jadual: 'Draf' };
const posts = Array.from({length: 25}, (_,index) => ({id_pos:index+1,nama_pos:'Pos '+String(index+1).padStart(2,'0'),nama_bangunan:index<12?'Bangunan A':'Bangunan B'}));
const guards = [{id_pengguna:3,nama_penuh:'Ahmad bin Ali',nama_pengguna:'ahmad'},{id_pengguna:4,nama_penuh:'Nur Aina Abdullah',nama_pengguna:'aina'}];
async function setup(page,{role='Pentadbir Sistem',locked=false,conflict=false}={}) {
  const saves=[],dates=[],errors=[];let saved;
  page.on('pageerror',error=>errors.push(error.message));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(role=>{localStorage.setItem('token','synthetic-schedule-test');localStorage.setItem('penjaga_user',JSON.stringify({id_pengguna:1,nama_penuh:'Test User',nama_peranan:role}));},role);
  await page.route(url=>url.pathname.startsWith('/api/'),async route=>{
    const url=new URL(route.request().url()), data=body=>route.fulfill({json:body});
    if(url.pathname==='/api/meta')return data({posts,guards,categories:[],checklist:[]});
    if(url.pathname==='/api/notifications/unread-count')return data({unread:0});
    if(url.pathname==='/api/jadual/mingguan')return data([{...week,status_jadual:locked?'Dikunci':'Draf'}]);
    if(url.pathname==='/api/jadual/mingguan/1')return data({...week,status_jadual:locked?'Dikunci':'Draf'});
    if(url.pathname.endsWith('/coverage-summary')) {
      const date=url.searchParams.get('date');dates.push(date);
      const coverageByPost=posts.flatMap(post=>['Pagi','Petang','Malam'].map(syif=>{
        const assigned=saved && String(saved.id_pos)===String(post.id_pos) && saved.syif===syif && saved.tarikh_tugas===date;
        return {...post,syif,required:1,assigned:assigned||post.id_pos===1?1:0,assignments:assigned?[{...saved,id_jadual:99,nama_penuh:guards.find(g=>String(g.id_pengguna)===String(saved.id_pengguna)).nama_penuh,status_bertugas:'Dijadualkan'}]:[]};
      }));
      const extra=saved && saved.syif==='Office Hour'?[{...saved,id_jadual:99,nama_pos:posts.find(p=>String(p.id_pos)===String(saved.id_pos)).nama_pos,nama_penuh:guards.find(g=>String(g.id_pengguna)===String(saved.id_pengguna)).nama_penuh,status_bertugas:'Dijadualkan'}]:[];
      return data({coverageByPost,coverage:extra,totalRequired:75,totalAssigned:3+(saved?1:0),shortage:72-(saved?1:0),activeDutyCount:2,absentGuardCount:0,uncoveredPosts:[]});
    }
    if(url.pathname==='/api/jadual/check-conflict')return data({ok:!conflict,critical:conflict?['Pengawal mempunyai pertindihan masa.']:[],warnings:[]});
    if(url.pathname.endsWith('/assignments')&&route.request().method()==='POST'){saved=route.request().postDataJSON();saves.push(saved);return data({...saved,id_jadual:99});}
    return data([]);
  });
  return {saves,dates,errors};
}

test('one post groups all shifts; search and coverage filters keep completed posts discoverable',async({page},info)=>{
  const api=await setup(page);await page.goto('/jadual');
  await expect(page.locator('.ops-post-record')).toHaveCount(6);
  await expect(page.locator('.schedule-post-record').first()).toContainText('Pos 01');
  await expect(page.locator('.schedule-post-record').first().locator('summary')).toContainText('3 syif');
  await page.locator('.schedule-post-record').first().locator('summary').click();
  await expect(page.locator('.schedule-post-record').first().locator('.schedule-shift')).toHaveCount(3);
  await page.getByRole('button',{name:'Perlu pengawal',exact:true}).click();
  await expect(page.locator('.schedule-post-record').first().locator('summary')).toContainText('Pos 02');
  await page.getByRole('button',{name:'Lengkap',exact:true}).click();
  await expect(page.locator('.schedule-post-record')).toHaveCount(1);
  await expect(page.locator('.schedule-post-record > summary')).toContainText('Pos 01');
  await page.getByRole('button',{name:'Semua pos',exact:true}).click();
  await page.getByLabel('Cari pos atau bangunan').fill('Pos 25');
  await expect(page.locator('.schedule-post-record')).toHaveCount(1);
  await page.locator('.schedule-post-record > summary').click();
  await page.screenshot({path:info.outputPath('schedule-desktop.png'),fullPage:true});
  expect(api.errors).toEqual([]);
});

test('phone assignment keeps selected day/post/shift and saves after automatic conflict check',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});const api=await setup(page);await page.goto('/jadual');
  await page.getByRole('button',{name:'Rabu, 4 November',exact:true}).click();
  await expect.poll(()=>api.dates.at(-1)).toBe('2026-11-04');
  await page.getByLabel('Cari pos atau bangunan').fill('Pos 25');await page.locator('.schedule-post-record > summary').click();
  await page.getByRole('region',{name:'Pos 25 · Malam'}).getByRole('button',{name:'Tugaskan pengawal',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Pilih pengawal'});
  await expect(dialog).toContainText('4 November 2026');await expect(dialog).toContainText('Malam · 23:00 – 08:00 (esok)');
  await expect(dialog.getByRole('button',{name:'Simpan tugasan'})).toBeDisabled();
  const box=await dialog.boundingBox();expect(Math.abs(box.y+box.height-844)).toBeLessThan(2);
  await dialog.getByLabel('Cari pengawal').fill('aina');await dialog.getByRole('radio',{name:'Nur Aina Abdullah aina'}).check();
  await page.screenshot({path:info.outputPath('assignment-mobile.png')});
  await dialog.getByRole('button',{name:'Simpan tugasan'}).click();
  await expect(dialog).toHaveCount(0);expect(api.saves).toHaveLength(1);
  expect(api.saves[0]).toMatchObject({tarikh_tugas:'2026-11-04',syif:'Malam',id_pos:25,id_pengguna:4,masa_mula:'23:00',masa_tamat:'08:00'});
  await expect(page.getByText('Nur Aina Abdullah',{exact:true})).toBeVisible();
  for(const width of [320,390,768]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:info.outputPath('schedule-mobile.png'),fullPage:true});expect(api.errors).toEqual([]);
});

test('conflicts prevent saving and locked chief schedules explain disabled controls',async({page})=>{
  const api=await setup(page,{conflict:true});await page.goto('/jadual');await page.locator('.schedule-post-record > summary').nth(1).click();
  await page.getByRole('button',{name:'Tugaskan pengawal',exact:true}).first().click();
  const dialog=page.getByRole('dialog');await dialog.getByRole('radio',{name:'Ahmad bin Ali ahmad'}).check();await dialog.getByRole('button',{name:'Simpan tugasan'}).click();
  await expect(dialog.getByText('Pengawal mempunyai pertindihan masa.',{exact:true})).toBeVisible();expect(api.saves).toHaveLength(0);
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);expect(api.errors).toEqual([]);
  await page.unrouteAll();await setup(page,{role:'Ketua Pengawal',locked:true});await page.reload();
  await expect(page.getByText('Jadual dikunci. Anda boleh menyemak tugasan.',{exact:false})).toBeVisible();
  await page.locator('.schedule-post-record > summary').nth(1).click();
  await expect(page.getByRole('button',{name:'Tugaskan pengawal',exact:true}).first()).toBeDisabled();
});

test('phone weekly gaps open the shortage filter and copying saves only the selected rows', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, { role: 'Ketua Pengawal' });
  const weekTwo = { ...week, id_jadual_mingguan: 2, tarikh_mula: '2026-11-09', tarikh_tamat: '2026-11-15' };
  const copyRequests = [];
  await page.route('**/coverage-summary?overview=week', route => route.fulfill({
    json: { hasRequirements: true, days: [{ date: '2026-11-04', shortage: 72 }] },
  }));
  await page.route('**/jadual/mingguan/2', route => route.fulfill({ json: weekTwo }));
  await page.route('**/jadual/mingguan', route => route.fulfill({
    json: copyRequests.length ? [weekTwo, week] : [week],
  }));
  await page.route('**/jadual/mingguan/1/copy-next', route => {
    if (route.request().method() === 'POST') {
      copyRequests.push(route.request().postDataJSON());
      return route.fulfill({ status: 201, json: { id: 2, start: '2026-11-09', copied: 1 } });
    }
    const common = { active: true, syif: 'Pagi', nama_penuh: 'Ahmad bin Ali', tarikh_tugas: '2026-11-09', masa_mula: '07:00', masa_tamat: '16:00' };
    return route.fulfill({ json: {
      start: weekTwo.tarikh_mula, end: weekTwo.tarikh_tamat, version: 'reviewed',
      rows: [{ ...common, id_jadual: 10, nama_pos: 'Pos 01' }, { ...common, id_jadual: 11, nama_pos: 'Pos 02' }],
    } });
  });
  await page.goto('/jadual');
  const day = page.getByRole('button', { name: 'Rabu, 4 November', exact: true });
  await expect(day).toContainText('72 kosong');
  await day.click();
  await expect(page.getByRole('button', { name: 'Perlu pengawal', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Salin ke minggu depan' }).click();
  const dialog = page.getByRole('dialog', { name: 'Salin ke minggu depan' });
  await dialog.getByRole('checkbox', { name: /Pos 02/ }).uncheck();
  await expect(dialog.getByRole('status')).toContainText('1 dipilih');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await dialog.getByRole('button', { name: 'Simpan sebagai draf' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel('Minggu jadual')).toHaveValue('2');
  expect(copyRequests).toEqual([{ ids: [10], version: 'reviewed' }]);
});

test('phone daily fill saves guards from multiple posts without losing filtered selections', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, { role: 'Ketua Pengawal' });
  const requests = [];
  await page.route('**/jadual/mingguan/1/daily-assignments', route => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ status: 201, json: { created: 2 } });
  });
  await page.goto('/jadual');
  await page.getByRole('button', { name: 'Rabu, 4 November', exact: true }).click();
  await page.getByRole('button', { name: 'Isi kekosongan harian' }).click();
  const dialog = page.getByRole('dialog', { name: 'Isi kekosongan harian' });
  const search = dialog.getByRole('searchbox');
  await search.fill('Pos 02 Pagi');
  await dialog.getByRole('region', { name: 'Pos 02 · Pagi' }).getByRole('combobox').selectOption('3');
  await search.fill('Pos 03 Pagi');
  await expect(dialog.getByRole('option', { name: /Ahmad bin Ali/ })).toHaveAttribute('disabled', '');
  await dialog.getByRole('region', { name: 'Pos 03 · Pagi' }).getByRole('combobox').selectOption('4');
  await dialog.getByRole('button', { name: 'Simpan 2 tugasan' }).click();
  await expect(dialog).toHaveCount(0);
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({
    date: '2026-11-04', assignments: [
      { id_pos: 2, id_pengguna: 3, syif: 'Pagi' },
      { id_pos: 3, id_pengguna: 4, syif: 'Pagi' },
    ],
  });
});

test('manual assignments without a minimum requirement remain visible and editable',async({page})=>{
  const api=await setup(page);await page.goto('/jadual');await page.getByRole('button',{name:'Tambah tugasan',exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.getByRole('combobox',{name:'Pos kawalan',exact:true}).selectOption('25');
  await dialog.getByRole('combobox',{name:'Syif',exact:true}).selectOption('Office Hour');await dialog.getByRole('radio',{name:'Ahmad bin Ali ahmad'}).check();
  await dialog.getByRole('button',{name:'Simpan tugasan'}).click();await expect(dialog).toHaveCount(0);
  await page.getByLabel('Cari pos atau bangunan').fill('Pos 25');await page.locator('.schedule-post-record > summary').click();
  const shift=page.getByRole('region',{name:'Pos 25 · Office Hour'});await expect(shift.getByText('Ahmad bin Ali',{exact:true})).toBeVisible();
  await expect(shift).toContainText('Tiada minimum ditetapkan');await shift.getByRole('button',{name:'Edit Ahmad bin Ali'}).click();
  await expect(page.getByRole('dialog',{name:'Edit tugasan'})).toContainText('Office Hour');expect(api.errors).toEqual([]);
});
