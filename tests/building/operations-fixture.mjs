import { buildingHotspots } from '../../src/components/building/buildingHotspots.js';
export const locations = buildingHotspots.map((item, i) => ({ id_lokasi: 101+i, hotspot_id: item.id, nama_paparan: item.name, kawasan: item.section, label_aras: null, id_pos: null, status_aktif: true, tarikh_kemaskini: '2026-10-24T00:00:00Z' }));
export const metrics = { schedule: { assignments: 1, confirmed: 1, draft: 0 }, attendance: { checked_in: 1, checked_out: 0, no_check_in: 0, unknown: 0 }, incidents: { total: 1, Low: 0, Medium: 0, High: 1, Critical: 0, Unknown: 0 }, follow_up: { total: 1, open: 1, in_progress: 1, completed: 0 } };
export function summary(location, period, linked = false) {
  const base = { location, period, refreshed_at:'2026-10-24T01:30:00Z', linked, reason:'Belum dipautkan kepada pos kawalan', post:null };
  if (!linked) return base;
  return { ...base, post: { id_pos: 91, nama_pos:'Pos Ujian API', nama_bangunan:null, lokasi:null, waktu_operasi:null, status_pos:'Aktif' }, metrics,
    assignments:[{ id_jadual:1, nama_penuh:'Pengawal Ujian API', syif:'Malam', status_jadual:'Disahkan', status_bertugas:'Dijadualkan', starts_at:'2026-10-23T15:00:00Z', ends_at:'2026-10-24T00:00:00Z', attendance_state:'Checked In', masa_check_in:'2026-10-23T15:05:00Z', masa_check_out:null }],
    reports:[{ id_laporan:1, tajuk_laporan:'Laporan Ujian API', tarikh_laporan:'2026-10-24', status_laporan:'Dihantar', tahap_risiko:'High', kategori_dikesan:'Kategori Ujian' }],
    actions:[{ id_tindakan:1, status_tindakan:'Dalam Tindakan', tahap_keutamaan:'High', jenis_progress:'Kemaskini Ketua', tarikh_progress:'2026-10-24T01:00:00Z' }] };
}
export async function mockOperations(page, { linked = false, delayFirst = 0, failSummary = false } = {}) {
  const rows = structuredClone(locations); if (linked) rows[0].id_pos=91;
  const requests = []; let failure = failSummary;
  await page.route('**/api/3d/**', async (route) => {
    const request=route.request(); const url=new URL(request.url()); requests.push({url:url.pathname,method:request.method(),params:url.search});
    const period={date:url.searchParams.get('date'),from:url.searchParams.get('from'),to:url.searchParams.get('to')};
    if (url.pathname.endsWith('/filters')) return route.fulfill({json:{posts:[{id_pos:91,nama_pos:'Pos Ujian API',status_pos:'Aktif'}],categories:['Kategori Ujian','Unknown'],today:'2026-10-24',timezone:'Asia/Kuala_Lumpur'}});
    if (url.pathname.endsWith('/incidents')) return route.fulfill({json:{items:[],total:0,page:1,limit:20,period,refreshed_at:'2026-10-24T01:30:00Z'}});
    if (url.pathname.endsWith('/overview')) return route.fulfill({json:{period,refreshed_at:'2026-10-24T01:30:00Z',locations:rows.map((r)=>({...r,metrics:r.id_pos ? metrics:null})),totals:{locations:7,linked_posts:rows.filter((r)=>r.id_pos).length,assignments:linked?1:0,checked_in:linked?1:0,high_critical:linked?1:0,completed_actions:0,unmapped_reports:0,reports:linked?1:0,open_actions:linked?1:0}}});
    const match=url.pathname.match(/locations\/(\d+)\/(summary|mapping)/); const row=rows.find((r)=>r.id_lokasi===Number(match?.[1]));
    if (!row) return route.fulfill({status:404,json:{message:'Lokasi tidak ditemui'}});
    if (match[2]==='mapping') { row.id_pos=request.postDataJSON().id_pos; return route.fulfill({json:row}); }
    if (failure) return route.fulfill({status:500,json:{message:'Ralat ujian sementara'}});
    if (row.id_lokasi===101 && delayFirst) await new Promise((resolve)=>setTimeout(resolve,delayFirst));
    return route.fulfill({json:summary(row,period,Boolean(row.id_pos))});
  });
  return { requests, recover:()=>{failure=false;} };
}
