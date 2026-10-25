import { Button, Field, Input, Select } from '../ui';
import { modes, apiMessage, klTimestamp } from './operationalIndicators';
export function OperationalToolbar({ period, setPeriod, mode, setMode, operations }) {
  const q = operations.overview;
  return <section className="app-surface rounded-2xl border p-4 space-y-3" aria-label="Penapis operasi">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Field label="Tarikh tugas (MYT)"><Input type="date" value={period.date} onChange={(e) => setPeriod({ ...period, date: e.target.value })} /></Field>
      <Field label="Laporan dari"><Input type="date" value={period.from} onChange={(e) => setPeriod({ ...period, from: e.target.value })} /></Field>
      <Field label="Laporan hingga"><Input type="date" value={period.to} onChange={(e) => setPeriod({ ...period, to: e.target.value })} /></Field>
      <Field label="Paparan operasi"><Select value={mode} onChange={(e) => setMode(e.target.value)}>{Object.entries(modes).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</Select></Field>
      <Button variant="ghost" className="self-end" disabled={q.isFetching || operations.summary.isFetching} onClick={operations.refresh}>{q.isFetching || operations.summary.isFetching ? 'Memuat semula...' : 'Muat semula data'}</Button>
    </div>
    {q.isPending && <p role="status">Memuatkan snapshot operasi...</p>}
    {q.isError && <p role="alert" className="text-red-800">{apiMessage(q.error)} {q.data && 'Snapshot terdahulu mungkin lapuk.'}</p>}
    {q.data && <><p className="text-xs">Snapshot terakhir berjaya: {klTimestamp(q.data.refreshed_at)} (MYT) · {q.data.totals.linked_posts} pos dipautkan · {q.data.totals.assignments} tugasan · {q.data.totals.reports} laporan · {q.data.totals.open_actions} tindakan terbuka</p><p className="text-xs">Julat snapshot: tugas {q.data.period.date}; laporan {q.data.period.from} hingga {q.data.period.to}.</p></>}
    <div className="rounded-lg bg-slate-50 p-3 text-xs" aria-label="Petunjuk operasi"><strong>Petunjuk: {modes[mode]}.</strong>{' '}
      {mode === 'incidents' ? 'Low / Medium / High / Critical ialah klasifikasi NLP tersimpan bagi laporan pada pos, bukan ramalan atau taburan geografi.' : mode === 'followup' ? 'Baru / Dalam Tindakan / Selesai ialah status tindakan berkaitan laporan dalam julat dipilih.' : mode === 'coverage' ? 'Rekod jadual dan daftar masuk / keluar menunjukkan aktiviti operasi, bukan kedudukan fizikal pengawal.' : mode === 'attendance' ? 'Daftar masuk / keluar ialah rekod kehadiran, bukan kedudukan fizikal pengawal.' : mode === 'schedule' ? 'Tugasan Disahkan / Dikunci dan Draf dipaparkan berasingan. Ketiadaan jadual bukan insiden.' : 'Pautan pos menghubungkan rekod operasi kepada pos rasmi.'} Kedudukan 3D pos belum disahkan; status dipaparkan dalam senarai dan panel maklumat.
    </div>
  </section>;
}
