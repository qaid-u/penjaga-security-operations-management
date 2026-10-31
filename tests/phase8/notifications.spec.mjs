import { test, expect } from '@playwright/test';

async function setup(page,{failed=false}={}) {
  let rows=[{id_notifikasi:1,tajuk_notifikasi:'Tindakan diperlukan',mesej_notifikasi:'Semak laporan',jenis_notifikasi:'Tindakan Susulan',tahap_keutamaan:'High',status_bacaan:'Belum Dibaca',tarikh_hantar:'2026-10-31T09:00:00+08:00'},{id_notifikasi:2,tajuk_notifikasi:'Kemajuan baharu',mesej_notifikasi:'Kunci dibaiki',tahap_keutamaan:'Low',status_bacaan:'Belum Dibaca',tarikh_hantar:'2026-10-31T08:00:00+08:00'}];
  await page.addInitScript(()=>{localStorage.setItem('token','synthetic-notification-token');localStorage.setItem('penjaga_user',JSON.stringify({id_pengguna:1,nama_penuh:'Test User',nama_peranan:'Pentadbir Sistem'}));});
  await page.route(url=>url.pathname.startsWith('/api/'),async route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/api/notifications/unread-count')return route.fulfill({json:{unread:rows.filter(n=>n.status_bacaan!=='Dibaca').length}});
    if(url.pathname==='/api/notifications/read-all'){rows=rows.map(n=>({...n,status_bacaan:'Dibaca'}));return route.fulfill({json:{updated:2}});}
    if(url.pathname==='/api/notifications/1/read'){rows[0].status_bacaan='Dibaca';return route.fulfill({json:{}});}
    if(url.pathname==='/api/notifications')return route.fulfill(failed?{status:503,json:{message:'Temporary outage'}}:{json:rows.filter(n=>url.searchParams.get('unread')!=='true'||n.status_bacaan!=='Dibaca')});
    return route.fulfill({json:[]});
  });
  return {recover:()=>{failed=false;},add:()=>rows.push({...rows[0],id_notifikasi:3,tajuk_notifikasi:'Makluman baharu',status_bacaan:'Belum Dibaca'})};
}
test('unread badge, filtering and read controls update together',async({page})=>{
  await setup(page);await page.goto('/notifikasi');
  await expect(page.locator('.workspace-topbar .workspace-notification-count')).toHaveText('2');
  await page.getByRole('button',{name:'Belum dibaca (2)',exact:true}).click();
  await page.locator('article').filter({hasText:'Tindakan diperlukan'}).getByRole('button',{name:'Tanda dibaca',exact:true}).click();
  await expect(page.locator('.workspace-topbar .workspace-notification-count')).toHaveText('1');
  await expect(page.getByRole('heading',{name:'Tindakan diperlukan'})).toHaveCount(0);
  await page.getByRole('button',{name:'Tanda semua dibaca'}).click();
  await expect(page.getByText('Semua telah dibaca',{exact:true})).toBeVisible();
  await expect(page.locator('.workspace-topbar .workspace-notification-count')).toHaveCount(0);
  await page.getByRole('button',{name:'Semua',exact:true}).click();
  await expect(page.locator('article')).toHaveCount(2);
});
test('notification centre recovers after API failure on a phone',async({page})=>{
  const api=await setup(page,{failed:true});await page.setViewportSize({width:390,height:844});await page.goto('/notifikasi');
  await expect(page.getByText('Notifikasi belum dapat dimuatkan.',{exact:false})).toBeVisible();api.recover();
  await page.getByRole('button',{name:'Cuba lagi',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Tindakan diperlukan'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('new notifications refresh automatically',async({page})=>{
  await page.clock.install();const api=await setup(page);await page.goto('/notifikasi');
  await expect(page.locator('.workspace-topbar .workspace-notification-count')).toHaveText('2');api.add();
  await page.clock.fastForward(31000);
  await expect(page.locator('.workspace-topbar .workspace-notification-count')).toHaveText('3');
  await expect(page.getByRole('heading',{name:'Makluman baharu'})).toBeVisible();
});
