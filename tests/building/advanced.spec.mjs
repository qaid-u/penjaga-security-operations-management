import { test, expect } from '@playwright/test';
import { mockOperations, locations, metrics } from './operations-fixture.mjs';

async function setup(page, role = 'Pentadbir Sistem') {
  await page.addInitScript((nama_peranan) => localStorage.setItem('penjaga_user', JSON.stringify({id_pengguna:1,nama_peranan,nama_penuh:'Ujian Fasa 4'})),role);
  await page.emulateMedia({reducedMotion:'reduce'});
  const fixture = await mockOperations(page,{linked:true});
  const items = Array.from({length:22},(_,i) => ({id_laporan:500+i,id_pos:i === 1 ? 92 : 91,tajuk_laporan:i === 0 ? 'Sejarah berisiko tinggi' : i === 1 ? 'Sejarah tanpa pautan' : `Sejarah biasa ${i}`,tarikh_laporan:'2026-10-24',masa_laporan:'10:00:00',nama_pos:i === 1 ? 'Pos Tanpa Pautan' : 'Pos Ujian API',tahap_risiko:i === 0 ? 'High' : i === 1 ? 'Unknown' : 'Low',kategori_dikesan:i === 1 ? null : 'Kategori Ujian',status_laporan:'Dihantar',locations:i === 1 ? [] : [{...locations[0],id_pos:91}],open_actions:i === 0 ? 1 : 0,completed_actions:0,action_statuses:i === 0 ? ['Dalam Tindakan'] : []}));
  const calls=[];
  let failure=false;
  const filter = (url) => items.filter((r) => {
    const q=url.searchParams;
    return (!q.get('risk') || (q.get('risk') === 'HighCritical' ? ['High','Critical'].includes(r.tahap_risiko) : q.get('risk') === r.tahap_risiko)) &&
      (!q.get('mapping') || q.get('mapping') === 'all' || (q.get('mapping') === 'linked') === Boolean(r.locations.length)) &&
      (!q.get('zone') || r.locations.some((l) => l.hotspot_id === q.get('zone'))) &&
      (!q.get('post') || String(r.id_pos) === q.get('post')) &&
      (!q.get('category') || (r.kategori_dikesan || 'Unknown') === q.get('category')) &&
      (!q.get('action_status') || r.action_statuses.includes(q.get('action_status'))) &&
      (!q.get('report_status') || r.status_laporan === q.get('report_status'));
  });
  await page.route('**/api/3d/incidents?**',async(route) => {
    const url=new URL(route.request().url());calls.push(url.searchParams);
    if(failure)return route.fulfill({status:503,json:{message:'Sejarah sementara tidak tersedia'}});
    const matching=filter(url),pageNumber=Number(url.searchParams.get('page') || 1);
    return route.fulfill({json:{items:matching.slice((pageNumber-1)*20,pageNumber*20),total:matching.length,page:pageNumber,limit:20,period:{from:url.searchParams.get('from'),to:url.searchParams.get('to')},refreshed_at:'2026-10-24T02:00:00Z'}});
  });
  await page.route('**/api/3d/overview?**',(route) => {
    const url=new URL(route.request().url()),matching=filter(url),mapped=matching.filter((r) => r.locations.length);
    const m=structuredClone(metrics);m.incidents={total:mapped.length,High:mapped.filter((r) => r.tahap_risiko==='High').length,Low:mapped.filter((r) => r.tahap_risiko==='Low').length,Medium:0,Critical:0,Unknown:0};
    const inScope=url.searchParams.get('mapping')!=='unlinked' && (!url.searchParams.get('zone') || url.searchParams.get('zone')===locations[0].hotspot_id);
    return route.fulfill({json:{period:Object.fromEntries(url.searchParams),refreshed_at:'2026-10-24T02:00:00Z',locations:locations.map((l,i) => ({...l,id_pos:i===0?91:null,in_scope:i===0 && inScope,metrics:i===0 && inScope?m:null})),totals:{linked_posts:inScope?1:0,assignments:inScope?1:0,checked_in:inScope?1:0,reports:matching.length,high_critical:matching.filter((r) => ['High','Critical'].includes(r.tahap_risiko)).length,open_actions:matching.reduce((n,r)=>n+r.open_actions,0),completed_actions:0,unmapped_reports:matching.filter((r) => !r.locations.length).length}}});
  });
  return {fixture,calls,fail:()=>{failure=true;},recover:()=>{failure=false;}};
}

