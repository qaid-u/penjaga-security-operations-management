import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, FileText, ArrowRight } from 'lucide-react';
import api from '../api/axios';
import { PageHeader, Card, Button, Badge, LoadingState, EmptyState, AlertMessage } from '../components/ui';

export function GuardDashboard() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ['guard-dashboard'], queryFn: async () => (await api.get('/dashboard/guard')).data });
  return <div className="space-y-6">
    <PageHeader title="Tugasan saya" description="Semak jadual anda dan rekodkan laporan selepas bertugas." />
    {isPending ? <LoadingState message="Memuatkan tugasan..." /> : isError ? <Card><AlertMessage>Tugasan belum dapat dimuatkan.</AlertMessage><Button className="mt-3" variant="ghost" onClick={() => refetch()}>Cuba lagi</Button></Card> : <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link to="/jadual" className="workspace-metric"><span className="workspace-metric-top"><CalendarDays size={20} />Tugasan hari ini</span><strong>{data.today?.tugasan_hari_ini ?? 0}</strong><small>Semak jadual & rekod kehadiran<ArrowRight size={16} /></small></Link>
        <Link to="/laporan" className="workspace-metric"><span className="workspace-metric-top"><FileText size={20} />Laporan hari ini</span><strong>{data.today?.laporan_dihantar ?? 0}</strong><small>Tulis laporan harian<ArrowRight size={16} /></small></Link>
      </div>
      <Card title="Jadual akan datang" action={<Link to="/jadual" className="workspace-text-link">Lihat jadual saya</Link>}>
        {data.duty?.length ? data.duty.map(d => <Link to="/jadual" key={d.id_jadual} className="workspace-report-row"><div><strong>{d.nama_pos}</strong><p>{d.tarikh_tugas?.slice(0, 10)} · {d.syif} · {d.masa_mula?.slice(0,5)} – {d.masa_tamat?.slice(0,5)}</p></div><Badge>{d.status_kehadiran || d.status_bertugas}</Badge><ArrowRight size={16} /></Link>) : <EmptyState title="Belum ada tugasan" description="Jadual anda akan dipaparkan selepas tugasan ditetapkan oleh Ketua atau Admin." />}
      </Card>
    </>}
  </div>;
}
