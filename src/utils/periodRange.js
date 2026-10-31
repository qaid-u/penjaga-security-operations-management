export const klToday = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const iso = date => date.toISOString().slice(0,10);
export function periodRange(period, anchor, end) {
  if (period === 'current' || period === 'all') return {};
  const date = new Date(`${anchor.length === 4 ? anchor+'-01-01' : anchor.length === 7 ? anchor+'-01' : anchor}T00:00:00Z`);
  if (Number.isNaN(date.valueOf())) throw new Error('Sila pilih tempoh yang sah.');
  if (period === 'fortnight') {const to=iso(date);date.setUTCDate(date.getUTCDate()-13);return {from:iso(date),to};}
  if (period === 'week') { const day=(date.getUTCDay()+6)%7;date.setUTCDate(date.getUTCDate()-day);const from=iso(date);date.setUTCDate(date.getUTCDate()+6);return {from,to:iso(date)}; }
  if (period === 'month') { const from=iso(new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),1)));return {from,to:iso(new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)))}; }
  if (period === 'year') return {from:`${date.getUTCFullYear()}-01-01`,to:`${date.getUTCFullYear()}-12-31`};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || anchor>end) throw new Error('Tarikh mula mesti sebelum tarikh akhir.');
  return {from:anchor,to:end};
}
