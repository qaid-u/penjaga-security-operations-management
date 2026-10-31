import { test, expect } from '@playwright/test';

async function session(page, role, handler) {
  await page.addInitScript(role => {
    localStorage.setItem('token', 'synthetic-workflow-token');
    localStorage.setItem('penjaga_user', JSON.stringify({id_pengguna:3,nama_penuh:'Test User',nama_peranan:role}));
  }, role);
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url());
    if (await handler(route,url)) return;
    if (url.pathname === '/api/meta') return route.fulfill({json:{posts:[],guards:[],roles:[],categories:[],checklist:[]}});
    return route.fulfill({json:[]});
  });
}

test('server filters reset pagination and CSV receives the same filters', async ({page}) => {
  const requests=[];
  await session(page,'Ketua Pengawal',async(route,url)=>{
    requests.push(url);
    if (url.pathname==='/api/reports/export.csv') { await route.fulfill({contentType:'text/csv',body:'ID,Tajuk\r\n66,Old needle'});return true; }
    if (url.pathname==='/api/reports') {
      const search=url.searchParams.get('search');
      await route.fulfill({json:{data:[{id_laporan:66,tajuk_laporan:search?'Old needle':'Current report',status_laporan:'Dihantar',nama_pos:'Post B',tarikh_laporan:'2026-10-01',tahap_risiko:'Critical'}],filters:{posts:[{id_pos:2,nama_pos:'Post B'}]},meta:{page:Number(url.searchParams.get('page')),total:search?1:60,totalPages:search?1:2}}});return true;
    }
    return false;
  });
  await page.goto('/semakan');
  await page.getByRole('button',{name:'Seterusnya',exact:true}).click();
  await expect.poll(()=>requests.filter(u=>u.pathname==='/api/reports').at(-1)?.searchParams.get('page')).toBe('2');
  await page.getByPlaceholder('Cari tajuk, pengawal, pos').fill('needle');
  await expect(page.getByText('Old needle',{exact:true})).toBeVisible();
  await expect.poll(()=>requests.filter(u=>u.pathname==='/api/reports').at(-1)?.searchParams.get('page')).toBe('1');
  await page.getByText('Penapis tambahan', {exact:false}).first().click();
  await page.locator('select').filter({has:page.locator('option[value="2"]')}).selectOption('2');
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'CSV',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Muat turun',exact:true}).click();await download;
  const exported=requests.find(u=>u.pathname==='/api/reports/export.csv');
  expect(exported.searchParams.get('search')).toBe('needle');expect(exported.searchParams.get('post')).toBe('2');expect(exported.searchParams.get('status')).toBe('Dihantar');
});

test('guard can use server-authorized overnight checkout',async({page})=>{
  let checked=false;
  await session(page,'Pengawal Keselamatan',async(route,url)=>{
    if(url.pathname==='/api/jadual/my-schedule'){
      await route.fulfill({json:[{id_jadual:9,nama_pos:'Night post',tarikh_tugas:'2026-01-01',syif:'Malam',masa_mula:'23:00',masa_tamat:'08:00',masa_check_in:'2026-01-01T23:00:00',can_check_in:false,can_check_out:!checked,masa_check_out:checked?'2026-01-02T08:00:00':null}]});return true;
    }
    if(url.pathname==='/api/jadual/assignments/9/check-out'){checked=true;await route.fulfill({json:{}});return true;}
    return false;
  });
  await page.goto('/jadual');
  await page.getByRole('button',{name:'Check-out',exact:true}).click();
  await expect.poll(()=>checked).toBe(true);
  await expect(page.getByRole('button',{name:'Check-out',exact:true})).toHaveCount(0);
});

test('audit CSV preserves selected filters and uses supported API',async({page})=>{
  let exported;
  await session(page,'Pentadbir Sistem',async(route,url)=>{
    if(url.pathname==='/api/audit'){
      if(url.searchParams.get('format')==='csv'){exported=url;await route.fulfill({contentType:'text/csv',body:'ID,Modul\r\n1,System'});}
      else await route.fulfill({json:{data:[],meta:{total:0,totalPages:0}}});
      return true;
    }
    return false;
  });
  await page.goto('/audit');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'CSV',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Muat turun',exact:true}).click();await download;
  expect(exported.pathname).toBe('/api/audit');expect(exported.searchParams.get('format')).toBe('csv');expect(exported.searchParams.get('dateMode')).toBe('all');
});

test('password form submits current and new password and clears on success',async({page})=>{
  let submitted;
  await session(page,'Pengawal Keselamatan',async(route,url)=>{
    if(url.pathname==='/api/auth/change-password'){submitted=route.request().postDataJSON();await route.fulfill({json:{message:'Kata laluan berjaya ditukar'}});return true;}
    return false;
  });
  await page.goto('/kata-laluan');
  await page.getByLabel('Kata laluan semasa',{exact:true}).fill('Original-password-123');
  await page.getByLabel('Kata laluan baharu (minimum 10 aksara)',{exact:true}).fill('Replacement-password-456');
  await page.getByLabel('Sahkan kata laluan baharu',{exact:true}).fill('Replacement-password-456');
  await page.getByRole('button',{name:'Tukar kata laluan',exact:true}).click();
  await expect.poll(()=>submitted?.newPassword).toBe('Replacement-password-456');
  await expect(page.getByLabel('Kata laluan semasa',{exact:true})).toHaveValue('');
});

test('completed local analysis keeps polling until independent review finishes',async({page})=>{
  let polls=0;
  const report={id_laporan:66,tajuk_laporan:'Local result available',kandungan_laporan:'Routine patrol',status_laporan:'Dihantar',nama_pos:'Post A',tarikh_laporan:'2026-10-29'};
  const analysis={id_nlp:7,id_laporan:66,kategori_dikesan:'Rondaan Biasa',tahap_risiko:'Low',skor_risiko:10,metadata:{review:{status:'pending'}}};
  await session(page,'Ketua Pengawal',async(route,url)=>{
    if(url.pathname==='/api/reports/66'){await route.fulfill({json:{report,analysis,analysisJob:{status:'completed'},checklist:[],reviews:[],actions:[]}});return true;}
    if(url.pathname==='/api/reports/66/analysis'){
      polls++;await route.fulfill({json:{analysis:{...analysis,metadata:{review:{status:polls<2?'processing':'consistent'}}},job:{status:'completed'}}});return true;
    }
    if(url.pathname==='/api/reports'){await route.fulfill({json:{data:[report],meta:{totalPages:1}}});return true;}
    return false;
  });
  await page.goto('/semakan?report=66');
  await expect(page.getByText('Semakan AI sedang diproses',{exact:true})).toBeVisible();
  await expect(page.getByText('Tiada percanggahan dikesan',{exact:true}).first()).toBeVisible({timeout:10000});
  expect(polls).toBeGreaterThanOrEqual(2);
});
