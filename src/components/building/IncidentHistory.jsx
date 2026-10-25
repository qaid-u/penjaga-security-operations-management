import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Badge } from '../ui';
import { apiMessage, klTimestamp } from './operationalIndicators';

export function IncidentHistory({ query, page, setPage, onLocate, zone }) {
  const [selectedId, setSelectedId] = useState(null);
  const detailRef = useRef(null);
  const data = query.data;
  const selected = data?.items.find((r) => r.id_laporan === selectedId);
  const selectReport = (report) => {
    setSelectedId(report.id_laporan);
    const locations = zone ? report.locations.filter((l) => l.hotspot_id === zone) : report.locations;
    onLocate(locations.length === 1 ? locations[0].hotspot_id : null);
    requestAnimationFrame(() => detailRef.current?.focus({ preventScroll: true }));
  };
  return <section id="incident-history" tabIndex={-1} className="app-surface rounded-2xl border p-5 space-y-4" aria-label="Sejarah laporan">
    <h2 className="gov-card-title">Sejarah laporan</h2>
    {query.isPending && <p role="status">Memuatkan sejarah laporan...</p>}
    {query.isFetching && !query.isPending && <p role="status">Mengemas kini sejarah...</p>}
    {query.isError && <div role="alert"><p>{apiMessage(query.error)} {data && 'Senarai terdahulu mungkin lapuk.'}</p><Button variant="ghost" onClick={() => query.refetch()}>Cuba semula sejarah</Button></div>}
    {data && <>
      <p className="text-xs">{data.total} laporan · {data.period.from} hingga {data.period.to} · Snapshot {klTimestamp(data.refreshed_at)} MYT</p>
      {!data.items.length && <p>Tiada laporan sepadan dengan penapis ini.</p>}
      <ol className="grid gap-2 md:grid-cols-2">{data.items.map((r) => <li key={r.id_laporan}><button type="button" aria-pressed={selectedId === r.id_laporan} onClick={() => selectReport(r)} className={`w-full rounded-xl border p-3 text-left ${selectedId === r.id_laporan ? 'app-nav-active' : 'app-button-ghost'}`}>
        <span className="flex flex-wrap justify-between gap-2"><strong>{r.tajuk_laporan}</strong><Badge tone={r.tahap_risiko}>{r.tahap_risiko}</Badge></span>
        <span className="block text-xs mt-2">{r.tarikh_laporan} {r.masa_laporan} MYT · {r.nama_pos}<br />{r.kategori_dikesan || 'Unknown'} · {r.status_laporan}<br />Tindakan: {r.action_statuses?.join(', ') || 'Tiada'} · {r.open_actions} terbuka / {r.completed_actions} selesai<br />{r.locations.length ? r.locations.map((l) => l.nama_paparan).join(' / ') : 'Tiada pautan 3D'}</span>
      </button></li>)}</ol>
      <div className="flex flex-wrap items-center gap-3"><Button variant="ghost" disabled={page <= 1 || query.isFetching} onClick={() => { setSelectedId(null); setPage(page-1); }}>Halaman sebelumnya</Button><span>Halaman {page} / {Math.max(1,Math.ceil(data.total / data.limit))}</span><Button variant="ghost" disabled={page * data.limit >= data.total || query.isFetching} onClick={() => { setSelectedId(null); setPage(page+1); }}>Halaman seterusnya</Button></div>
      {selected && <div ref={detailRef} tabIndex={-1} className="rounded-xl border border-amber-400 p-4 space-y-2" aria-label="Butiran laporan dipilih">
        <h3>{selected.tajuk_laporan}</h3><p>{selected.nama_pos} · {selected.tahap_risiko} · {selected.status_laporan}</p>
        <p className="text-sm">{selected.open_actions} tindakan terbuka · {selected.completed_actions} selesai. Status tindakan: {selected.action_statuses?.join(', ') || 'Tiada'}. Metadata sahaja; naratif dan bukti melalui modul laporan.</p>
        {selected.locations.length ? <div className="flex flex-wrap gap-2">{selected.locations.filter((l) => !zone || l.hotspot_id === zone).map((l) => <Button key={l.id_lokasi} variant="ghost" onClick={() => onLocate(l.hotspot_id)}>Lihat pos {l.nama_paparan}</Button>)}</div> : <p>Pos ini tiada pautan 3D. Tiada kedudukan bangunan diandaikan.</p>}
        {selected.locations.length > 1 && <p className="text-xs">Pos dipautkan ke beberapa zon; pilih zon yang ingin dilihat. Lokasi kejadian tepat tidak direkodkan.</p>}
        <Link className="inline-block rounded-lg border p-3 app-button-ghost" to="/semakan">Buka modul laporan</Link><p className="text-xs">Cari laporan #{selected.id_laporan} / tajuk di modul laporan. Pautan membuka senarai umum.</p>
      </div>}
    </>}
  </section>;
}
