import {test,expect} from '@playwright/test';
for(const [risk,followUp] of [['Low',true],['Critical',false]])test(`report lifecycle follows chief decision: ${risk}, follow-up ${followUp}`,async({page},info)=>{
  const report={id_laporan:22,tajuk_laporan:'Synthetic chief decision',kandungan_laporan:'Synthetic report for workflow testing.',status_laporan:'Diluluskan',perlu_tindakan_susulan:followUp,tahap_risiko:risk,tarikh_laporan:'2026-11-02'};
  const analysis={id_nlp:23,kategori_dikesan:'Rondaan Biasa',tahap_risiko:risk};
  await page.addInitScript(()=>{localStorage.setItem('token','synthetic-flow');localStorage.setItem('penjaga_user',JSON.stringify({id_pengguna:1,nama_penuh:'Test Operator',nama_peranan:'Pentadbir Sistem'}));});
  await page.route(url=>url.pathname.startsWith('/api/'),async route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/api/reports/22')return route.fulfill({json:{report,analysis,analysisJob:{status:'completed'},reviews:[],actions:[],checklist:[]}});
    if(url.pathname==='/api/reports/22/analysis')return route.fulfill({json:{analysis,job:{status:'completed'}}});
    if(url.pathname==='/api/reports')return route.fulfill({json:{data:[report],meta:{totalPages:1},filters:{posts:[]}}});
    if(url.pathname==='/api/meta')return route.fulfill({json:{posts:[],roles:[],guards:[],categories:[],checklist:[]}});
    return route.fulfill({json:{unread:0}});
  });
  await page.goto('/semakan?report=22');const lifecycle=page.getByRole('region',{name:'Aliran status laporan'});
  if(followUp){
    await expect(lifecycle.getByText('Perlu tindakan',{exact:true})).toBeVisible();
    await expect(lifecycle.getByText('Ketua Pengawal menetapkan tindakan susulan diperlukan. Admin perlu cipta tindakan susulan.',{exact:true})).toBeVisible();
  }else{
    await expect(lifecycle.getByText('Tidak diperlukan',{exact:true})).toBeVisible();
    await expect(lifecycle.getByText('Perlu tindakan',{exact:true})).toHaveCount(0);
    await expect(lifecycle.locator('.grid > div').last()).toContainText('Selesai');
    await expect(lifecycle.locator('.grid > div').last()).toHaveClass(/status-success/);
  }
  for(const width of [320,390]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  if(followUp){await lifecycle.screenshot({path:info.outputPath('report-flow-mobile.png')});await page.getByRole('region',{name:'Klasifikasi automatik'}).screenshot({path:info.outputPath('classification-polished-mobile.png')});}
});
