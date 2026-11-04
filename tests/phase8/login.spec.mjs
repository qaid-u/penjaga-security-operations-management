import {test,expect} from '@playwright/test';

test('login presents the PENJAGA icon and real building model',async({page},info)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/login');
  await expect(page.getByRole('heading',{name:'Selamat kembali.'})).toBeVisible();
  await expect(page.locator('.login-wordmark img')).toHaveAttribute('src','/favicon.svg');
  await expect(page.locator('.login-landscape canvas')).toBeVisible({timeout:25000});
  await expect(page.getByText('Bangunan Dato’ Jaafar Muhammad',{exact:true})).toBeVisible();
  await page.screenshot({path:info.outputPath('login-desktop.png'),fullPage:true});
  expect(errors).toEqual([]);
});

test('phone login stays usable when the background model fails',async({page},info)=>{
  await page.route('**/models/Bangunan_SUK.glb',route=>route.abort());
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/login');
  for(const width of [320,390,768]){
    await page.setViewportSize({width,height:844});
    await expect(page.getByLabel('Nama pengguna',{exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.setViewportSize({width:390,height:844});
  await page.getByLabel('Kata laluan',{exact:true}).fill('Synthetic-password');
  await page.getByRole('button',{name:'Tunjuk kata laluan'}).click();
  await expect(page.getByLabel('Kata laluan',{exact:true})).toHaveAttribute('type','text');
  await page.getByRole('button',{name:'Sembunyikan kata laluan'}).click();
  await expect(page.getByLabel('Kata laluan',{exact:true})).toHaveAttribute('type','password');
  await page.getByLabel('Kata laluan',{exact:true}).fill('');
  await page.screenshot({path:info.outputPath('login-mobile.png'),fullPage:true});
});

for(const [role,target] of [['Pentadbir Sistem','/dashboard'],['Ketua Pengawal','/dashboard'],['Pengawal Keselamatan','/pengawal']])test(`login retains errors, pending protection and ${role} routing`,async({page})=>{
  let attempts=0,release;
  await page.route(url=>url.pathname.startsWith('/api/'),async route=>{
    if(new URL(route.request().url()).pathname==='/api/auth/login'){
      attempts++;
      if(attempts===1)return route.fulfill({status:401,json:{message:'Nama pengguna atau kata laluan tidak sah'}});
      await new Promise(resolve=>{release=resolve;setTimeout(resolve,3000);});
      return route.fulfill({json:{token:'synthetic-login-test',user:{id_pengguna:1,nama_peranan:role,nama_penuh:'Synthetic operator'}}});
    }
    return route.fulfill({json:{cards:{},priority:{},latest:[],byRisk:[],today:'2026-11-01',duty:[]}});
  });
  await page.goto('/login');
  await page.getByLabel('Nama pengguna',{exact:true}).fill('synthetic-user');
  await page.getByLabel('Kata laluan',{exact:true}).fill('Synthetic-password');
  await page.getByRole('button',{name:'Log Masuk',exact:true}).click();
  await expect(page.locator('#login-error')).toContainText('tidak sah');
  await expect(page.getByLabel('Nama pengguna',{exact:true})).toHaveValue('synthetic-user');
  await page.getByLabel('Kata laluan',{exact:true}).press('Enter');
  await expect(page.getByRole('button',{name:'Sedang log masuk…',exact:true})).toBeDisabled();
  await expect.poll(()=>attempts).toBe(2);release();
  await expect(page).toHaveURL(new RegExp(target+'$'));
});
