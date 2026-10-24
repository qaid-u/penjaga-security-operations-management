import { Button, Field, Input, Select } from '../ui';
import { modes, apiMessage, klTimestamp } from './operationalIndicators';
export function OperationalToolbar({ period, setPeriod, mode, setMode, operations }) {
  const q = operations.overview;
  return <section className="app-surface rounded-2xl border p-4 space-y-3" aria-label="Penapis operasi">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Field label="Tarikh tugas (MYT)"><Input type="date" value={period.date} onChange={(e) => setPeriod({ ...period, date: e.target.value })} /></Field>
      <Field label="Laporan dari"><Input type="date" value={period.from} onChange={(e) => setPeriod({ ...period, from: e.target.value })} /></Field>
      <Field label="Laporan hingga"><Input type="date" value={period.to} onChange={(e) => setPeriod({ ...period, to: e.target.value })} /></Field>
      <Field label="Lapisan penanda"><Select value={mode} onChange={(e) => setMode(e.target.value)}>{Object.entries(modes).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</Select></Field>
      <Button variant="ghost" className="self-end" disabled={q.isFetching || operations.summary.isFetching} onClick={operations.refresh}>{q.isFetching || operations.summary.isFetching ? 'Memuat semula...' : 'Muat semula data'}</Button>
    </div>
    {q.isPending && <p role="status">Memuatkan snapshot operasi...</p>}
    {q.isError && <p role="alert" className="text-red-800">{apiMessage(q.error)} {q.data && 'Snapshot terdahulu mungkin lapuk.'}</p>}
    {q.data && <><p className="text-xs">Snapshot terakhir berjaya: {klTimestamp(q.data.refreshed_at)} (MYT) · {q.data.totals.linked_posts} pos dipautkan · {q.data.totals.assignments} tugasan · {q.data.totals.reports} laporan · {q.data.totals.open_actions} tindakan terbuka</p><p className="text-xs">Julat snapshot: tugas {q.data.period.date}; laporan {q.data.period.from} hingga {q.data.period.to}.</p></>}
    <div className="rounded-lg bg-slate-50 p-3 text-xs" aria-label="Petunjuk penanda"><strong>Petunjuk: {modes[mode]}.</strong>{' '}
      {mode === 'incidents' ? 'Hijau: Low · Kuning: Medium · Jingga: High · Merah: Critical. Lencana kecil: bilangan laporan pada pos, bukan taburan geografi. Tiada peta haba berterusan tanpa koordinat kejadian. Penanda menunjukkan klasifikasi tertinggi tersimpan, bukan ramalan.' : mode === 'followup' ? 'Kuning: tindakan baru / terbuka · Biru: Dalam Tindakan · Hijau: Selesai (tiada terbuka). Kiraan berkaitan laporan dalam julat dipilih.' : mode === 'coverage' ? 'Hijau: daftar masuk direkodkan · Biru: jadual atau daftar keluar direkodkan. Tiada jadual / data menggunakan kelabu. Rekod ini tidak membuktikan kedudukan fizikal pengawal.' : mode === 'attendance' ? 'Biru: rekod daftar masuk. Rekod tugasan tidak membuktikan kedudukan fizikal pengawal.' : mode === 'schedule' ? 'Biru: ada tugasan Disahkan / Dikunci. Draf dipaparkan berasingan; ketiadaan jadual bukan insiden.' : 'Biru: pautan pos tersedia.'} Kelabu: neutral / tiada data / tiada pautan. Emas: penanda dipilih; klasifikasi kekal dalam teks.
    </div>
  </section>;
}