test('official post filters retain exterior camera controls and do not mark unconfirmed indoor positions',async({page})=>{
  await setup(page);const models=[];page.on('request',(r)=>{if(r.url().endsWith('.glb'))models.push(r.url());});
  await page.goto('/3d-command-centre');await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByText(/Aras pos mengikut senarai rasmi/)).toBeVisible();
  await expect(page.getByLabel('Pos keselamatan bangunan').locator('option')).toHaveCount(8);
  const initialModelRequests=models.length; // React StrictMode can abort one initial development fetch.
  for(const [id,name] of [['POST_DJM_SS_LEVEL_3','Pos Tingkat 3 Pejabat Setiausaha Kerajaan Johor'],['POST_DJM_MB_LEVEL_4_FRONT','Pos Tingkat 4 Hadapan Pejabat Menteri Besar Johor'],['POST_DJM_MAIN_LOBBY','Pos Lobi Utama']]) {
    await page.getByLabel('Pos keselamatan bangunan').selectOption(id);await expect(page.getByText(`Pos dipilih: ${name}`,{exact:true})).toBeVisible();await expect(page.locator('.building-hotspot')).toHaveCount(0);
    await expect(page.getByLabel('Pratetap kamera')).toHaveValue('overview');
    if(id==='POST_DJM_SS_LEVEL_3')await page.getByRole('region',{name:'Model interaktif Bangunan Dato’ Jaafar Muhammad'}).screenshot({path:'artifacts/suk/djm-posts-zone.png'});
  }
  await page.getByRole('button',{name:'Tetap semula',exact:true}).click();
  const before=await page.locator('canvas').screenshot();
  for(const preset of ['front','left','right','top','overview'])await page.getByLabel('Pratetap kamera').selectOption(preset);
  await page.getByLabel('Pratetap kamera').selectOption('top');const after=await page.locator('canvas').screenshot();expect(before.equals(after)).toBe(false);
  for(const mode of ['incidents','followup','coverage'])await page.getByLabel('Paparan operasi').selectOption(mode);
  await expect(page.getByLabel('Pratetap kamera')).toHaveValue('top');expect(models).toHaveLength(initialModelRequests);
  await expect(page.getByLabel('Petunjuk operasi')).toContainText('Liputan operasi');
});

test('history paginates, resolves mapped reports, preserves unmapped records and applies filters',async({page})=>{
  const {calls}=await setup(page,'Ketua Pengawal');await page.goto('/3d-command-centre');
  await page.getByLabel('Paparan operasi').selectOption('incidents');
  const history=page.getByRole('region',{name:'Sejarah laporan'});
  await expect(history.getByText(/22 laporan/)).toBeVisible();
  await history.getByRole('button',{name:/Sejarah berisiko tinggi/}).click();
  await expect(page.getByLabel('Butiran laporan dipilih')).toContainText('Sejarah berisiko tinggi');
  await expect(page.getByLabel('Pratetap kamera')).toHaveValue('overview');
  await expect(page.getByRole('button',{name:/01.*Pos Lobi Utama/})).toHaveAttribute('aria-pressed','true');
  await history.getByRole('button',{name:/Sejarah tanpa pautan/}).click();
  await expect(page.getByLabel('Butiran laporan dipilih')).toContainText('Pos ini tiada pautan 3D');
  await expect(page.getByRole('button',{name:/01.*Pos Lobi Utama/})).toHaveAttribute('aria-pressed','false');
  await expect(page.getByLabel('Butiran laporan dipilih').getByRole('button',{name:/Fokus/})).toHaveCount(0);
  await history.getByRole('button',{name:'Halaman seterusnya'}).click();await expect(history.getByText('Halaman 2 / 2')).toBeVisible();
  await page.getByLabel('Tahap risiko').selectOption('HighCritical');await expect(history.getByText(/1 laporan ·/)).toBeVisible();await expect(history.getByText('Halaman 1 / 1')).toBeVisible();
  await page.getByLabel('Kategori NLP').selectOption('Kategori Ujian');await page.getByLabel('Status laporan').selectOption('Ditolak');
  await expect(history.getByText('Tiada laporan sepadan dengan penapis ini.')).toBeVisible();
  expect(calls.some((q)=>q.get('report_status')==='Ditolak' && q.get('risk')==='HighCritical')).toBe(true);
  await page.getByRole('button',{name:'Tetapkan semula penapis'}).click();await expect(page.getByLabel('Paparan operasi')).toHaveValue('coverage');
});

