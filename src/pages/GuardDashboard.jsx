import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { PageHeader, Card, ActionTile, StatCard, LoadingState, EmptyState } from '../components/ui';

export function GuardDashboard() {
  const [data, setData] = useState(null);
  const navigate = useNavigate();
  useEffect(() => { api.get('/dashboard/guard').then((res) => setData(res.data)); }, []);
  if (!data) return <LoadingState message="Memuatkan dashboard pengawal..." />;
  const cards = [
    ['Laporan saya', data.today.laporan_dihantar || 0],
    ['Tugasan hari ini', data.today.tugasan_hari_ini || 0],
  ];
  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard Pengawal" description="Semak jadual, laporan dan status tugasan anda." />
      <Card title="Tugasan Perlu Dibuat">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ActionTile title="Tugasan Hari Ini" value={data.today.tugasan_hari_ini || 0} description="Semak pos, syif dan status bertugas anda." tone={(data.today.tugasan_hari_ini || 0) > 0 ? 'default' : 'urgent'} action={() => navigate('/jadual')} />
          <ActionTile title="Laporan Hari Ini" value={data.today.laporan_dihantar || 0} description={(data.today.laporan_dihantar || 0) > 0 ? 'Laporan harian telah direkodkan.' : 'Hantar laporan selepas tugasan/rondaan.'} tone={(data.today.laporan_dihantar || 0) > 0 ? 'default' : 'urgent'} action={() => navigate('/laporan')} />
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{cards.map(([label, value]) => <StatCard key={label} label={label} value={value} />)}</div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Status Bertugas">{data.duty && data.duty.length ? data.duty.map((d) => <div key={d.id_jadual} className="app-row mb-2 rounded-md border p-3 text-sm"><span className="font-medium text-primary-token">{d.nama_pos}</span><p>{d.tarikh_tugas?.slice(0, 10)} - {d.syif} - {d.status_bertugas}</p></div>) : <EmptyState title="Tiada jadual" description="Belum ada tugasan bertugas untuk dipaparkan." />}</Card>
      </div>
    </div>
  );
}
