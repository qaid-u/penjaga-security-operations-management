import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, ExternalLink, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { Badge, Button, Card, Field, Input } from './ui';
import './nlp.css';

const todayInMalaysia = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export function ShiftBriefing() {
  const [date, setDate] = useState(todayInMalaysia);
  const [expanded, setExpanded] = useState(false);
  const briefing = useQuery({
    queryKey: ['shiftBriefing', date],
    queryFn: async () => (await api.get('/reports/briefing', { params: { date } })).data,
    enabled: /^\d{4}-\d{2}-\d{2}$/.test(date),
    retry: false,
    staleTime: 30000,
  });
  const items = Array.isArray(briefing.data?.items) ? briefing.data.items : [];
  const visible = expanded ? items : items.slice(0, 5);
  return <Card title="Ringkasan syif" className="nlp-briefing" action={<ClipboardList size={20} className="text-[var(--color-brand-navy)]" aria-hidden="true" />}>
    <div className="flex flex-wrap items-end justify-between gap-3">
      <p className="max-w-2xl text-sm leading-relaxed text-secondary-token">Baca laporan pada tarikh pilihan dan buka sumber asal untuk semakan atau serahan tugas.</p>
      <div className="flex items-end gap-2"><Field label="Tarikh ringkasan (MYT)"><Input type="date" value={date} min="1900-01-01" max="2100-12-31" onChange={(event) => { setDate(event.target.value); setExpanded(false); }} /></Field><Button type="button" variant="ghost" aria-label="Muat semula ringkasan syif" disabled={!date || briefing.isFetching} onClick={() => briefing.refetch()}><RefreshCw size={16} className={briefing.isFetching ? 'nlp-loading-icon' : ''} /></Button></div>
    </div>
    {!date && <p className="nlp-helper-hint">Pilih tarikh untuk membuka ringkasan rekod.</p>}
    {date && briefing.isPending && <p className="nlp-helper-hint py-5" role="status">Menyediakan ringkasan syif…</p>}
    {briefing.isError && <div className="nlp-processing nlp-processing-warning mt-4" role="status"><div><strong>Ringkasan belum dapat dimuatkan</strong><p>Modul laporan masih boleh dibuka seperti biasa. Cuba muat semula apabila sambungan tersedia.</p><Button type="button" variant="ghost" className="mt-2" disabled={briefing.isFetching} onClick={() => briefing.refetch()}>Cuba lagi</Button></div></div>}
    {briefing.isSuccess && !items.length && <p className="nlp-helper-hint py-5">Tiada laporan direkodkan untuk tarikh ini. Ini tidak mengesahkan keadaan fizikal di lokasi.</p>}
    {!!visible.length && <ol className="nlp-briefing-list">{visible.map((item) => <li key={item.id_laporan}>
      <div className="nlp-briefing-item-heading"><div><Link to={`/semakan?report=${item.id_laporan}`} className="font-semibold text-primary-token underline decoration-slate-300 underline-offset-4">{item.tajuk_laporan}</Link><p className="text-data mt-1">Laporan #{item.id_laporan} · {item.nama_pos || 'Pos tidak dinyatakan'}</p></div><div className="flex flex-wrap gap-2"><Badge tone={item.tahap_risiko}>{item.tahap_risiko || 'Unknown'}</Badge>{item.review_status === 'needs_review' && <Badge tone="Medium">Perlu semakan AI</Badge>}</div></div>
      <p className="mt-2 text-sm leading-relaxed">{item.ringkasan_automatik || 'Ringkasan automatik belum tersedia. Baca laporan asal untuk butiran.'}</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-secondary-token"><p>{item.status_laporan || 'Status belum tersedia'}{Number.isInteger(Number(item.open_actions)) && Number(item.open_actions) > 0 ? ` · ${Number(item.open_actions)} tindakan terbuka berkaitan` : ''}</p><Link to={`/semakan?report=${item.id_laporan}`} className="nlp-related-link !mt-0">Baca laporan <ExternalLink size={13} aria-hidden="true" /></Link></div>
    </li>)}</ol>}
    {items.length > 5 && <Button type="button" variant="ghost" className="mt-4" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>{expanded ? 'Ringkaskan senarai' : `Lihat semua ${items.length} laporan`}</Button>}
    {briefing.isSuccess && <p className="nlp-helper-hint border-t pt-3">{briefing.data.notice || 'Ringkasan ini merangkumi laporan pada tarikh pilihan sahaja. Tindakan terbuka yang ditunjukkan berkaitan dengan laporan tersebut; ia bukan keseluruhan tunggakan operasi.'}{briefing.data.limit && ` Maksimum ${briefing.data.limit} laporan.`}</p>}
  </Card>;
}