test('analytics cards and Kuala Lumpur quick ranges drive queries and matching totals',async({page})=>{
  const {calls}=await setup(page);await page.goto('/3d-command-centre');
  await page.getByRole('button',{name:/Laporan High \/ Critical/}).click();
  await expect(page.getByLabel('Tahap risiko')).toHaveValue('HighCritical');
  await expect(page.getByRole('region',{name:'Sejarah laporan'}).getByText(/1 laporan ·/)).toBeVisible();
  await page.getByRole('button',{name:'7 hari terakhir',exact:true}).click();
  await expect(page.getByLabel('Laporan dari')).toHaveValue('2026-10-18');await expect(page.getByLabel('Laporan hingga')).toHaveValue('2026-10-24');
  await expect.poll(()=>calls.some((q)=>q.get('from')==='2026-10-18')).toBe(true);
  await page.getByRole('button',{name:'30 hari terakhir',exact:true}).click();await expect(page.getByLabel('Laporan dari')).toHaveValue('2026-09-25');
  await page.getByLabel('Laporan dari').fill('2026-10-01');await expect.poll(()=>calls.some((q)=>q.get('from')==='2026-10-01')).toBe(true);
  await page.getByLabel('Tahap risiko').selectOption('');await page.getByRole('button',{name:/Laporan tanpa pautan 3D/}).click();
  await expect(page.getByLabel('Pemetaan pos')).toHaveValue('unlinked');
  await expect(page.getByRole('region',{name:'Sejarah laporan'}).getByRole('button',{name:/Sejarah tanpa pautan/})).toBeVisible();
  await page.screenshot({path:'artifacts/suk/djm-posts-history.png',fullPage:true});
});

test('history backend error preserves scene and recovers through retry',async({page})=>{
  const fixture=await setup(page);await page.goto('/3d-command-centre');await expect(page.locator('canvas')).toBeVisible();
  fixture.fail();await page.getByLabel('Paparan operasi').selectOption('incidents');
  await expect(page.getByRole('alert')).toContainText('Sejarah sementara tidak tersedia');await expect(page.locator('canvas')).toBeVisible();
  fixture.recover();await page.getByRole('button',{name:'Cuba semula sejarah'}).click();await expect(page.getByRole('region',{name:'Sejarah laporan'}).getByText(/22 laporan ·/)).toBeVisible();
});

