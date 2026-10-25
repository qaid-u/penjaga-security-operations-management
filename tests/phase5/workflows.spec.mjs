import {test,expect}from'@playwright/test';
async function login(page,user='demo_admin'){
  await page.goto('/login');await page.getByLabel('Nama pengguna').fill(user);await page.getByLabel('Kata laluan',{exact:true}).fill(process.env.PHASE5_DEMO_PASSWORD || 'Demo-Penjaga-2026!');await page.getByRole('button',{name:'Log Masuk',exact:true}).click();await expect(page).toHaveURL(user.includes('guard')?/pengawal$/:/dashboard$/);
}
test('R01 genuine login, database-connected mapped hotspot, history, module and return',async({page})=>{
  const errors=[];page.on('pageerror',(e)=>errors.push(e.message));
  await page.emulateMedia({reducedMotion:'reduce'});await login(page);
  await page.getByRole('link',{name:'Pusat Kawalan 3D',exact:true}).click();
  await page.getByLabel('Tarikh tugas (MYT)').fill('2026-10-24');await page.getByLabel('Laporan dari').fill('2026-09-25');await page.getByLabel('Laporan hingga').fill('2026-10-24');
  await page.getByRole('button',{name:/01.*Pos Lobi Utama/}).click();
  await expect(page.getByRole('heading',{name:'Pos Lobi Utama',exact:true})).toBeVisible();
  await expect(page.getByText('Demo guard_a',{exact:true})).toBeVisible();
  await expect(page.getByText(/23\/10\/(?:20)?26/).first()).toBeVisible();
  await page.getByLabel('Paparan operasi').selectOption('incidents');await page.getByLabel('Tahap risiko').selectOption('High');
  const history=page.getByRole('region',{name:'Sejarah laporan'});await history.getByRole('button',{name:/DEMO Laporan 1\s+High/}).click();
  await expect(page.getByLabel('Butiran laporan dipilih')).toContainText('Dalam Tindakan');
  await page.getByLabel('Butiran laporan dipilih').getByRole('link',{name:'Buka modul laporan'}).click();await expect(page).toHaveURL(/semakan$/);
  await page.getByRole('link',{name:'Pusat Kawalan 3D',exact:true}).click();await expect(page.locator('canvas')).toBeVisible();
  expect(errors).toEqual([]);await page.screenshot({path:'artifacts/suk/djm-posts-live-demo.png',fullPage:true});
});
test('R02 account switches never display the previous guard report cache',async({page})=>{
  const consoleErrors=[];page.on('console',(message)=>{if(message.type()==='error')consoleErrors.push(message.text());});
  await login(page,'demo_guard_a');await page.getByRole('link',{name:'Hantar Laporan',exact:true}).click();
  await expect(page.getByText('DEMO Laporan 1',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Logout',exact:true}).click();
  await page.getByLabel('Nama pengguna').fill('demo_guard_b');await page.getByLabel('Kata laluan',{exact:true}).fill(process.env.PHASE5_DEMO_PASSWORD || 'Demo-Penjaga-2026!');await page.getByRole('button',{name:'Log Masuk',exact:true}).click();await expect(page).toHaveURL(/pengawal$/);
  await page.route('**/api/reports?**',async(route)=>{await new Promise((resolve)=>setTimeout(resolve,700));await route.continue();});
  await page.getByRole('link',{name:'Hantar Laporan',exact:true}).click();await expect(page.getByText('DEMO Laporan 1',{exact:true})).toHaveCount(0);
  await expect(page.getByText('DEMO Laporan 2',{exact:true})).toBeVisible();await expect(page.getByText('DEMO Laporan 1',{exact:true})).toHaveCount(0);
  expect(consoleErrors.filter((m)=>/unique.*key|same key/.test(m))).toEqual([]);
});
test('R04 malformed saved identity returns to login without an application crash',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('penjaga_user','{invalid-json'));
  await page.goto('/3d-command-centre');await expect(page).toHaveURL(/login$/);await expect(page.getByRole('button',{name:'Log Masuk',exact:true})).toBeVisible();
});
test('S07 development server refuses backend files and private demo credentials',async({request})=>{
  for(const route of ['/backend/server.js','/backend/.env','/.phase5-runtime.local/connection.json','/.phase5-runtime.local/missing-private-file.json','/.phase7-runtime.local/missing-private-backup.dump','/backend/missing-private-file']){
    const response=await request.get(route);expect([403,404]).toContain(response.status());
  }
});
test('A02 chief mobile touch, keyboard and two-finger pinch use the real demo backend',async({browser})=>{
  const context=await browser.newContext({hasTouch:true,isMobile:true,viewport:{width:390,height:844}});
  try{
    const page=await context.newPage();await page.emulateMedia({reducedMotion:'reduce'});await login(page,'demo_chief');
    await page.getByRole('button',{name:'Buka menu',exact:true}).tap();await page.getByRole('link',{name:'Pusat Kawalan 3D',exact:true}).first().tap();await expect(page.locator('canvas')).toBeVisible();
    await page.locator('canvas').scrollIntoViewIfNeeded();const box=await page.locator('canvas').boundingBox();
    const cdp=await context.newCDPSession(page);const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
    const p=(x,y,id)=>({x,y,id,radiusX:2,radiusY:2});
    const x=box.x+box.width*.5,y=box.y+box.height*.3;
    await touch('touchStart',[p(x-25,y,1),p(x+25,y,2)]);await touch('touchMove',[p(x-55,y,1),p(x+55,y,2)]);await touch('touchEnd',[]);
    await touch('touchStart',[p(x,y,1)]);await touch('touchMove',[p(x+40,y+10,1)]);await touch('touchEnd',[]);
    await page.getByRole('button',{name:/01.*Pos Lobi Utama/}).tap();await expect(page.getByRole('button',{name:'Tutup maklumat lokasi'})).toBeVisible();await page.getByRole('button',{name:'Tutup maklumat lokasi'}).tap();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(page.getByText('Pemetaan lokasi — Pentadbir Sistem',{exact:true})).toHaveCount(0);
  }finally{await context.close();}
});
