import {test,expect} from '@playwright/test';
const report={id_laporan:91,tajuk_laporan:'Pemeriksaan petang',kandungan_laporan:'Lampu rosak di laluan pejabat. Unit fasiliti dimaklumkan.',tarikh_laporan:'2026-11-02',nama_pos:'Pos Ujian',status_laporan:'Dihantar'};
const analysis={id_nlp:121,id_laporan:91,kategori_dikesan:'Kerosakan Kemudahan',tahap_risiko:'Medium',skor_risiko:50,metadata:{model:{version:'hidden-model-version'},review:{status:'pending'}}};
async function setup(page,role,handler=()=>false){
  const requests=[];
  await page.addInitScript(role=>{localStorage.setItem('token','synthetic-classification');localStorage.setItem('penjaga_user',JSON.stringify({id_pengguna:3,nama_penuh:'Test Operator',nama_peranan:role}));},role);
  await page.route(url=>url.pathname.startsWith('/api/'),async route=>{
    const url=new URL(route.request().url());requests.push(url.pathname);
    if(await handler(route,url))return;
    if(url.pathname==='/api/meta')return route.fulfill({json:{posts:[{id_pos:1,nama_pos:'Pos Ujian'}],categories:[],checklist:[],guards:[]}});
    if(url.pathname==='/api/reports')return route.fulfill({json:{data:[report],meta:{total:1,totalPages:1},filters:{posts:[]}}});
    if(url.pathname==='/api/reports/91')return route.fulfill({json:{report,analysis,analysisJob:{status:'completed'},checklist:[],reviews:[],actions:[]}});
    if(url.pathname==='/api/reports/91/analysis')return route.fulfill({json:{analysis,job:{status:'completed'}}});
    return route.fulfill({json:{unread:0}});
  });return requests;
}
test('admin NLP bookmark redirects to report monitoring and technical navigation is removed',async({page})=>{
  const requests=await setup(page,'Pentadbir Sistem');await page.goto('/nlp');await expect(page).toHaveURL(/\/semakan$/);
  await page.getByText('Pengurusan',{exact:true}).click();await expect(page.getByRole('link',{name:'Analisis laporan',exact:true})).toHaveCount(0);
  expect(requests.some(path=>path.startsWith('/api/nlp'))).toBe(false);
});
test('report classification arrives automatically without model or review controls',async({page},info)=>{
  let polls=0;await setup(page,'Pentadbir Sistem',async(route,url)=>{
    if(url.pathname==='/api/reports/91'){await route.fulfill({json:{report,analysis:null,analysisJob:{status:'pending'},checklist:[],reviews:[],actions:[]}});return true;}
    if(url.pathname==='/api/reports/91/analysis'){polls++;await route.fulfill({json:polls===1?{analysis:null,job:{status:'processing'}}:{analysis,job:{status:'completed'}}});return true;}return false;
  });await page.goto('/semakan?report=91');const panel=page.getByRole('region',{name:'Klasifikasi automatik'});
  await expect(panel.getByText(/sedang dikenal pasti/)).toBeVisible();await expect(panel.getByText('Kerosakan Kemudahan',{exact:true})).toBeVisible({timeout:12000});
  await expect(panel.getByText('Medium',{exact:true})).toBeVisible();expect(await panel.innerText()).not.toMatch(/Gemini|NLP|confidence|hidden-model-version|%/);
  await expect(page.getByRole('button',{name:'Luluskan',exact:true})).toHaveCount(0);
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:info.outputPath('classification-mobile.png'),fullPage:true});
});
test('guard sends the report without running or configuring an analysis tool',async({page})=>{
  let posted='';const requests=await setup(page,'Pengawal Keselamatan',async(route,url)=>{
    if(url.pathname==='/api/reports'&&route.request().method()==='POST'){posted=route.request().postData();await route.fulfill({status:201,json:{report,analysis,analysisJob:{status:'completed'}}});return true;}return false;
  });await page.goto('/laporan');await page.getByRole('combobox',{name:'Pos kawalan',exact:true}).selectOption('1');await page.getByLabel('Kandungan laporan',{exact:true}).fill(report.kandungan_laporan);await page.getByLabel('Tajuk laporan',{exact:true}).fill(report.tajuk_laporan);
  await page.getByRole('button',{name:'Hantar laporan',exact:true}).click();await expect(page.getByRole('region',{name:'Klasifikasi automatik'}).getByText('Kerosakan Kemudahan',{exact:true})).toBeVisible();
  expect(posted).toContain(report.kandungan_laporan);expect(posted).not.toContain('nlp_context');expect(requests.some(path=>path.includes('/assist'))).toBe(false);
});