test('tablet and mobile keyboard controls, sheet close and reduced motion work',async({page})=>{
  await setup(page,'Ketua Pengawal');await page.setViewportSize({width:820,height:1180});await page.goto('/3d-command-centre');
  await expect(page.locator('canvas')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.setViewportSize({width:390,height:844});
  const button=page.getByRole('button',{name:/01.*Pos Lobi Utama/});await button.focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('button',{name:'Tutup maklumat lokasi'})).toBeVisible();
  await expect(page.getByLabel('Panel lokasi')).toBeFocused();
  await page.keyboard.press('Escape');await expect(button).toBeFocused();
  await expect(page.getByRole('button',{name:'Tutup maklumat lokasi'})).toBeHidden();
  await page.getByLabel('Paparan operasi').selectOption('followup');await expect(page.getByLabel('Petunjuk operasi')).toContainText('Selesai');
  await page.getByLabel('Status tindakan').selectOption('Selesai');await expect(page.getByText('Tiada laporan sepadan dengan penapis ini.')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('touch-enabled mobile can select a zone and use camera controls',async({browser,baseURL})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  try {
    const page=await context.newPage();await setup(page,'Ketua Pengawal');await page.goto(`${baseURL}/3d-command-centre`);
    await expect(page.locator('canvas')).toBeVisible();
    await page.getByRole('button',{name:/01.*Pos Lobi Utama/}).tap();
    await expect(page.getByLabel('Panel lokasi').getByText('Pos Ujian API',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Tutup maklumat lokasi'}).tap();
    await page.getByRole('button',{name:'Zum masuk',exact:true}).tap();
    await page.getByRole('button',{name:'Tetap semula',exact:true}).tap();
    await expect(page.getByLabel('Pratetap kamera')).toHaveValue('overview');
  } finally {await context.close();}
});

test('operational location list remains usable without WebGL',async({page})=>{
  await setup(page);await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:original.call(this,type,...args);};});
  await page.goto('/3d-command-centre');await expect(page.getByRole('alert')).toContainText('WebGL 2 tidak tersedia');
  await page.getByRole('button',{name:/01.*Pos Lobi Utama/}).click();await expect(page.getByLabel('Panel lokasi').getByText('Pos Ujian API',{exact:true})).toBeVisible();
});

test('selecting an unconfirmed indoor post preserves the manually orbited exterior view',async({page})=>{
  await setup(page,'Ketua Pengawal');
  // Observe the actual WebGL camera matrix without adding application test hooks.
  await page.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    const observed=new WeakSet();
    HTMLCanvasElement.prototype.getContext=function(type,...args){
      const gl=original.call(this,type,...args);
      if(type==='webgl2' && gl && !observed.has(gl)) {
        observed.add(gl);
        const locations=new WeakMap();
        const getUniformLocation=gl.getUniformLocation.bind(gl);
        gl.getUniformLocation=(program,name)=>{const location=getUniformLocation(program,name);if(location)locations.set(location,name);return location;};
        const matrix=gl.uniformMatrix4fv.bind(gl);
        gl.uniformMatrix4fv=(location,transpose,values,...rest)=>{if(locations.get(location)==='viewMatrix')window.__djmViewMatrix=Array.from(values);return matrix(location,transpose,values,...rest);};
      }
      return gl;
    };
  });
  await page.setViewportSize({width:1440,height:1100});
  await page.goto('/3d-command-centre');
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByLabel('Pratetap kamera').selectOption('left');
  const canvas=page.locator('canvas');
  await canvas.scrollIntoViewIfNeeded();
  const preset=await canvas.screenshot();
  const box=await canvas.boundingBox();
  await page.mouse.move(box.x+box.width*.3,box.y+box.height*.5);
  await page.mouse.down();await page.mouse.move(box.x+box.width*.6,box.y+box.height*.55,{steps:15});await page.mouse.up();
  const orbited=await canvas.screenshot();
  expect(orbited.equals(preset)).toBe(false);
  await expect.poll(()=>page.evaluate(()=>window.__djmViewMatrix?.length)).toBe(16);
  const cameraBefore=await page.evaluate(()=>window.__djmViewMatrix);
  await page.getByRole('button',{name:/03.*Pos Tingkat 3/}).click();
  await expect(page.getByLabel('Panel lokasi')).toContainText('Aras: Tingkat 3');
  await expect(page.getByLabel('Pratetap kamera')).toHaveValue('left');
  await canvas.screenshot();
  expect(await page.evaluate(()=>window.__djmViewMatrix)).toEqual(cameraBefore);
  await expect(page.locator('.building-hotspot')).toHaveCount(0);
  await page.screenshot({path:'artifacts/suk/djm-posts-level3.png',fullPage:true});
});
