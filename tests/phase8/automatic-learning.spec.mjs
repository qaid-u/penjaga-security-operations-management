import {test,expect} from '@playwright/test';
test('chief explicitly confirms a category during approval without a training screen',async({page})=>{
  const report={id_laporan:19,tajuk_laporan:'Pemeriksaan peralatan',status_laporan:'Dihantar',kandungan_laporan:'Paparan kamera terganggu dan juruteknik dimaklumkan.',tarikh_laporan:'2026-11-02'};
  let payload;
  await page.addInitScript(()=>{localStorage.setItem('token','synthetic-chief-learning');localStorage.setItem('penjaga_user',JSON.stringify({id_pengguna:2,nama_penuh:'Test Chief',nama_peranan:'Ketua Pengawal'}));});
  await page.route(url=>url.pathname.startsWith('/api/'),async route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/api/meta')return route.fulfill({json:{automaticLearning:{ready:true,enabled:true},categories:[{id_kategori_insiden:1,nama_kategori:'Kerosakan Kemudahan'}],posts:[],guards:[]}});
    if(url.pathname==='/api/reports/19/review'){payload=route.request().postDataJSON();report.status_laporan='Diluluskan';return route.fulfill({json:{message:'Approved',learning:{eligible:true}}});}
    if(url.pathname==='/api/reports/19')return route.fulfill({json:{report,analysis:null,analysisJob:{status:'failed'},reviews:[],checklist:[],actions:[],confirmedCategory:payload?{category:payload.confirmedCategory}:null}});
    if(url.pathname==='/api/reports/19/analysis')return route.fulfill({json:{analysis:null,job:{status:'failed'}}});
    if(url.pathname==='/api/reports')return route.fulfill({json:{data:[report],meta:{totalPages:1},filters:{posts:[]}}});
    return route.fulfill({json:{unread:0}});
  });
  await page.goto('/semakan?report=19');
  const category=page.getByRole('combobox',{name:'Kategori disahkan (pilihan)',exact:true});
  await expect(category).toHaveValue('');
  await category.selectOption('Kerosakan Kemudahan');
  await page.getByLabel('Tidak perlu tindakan susulan',{exact:true}).check();
  await page.getByRole('button',{name:'Lulus',exact:true}).click();
  await page.getByRole('dialog',{name:'Luluskan laporan?'}).getByRole('button',{name:'Luluskan',exact:true}).click();
  await expect.poll(()=>payload?.confirmedCategory).toBe('Kerosakan Kemudahan');
  expect(payload.requiresFollowUp).toBe(false);
  await expect(page.getByText('Kategori disahkan Ketua Pengawal:',{exact:false})).toBeVisible();
  await expect(page.getByRole('link',{name:'Analisis laporan',exact:true})).toHaveCount(0);
});
