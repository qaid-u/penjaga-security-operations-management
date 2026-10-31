import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const counts=[4,3,7,6,5,8,3,9,5,7,4,8,9,8],previous=[3,2,4,5,4,4,3,6,4,5,5,7,6,6];
const series=counts.map((reports,i)=>({date:'2026-10-'+String(i+18).padStart(2,'0'),reports,previous:previous[i],high:[0,1,2,2,0,3,0,3,1,1,1,2,3,3][i],previous_high:[0,0,1,0,0,1,0,1,1,0,1,2,1,2][i]}));
const posts=[{id_pos:1,name:'Pos Lobi Utama',reports:23,high:8,classified:21},{id_pos:2,name:'Pos Bilik Kawalan CCTV',reports:18,high:6,classified:17},{id_pos:3,name:'Pos Tingkat 3 Pejabat Setiausaha Kerajaan',reports:15,high:4,classified:15},{id_pos:4,name:'Pos Tingkat 4 Hadapan',reports:16,high:3,classified:14},{id_pos:5,name:'Pos Pintu Masuk',reports:14,high:1,classified:13}];
const data={cards:{total_laporan:86,risiko_tinggi:22,laporan_berlampiran:58,jadual_hari_ini:14},priority:{laporan_menunggu_semakan:18,laporan_perlu_tindakan:3,tindakan_terbuka:7,laporan_kritikal_menunggu:5},byRisk:[{name:'High',value:15},{name:'Critical',value:7},{name:'Low',value:40},{name:'Medium',value:18},{name:'Unknown',value:6}],byCategory:[{name:'Kerosakan Aset',value:38},{name:'Rondaan',value:30},{name:'Lain-lain',value:18}],latest:[],trend:[],keywords:[],insights:{period:{from:'2026-10-18',to:'2026-10-31',observedTo:'2026-10-31',trendFrom:'2026-10-18',days:14,allTime:false,trendLimited:false},current:{total:86,classified:80,high:22,reviewed:68,attachments:58},previous:{total:64,classified:60,high:10,reviewed:50},comparison:{from:'2026-10-04',to:'2026-10-17',volumeChange:34.4,riskShareChange:10.8},series,posts,backlog:[{age:'0–2 hari',count:10},{age:'3–6 hari',count:5},{age:'7+ hari',count:3}]}};
async function setup(page,override=data,role='Pentadbir Sistem') {
  const requests=[],errors=[];page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(role=>{localStorage.setItem('token','synthetic-insights');localStorage.setItem('penjaga_user',JSON.stringify({id_pengguna:1,nama_penuh:'Test Operator',nama_peranan:role}));},role);
  await page.route(url=>url.pathname.startsWith('/api/'),async route=>{const url=new URL(route.request().url());requests.push(url);
    if(url.pathname==='/api/dashboard')return route.fulfill({json:override});
    if(url.pathname==='/api/meta')return route.fulfill({json:{posts:posts.map(p=>({id_pos:p.id_pos,nama_pos:p.name})),roles:[]}});
    if(url.pathname==='/api/notifications/unread-count')return route.fulfill({json:{unread:0}});
    if(url.pathname==='/api/reports')return route.fulfill({json:{data:[],meta:{total:0,totalPages:0},filters:{posts:[]}}});
    return route.fulfill({json:[]});});return {requests,errors};
}
test('decision dashboard shows denominators, comparisons and usable post drill-downs',async({page},info)=>{
  const api=await setup(page);await page.goto('/dashboard');
  await expect(page.getByText('27.5%',{exact:true})).toBeVisible();await expect(page.getByText('22 daripada 80 laporan dikelaskan',{exact:true})).toBeVisible();await expect(page.getByText('+34.4%',{exact:true})).toBeVisible();
  await expect(page.getByText('6 laporan belum dikelaskan',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'High/Critical',exact:true}).click();await expect(page.getByRole('button',{name:'High/Critical',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Jumlah laporan',exact:true}).click();
  await page.screenshot({path:info.outputPath('analytics-desktop.png'),fullPage:true});
  await page.getByRole('link').filter({hasText:'Pos Lobi Utama'}).click();await expect(page).toHaveURL(/semakan\?post=1/);
  await expect.poll(()=>api.requests.filter(u=>u.pathname==='/api/reports').at(-1)?.searchParams.get('post')).toBe('1');
  const q=api.requests.filter(u=>u.pathname==='/api/reports').at(-1).searchParams;expect(q.get('from')).toBe('2026-10-18');expect(q.get('to')).toBe('2026-10-31');expect(q.get('status')).toBe('Semua');expect(api.errors).toEqual([]);
});
test('analytics fits phone and tablet widths and supports chief users',async({page},info)=>{
  const api=await setup(page,data,'Ketua Pengawal');await page.goto('/dashboard');
  for(const width of [320,390,768]){await page.setViewportSize({width,height:844});await expect(page.locator('.ds-kpis')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
  await page.setViewportSize({width:390,height:844});await expect(page.locator('.ds-lower-grid')).toBeHidden();await page.getByRole('button',{name:'Terokai pos & usia semakan',exact:true}).click();await expect(page.locator('.ds-lower-grid')).toBeVisible();await page.getByRole('button',{name:'Tutup butiran pos & semakan',exact:true}).click();await page.screenshot({path:info.outputPath('analytics-mobile.png'),fullPage:true});expect(api.errors).toEqual([]);
});
test('empty analytics uses unavailable rates and never invents a baseline',async({page})=>{
  const empty=structuredClone(data);empty.insights.current={total:0,classified:0,high:0,reviewed:0,attachments:0};empty.insights.previous={...empty.insights.current};empty.insights.comparison.volumeChange=null;empty.insights.comparison.riskShareChange=null;empty.insights.series=[];empty.insights.posts=[];
  await setup(page,empty);await page.goto('/dashboard');await expect(page.getByText('Belum cukup data untuk dibandingkan',{exact:true})).toBeVisible();await expect(page.getByText('Asas tempoh lepas = 0',{exact:true})).toBeVisible();expect(await page.locator('.ds-kpis').innerText()).not.toMatch(/NaN|Infinity|100%/);
});
test('dashboard downloads include the analytics and observed window',async({page})=>{
  await setup(page);await page.goto('/dashboard');await page.getByRole('button',{name:'Muat turun dashboard',exact:true}).click();
  const dialog=page.getByRole('dialog');let pending=page.waitForEvent('download');await dialog.getByRole('button',{name:'Muat turun',exact:true}).click();let download=await pending;const csv=await fs.readFile(await download.path(),'utf8');expect(csv).toContain('Liputan klasifikasi');expect(csv).toContain('34.4');expect(csv).toContain('Pos Lobi Utama');expect(csv).toContain('2026-10-18');
  await page.getByRole('button',{name:'Muat turun dashboard',exact:true}).click();await dialog.getByRole('combobox',{name:'Format muat turun',exact:true}).selectOption('svg');pending=page.waitForEvent('download');await dialog.getByRole('button',{name:'Muat turun',exact:true}).click();download=await pending;const svg=await fs.readFile(await download.path(),'utf8');expect(svg).toContain('27.5%');expect(svg).toContain('2026-10-18');expect(svg).toContain('Pos Lobi Utama');
});
