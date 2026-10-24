export const emptyFilters = { zone: '', post: '', mapping: 'all', risk: '', category: '', report_status: '', action_status: '' };
export function klDay(value = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value); }
export function dateRange(today, days) { const date = new Date(`${today}T00:00:00Z`); date.setUTCDate(date.getUTCDate() - days + 1); return { from: date.toISOString().slice(0,10), to: today }; }
