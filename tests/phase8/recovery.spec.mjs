import { test, expect } from '@playwright/test';

async function session(page, role, handler) {
  const errors=[];
  page.on('pageerror', error=>errors.push(error.message));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(role=>{localStorage.setItem('token','synthetic-recovery-token');localStorage.setItem('penjaga_user',JSON.stringify({id_pengguna:1,nama_peranan:role,nama_penuh:'Test User'}));},role);
  await page.route(url=>url.pathname.startsWith('/api/'),async route=>{
    const url=new URL(route.request().url());
    if(await handler(route,url))return;
    if(url.pathname==='/api/meta')return route.fulfill({json:{posts:[{id_pos:1,nama_pos:'Main post'}],guards:[{id_pengguna:3,nama_penuh:'Guard A'}],checklist:[],categories:[]}});
    return route.fulfill({json:[]});
  });
  return errors;
}
const week={id_jadual_mingguan:1,tarikh_mula:'2026-10-26',tarikh_tamat:'2026-11-01',status_jadual:'Draf'};

test('daily schedule shows actual assigned guards, refreshes dates and confirms deletion',async({page})=>{
  const dates=[];let deletes=0;
  const errors=await session(page,'Pentadbir Sistem',async(route,url)=>{
    if(url.pathname==='/api/jadual/mingguan'){await route.fulfill({json:[week]});return true;}
    if(url.pathname==='/api/jadual/mingguan/1'){await route.fulfill({json:week});return true;}
    if(url.pathname.endsWith('/coverage-summary')){
      const date=url.searchParams.get('date');dates.push(date);
      const assignments=deletes||date==='2026-10-27'?[]:[{id_jadual:9,id_pengguna:3,nama_penuh:'Assigned Guard',tarikh_tugas:date,masa_mula:'07:00',masa_tamat:'16:00',status_bertugas:'Dijadualkan'}];
      await route.fulfill({json:{totalRequired:2,totalAssigned:assignments.length,shortage:2-assignments.length,activeDutyCount:0,absentGuardCount:0,coverageByPost:[{id_pos:1,nama_pos:'Main post',syif:'Pagi',required:2,assigned:assignments.length,assignments}],uncoveredPosts:[]}});return true;
    }
    if(url.pathname==='/api/jadual/assignments/9'&&route.request().method()==='DELETE'){deletes++;await route.fulfill({json:{}});return true;}
    return false;
  });
  await page.goto('/jadual');
  await expect(page.getByText('Assigned Guard',{exact:true})).toBeVisible();
  expect(dates.at(-1)).toMatch(/^2026-(10-(2[6-9]|3[01])|11-01)$/);
  await page.getByLabel('Tarikh tugasan').fill('2026-10-27');
  await expect.poll(()=>dates.at(-1)).toBe('2026-10-27');
  await expect(page.getByText('Assigned Guard',{exact:true})).toHaveCount(0);
  await page.getByLabel('Tarikh tugasan').fill('2026-10-26');
  await expect(page.getByText('Assigned Guard',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Padam',exact:true}).click();
  expect(deletes).toBe(0);
  await page.getByRole('dialog',{name:'Padam tugasan?'}).getByRole('button',{name:'Batal'}).click();
  expect(deletes).toBe(0);
  await page.getByRole('button',{name:'Padam',exact:true}).click();
  await page.getByRole('dialog',{name:'Padam tugasan?'}).getByRole('button',{name:'Padam tugasan',exact:true}).click();
  await expect.poll(()=>deletes).toBe(1);
  await expect(page.getByText('Assigned Guard',{exact:true})).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('schedule network failure offers retry instead of claiming no assignments',async({page})=>{
  let failed=true;
  const errors=await session(page,'Pengawal Keselamatan',async(route,url)=>{
    if(url.pathname==='/api/jadual/my-schedule'){await route.fulfill(failed?{status:503,json:{message:'Temporary outage'}}:{json:[]});return true;}return false;
  });
  await page.goto('/jadual');
  await expect(page.getByText('Data jadual belum dapat dimuatkan.',{exact:false})).toBeVisible();
  await expect(page.getByText('Tiada jadual',{exact:true})).toHaveCount(0);
  failed=false;await page.getByRole('button',{name:'Cuba lagi',exact:true}).click();
  await expect(page.getByText('Tiada jadual',{exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});

test('guard history paginates older reports and remains available when form metadata fails',async({page})=>{
  let metaFails=true;const pages=[];
  const errors=await session(page,'Pengawal Keselamatan',async(route,url)=>{
    if(url.pathname==='/api/meta'&&metaFails){await route.fulfill({status:503,json:{message:'Temporary outage'}});return true;}
    if(url.pathname==='/api/reports'){
      const p=Number(url.searchParams.get('page'));pages.push(p);
      await route.fulfill({json:{data:[{id_laporan:p,tajuk_laporan:p===2?'Older report':'New report',status_laporan:'Dihantar',tahap_risiko:'Low'}],meta:{total:11,totalPages:2,page:p}}});return true;
    }return false;
  });
  await page.goto('/laporan');
  await expect(page.getByText('Borang laporan belum dapat dimuatkan.',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Laporan saya',exact:true}).click();
  await expect(page.getByText('New report',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Seterusnya',exact:true}).click();
  await expect(page.getByText('Older report',{exact:true})).toBeVisible();
  expect(pages).toContain(2);
  await page.getByRole('button',{name:'Tulis laporan',exact:true}).click();
  metaFails=false;await page.getByRole('button',{name:'Cuba lagi',exact:true}).click();
  await expect(page.getByLabel('Tajuk laporan',{exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});

test('follow-up searches the full pending queue and includes requested low-risk reports',async({page})=>{
  let body;const requests=[];
  const errors=await session(page,'Pentadbir Sistem',async(route,url)=>{
    if(url.pathname==='/api/reports'){
      requests.push(url.searchParams);
      const second=url.searchParams.get('page')==='2',search=url.searchParams.get('search');
      await route.fulfill({json:{data:[{id_laporan:second||search?99:1,tajuk_laporan:second||search?'Older Low request':'New request',nama_pos:'Main post',tahap_risiko:'Low',status_laporan:'Diluluskan',perlu_tindakan_susulan:true,ada_tindakan_susulan:false}],meta:{total:search?1:51,totalPages:search?1:2}}});return true;
    }
    if(url.pathname==='/api/actions'&&route.request().method()==='POST'){body=route.request().postDataJSON();await route.fulfill({json:{}});return true;}
    return false;
  });
  await page.goto('/tindakan');
  await page.getByText('Tambah tindakan baharu',{exact:false}).click();
  await page.getByRole('button',{name:'Seterusnya',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Laporan',exact:true})).toContainText('Older Low request');
  await page.getByLabel('Cari laporan',{exact:true}).fill('Older');
  await expect.poll(()=>requests.at(-1)?.get('page')).toBe('1');
  expect(requests.at(-1).get('follow_up')).toBe('pending');
  await page.getByLabel('Cari laporan',{exact:true}).fill('');
  await page.getByRole('button',{name:'Seterusnya',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Laporan',exact:true})).toContainText('Older Low request');
  await page.getByRole('combobox',{name:'Laporan',exact:true}).selectOption('99');
  await page.getByLabel('Pegawai bertanggungjawab').fill('Supervisor');
  await page.getByLabel('Tindakan diambil').fill('Repair the lock');
  await page.getByRole('button',{name:'Simpan tindakan',exact:true}).click();
  await expect.poll(()=>body?.id_laporan).toBe(99);
  await expect.poll(()=>requests.at(-1)?.get('page')).toBe('1');
  expect(errors).toEqual([]);
});

test('failed conflict checks keep the assignment form usable',async({page})=>{
  const errors=await session(page,'Pentadbir Sistem',async(route,url)=>{
    if(url.pathname==='/api/jadual/mingguan'){await route.fulfill({json:[week]});return true;}
    if(url.pathname==='/api/jadual/mingguan/1'){await route.fulfill({json:week});return true;}
    if(url.pathname.endsWith('/coverage-summary')){await route.fulfill({json:{totalRequired:1,totalAssigned:0,shortage:1,coverageByPost:[{id_pos:1,nama_pos:'Main post',syif:'Pagi',required:1,assigned:0,assignments:[]}]}});return true;}
    if(url.pathname==='/api/jadual/check-conflict'){await route.fulfill({status:503,json:{message:'Semakan sementara gagal'}});return true;}
    return false;
  });
  await page.goto('/jadual');await page.getByRole('button',{name:'Tugaskan pengawal sekarang'}).click();
  await page.getByRole('combobox',{name:'Pengawal',exact:true}).selectOption('3');
  await page.getByRole('button',{name:'Simpan tugasan',exact:true}).click();
  await expect(page.getByText('Semakan sementara gagal',{exact:false})).toBeVisible();
  await expect(page.getByRole('button',{name:'Simpan tugasan',exact:true})).toBeEnabled();
  expect(errors).toEqual([]);
});

test('reviewing the last report on a later page returns to the first page',async({page})=>{
  let reviewed=false;const pages=[];
  const report={id_laporan:42,tajuk_laporan:'Last waiting report',status_laporan:'Dihantar',kandungan_laporan:'Routine patrol',tahap_risiko:'Low'};
  await session(page,'Ketua Pengawal',async(route,url)=>{
    if(url.pathname==='/api/reports'){pages.push(url.searchParams.get('page'));await route.fulfill({json:{data:[report],meta:{total:reviewed?50:51,totalPages:reviewed?1:2}}});return true;}
    if(url.pathname==='/api/reports/42'){await route.fulfill({json:{report:{...report,status_laporan:reviewed?'Diluluskan':'Dihantar'},analysis:null,analysisJob:{status:'failed'},checklist:[],reviews:[],actions:[]}});return true;}
    if(url.pathname==='/api/reports/42/analysis'){await route.fulfill({json:{analysis:null,job:{status:'failed'}}});return true;}
    if(url.pathname==='/api/reports/42/review'){reviewed=true;await route.fulfill({json:{}});return true;}
    return false;
  });
  await page.goto('/semakan');
  await page.getByRole('button',{name:'Seterusnya',exact:true}).click();
  await expect.poll(()=>pages.at(-1)).toBe('2');
  await page.getByRole('button',{name:'Detail',exact:true}).click();
  await page.getByLabel('Tidak perlu tindakan susulan',{exact:true}).check();
  await page.getByRole('button',{name:'Lulus',exact:true}).click();
  await page.getByRole('button',{name:'Luluskan',exact:true}).click();
  await expect.poll(()=>reviewed).toBe(true);
  await expect.poll(()=>pages.at(-1)).toBe('1');
});
