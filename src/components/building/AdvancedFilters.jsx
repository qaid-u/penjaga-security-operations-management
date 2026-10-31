import { Button, Field, Select } from '../ui';
import { apiMessage } from './operationalIndicators';
import { klDay, dateRange } from './operationalFilters';

export function AdvancedFilters({ data, filters, change, mode, operations, period, setPeriod, onZone, reset }) {
  const incident = mode === 'incidents' || mode === 'followup';
  const refs = operations.references;
  const field = (key, label, options) => <Field label={label}><Select value={filters[key]} onChange={(e) => change(key, e.target.value)}>{options.map(([value,label]) => <option value={value} key={value}>{label}</option>)}</Select></Field>;
  return <section className="app-surface rounded-2xl border p-4">
    <div className="grid gap-3 sm:grid-cols-2 items-end">
      <Field label="Pos keselamatan bangunan"><Select value={filters.zone} onChange={(e) => onZone(e.target.value)}><option value="">Semua pos bangunan ini</option>{data.hotspots.map((post) => <option key={post.id} value={post.id}>{post.name}</option>)}</Select></Field>
      <p className="text-xs">Model eksterior sahaja. Aras pos mengikut senarai rasmi; kedudukan dalaman belum disahkan. Penanda berlabel anggaran ialah proksi visual, bukan lokasi tepat.</p>
    </div>
    <p className="mt-2 text-xs" aria-live="polite">Penapis aktif: {filters.mapping === 'all' ? 'semua pos' : filters.mapping === 'linked' ? 'pos dipautkan' : 'pos tanpa pautan'}{filters.post && ` · pos #${filters.post}`}{incident && [filters.risk,filters.category,filters.report_status,filters.action_status].filter(Boolean).map((v) => ` · ${v}`).join('')}</p>
    <details className="mt-3">
    <summary className="cursor-pointer font-semibold">Penapis lanjutan & julat pantas</summary>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {field('mapping','Pemetaan pos',[['all','Semua pos (termasuk tanpa pautan)'],['linked','Pos dipautkan'],['unlinked','Pos tanpa pautan 3D']])}
      {field('post','Pos kawalan',[['','Semua pos'],...(refs.data?.posts || []).map((p) => [String(p.id_pos),`${p.nama_pos}${p.status_pos !== 'Aktif' ? ' (tidak aktif)' : ''}`])])}
      {incident && <>
        {field('risk','Tahap risiko',[['','Semua klasifikasi'],...['Low','Medium','High','Critical','Unknown'].map((v) => [v,v]),['HighCritical','High / Critical']])}
        {field('category','Kategori NLP',[['','Semua kategori'],...(refs.data?.categories || []).map((v) => [v,v])])}
        {field('report_status','Status laporan',[['','Semua status'],...['Dihantar','Diluluskan','Ditolak'].map((v) => [v,v])])}
        {field('action_status','Status tindakan',[['','Semua tindakan'],...['Baru','Dalam Tindakan','Selesai'].map((v) => [v,v])])}
      </>}
    </div>
    {refs.isError && <p role="alert" className="mt-2 text-sm">Pilihan pos/kategori: {apiMessage(refs.error)}</p>}
    <div className="mt-3 flex flex-wrap gap-2" aria-label="Julat tarikh pantas">{[[1,'Hari ini'],[7,'7 hari terakhir'],[30,'30 hari terakhir']].map(([days,label]) => <Button key={days} variant="ghost" onClick={() => setPeriod({ ...period, ...dateRange(refs.data?.today || klDay(), days) })}>{label}</Button>)}<Button variant="ghost" onClick={reset}>Tetapkan semula penapis</Button></div>
    <p className="mt-3 text-xs">Julat tersuai: gunakan Laporan dari / hingga. Tarikh MYT (Asia/Kuala_Lumpur). Penapis laporan hanya menapis laporan dan tindakan berkaitan; jadual menggunakan tarikh tugas.</p>
    </details>
  </section>;
}
