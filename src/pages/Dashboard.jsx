import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileCheck, CalendarDays, ClipboardCheck, Bell, Brain } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '../api/axios';
import { ROLE, riskColors } from '../utils/helpers';
import { PageHeader, Card, ActionTile, StatCard, Badge, Button, FilterPanel, Input, Select, LoadingState, EmptyState } from '../components/ui';

export function Dashboard({ auth }) {
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState({ posts: [] });
  const [filters, setFilters] = useState({ date: '', location: '', risk: '' });
  const navigate = useNavigate();
  const load = useCallback(() => api.get('/dashboard', { params: filters }).then((res) => setData(res.data)), [filters]);
  useEffect(() => { api.get('/meta').then((res) => setMeta(res.data)); }, []);
  useEffect(() => { load(); }, [load]);
  if (!data) return <LoadingState message="Memuatkan dashboard..." />;
  const isChief = auth.user?.nama_peranan === ROLE.chief;
  const isAdmin = auth.user?.nama_peranan === ROLE.admin;
  const analyticCards = [
    ['Total laporan harian', data.cards.total_laporan],
    ['Laporan berisiko tinggi', data.cards.risiko_tinggi],
    ['Tindakan belum selesai', data.cards.tindakan_belum_selesai],
    ['Laporan dengan bukti', data.cards.laporan_berlampiran],
  ];
  const chiefCards = [
    ['Laporan menunggu', data.priority.laporan_menunggu_semakan],
    ['Laporan kritikal', data.priority.laporan_kritikal_menunggu],
    ['Tindakan terbuka', data.priority.tindakan_terbuka],
    ['Jadual hari ini', data.cards.jadual_hari_ini],
  ];
  if (isChief) {
    return (
      <div className="desktop-ops space-y-5">
        <PageHeader title="Dashboard Ketua Pengawal" description="Fokus kepada laporan yang perlu disemak, tugasan jadual dan komunikasi tindakan susulan." action={<Button variant="ghost" onClick={() => navigate('/semakan')}><FileCheck size={16} /> Semakan Laporan</Button>} />
        <Card title="Tindakan Ketua Hari Ini">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ActionTile title="Laporan Menunggu Semakan" value={data.priority.laporan_menunggu_semakan} description="Lulus/tolak laporan dan tentukan tindakan susulan." tone={data.priority.laporan_menunggu_semakan > 0 ? 'urgent' : 'default'} action={() => navigate('/semakan')} />
            <ActionTile title="Laporan Kritikal" value={data.priority.laporan_kritikal_menunggu} description="High/Critical yang perlu didahulukan." tone={data.priority.laporan_kritikal_menunggu > 0 ? 'urgent' : 'default'} action={() => navigate('/semakan')} />
            <ActionTile title="Kemaskini Tindakan" value={data.priority.permintaan_kemaskini_ketua} description="Permintaan Admin yang menunggu maklum balas Ketua." tone={data.priority.permintaan_kemaskini_ketua > 0 ? 'urgent' : 'default'} action={() => navigate('/tindakan')} />
            <ActionTile title="Jadual Bertugas" value={data.cards.jadual_hari_ini} description="Semak tugasan dan liputan pos hari ini." action={() => navigate('/jadual')} />
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{chiefCards.map(([label, value]) => <StatCard key={label} label={label} value={value} />)}</div>
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Laporan Risiko Perlu Perhatian">
            {data.latest.length ? data.latest.map((item) => <div key={item.id_laporan} className="app-row mb-2 flex items-center justify-between gap-3 rounded-md border p-3 text-sm"><span>{item.tajuk_laporan} - {item.nama_pos}</span><Badge tone={item.tahap_risiko}>{item.tahap_risiko}</Badge></div>) : <EmptyState title="Tiada laporan kritikal" description="Laporan risiko tinggi akan dipaparkan di sini." />}
          </Card>
          <Card title="Akses Pantas">
            <div className="grid gap-2">
              <Button variant="ghost" onClick={() => navigate('/semakan')}><FileCheck size={16} /> Semak laporan masuk</Button>
              <Button variant="ghost" onClick={() => navigate('/jadual')}><CalendarDays size={16} /> Urus jadual bertugas</Button>
              <Button variant="ghost" onClick={() => navigate('/tindakan')}><ClipboardCheck size={16} /> Balas kemaskini tindakan</Button>
              <Button variant="ghost" onClick={() => navigate('/notifikasi')}><Bell size={16} /> Buka notifikasi</Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }
  return (
    <div className="desktop-ops space-y-5">
      <PageHeader title="Dashboard Analitik Admin" description="Pantau trend laporan, taburan risiko, tindakan susulan dan prestasi NLP operasi." action={<Button variant="ghost" onClick={() => navigate('/nlp')}><Brain size={16} /> Analisis NLP</Button>} />
      <FilterPanel>
        <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-[180px_1fr_180px]">
          <Input type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} />
          <Select value={filters.location} onChange={(e) => setFilters({ ...filters, location: e.target.value })}><option value="">Semua lokasi</option>{meta.posts.map((p) => <option key={p.id_pos} value={p.id_pos}>{p.nama_pos}</option>)}</Select>
          <Select value={filters.risk} onChange={(e) => setFilters({ ...filters, risk: e.target.value })}><option value="">Semua risiko</option><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></Select>
        </div>
      </FilterPanel>
      <Card title="Tindakan Perlu Dibuat">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {isAdmin && <ActionTile title="Perlu Tindakan Admin" value={data.priority.laporan_perlu_tindakan} description="Laporan diluluskan Ketua tetapi belum ada tindakan susulan." tone={data.priority.laporan_perlu_tindakan > 0 ? 'urgent' : 'default'} action={() => navigate('/tindakan')} />}
          <ActionTile title="Tindakan Terbuka" value={data.priority.tindakan_terbuka} description="Isu susulan yang masih belum selesai." tone={data.priority.tindakan_terbuka > 0 ? 'urgent' : 'default'} action={() => navigate('/tindakan')} />
          <ActionTile title="Permintaan Kemaskini" value={data.priority.permintaan_kemaskini_ketua} description="Permintaan Admin kepada Ketua yang masih aktif." action={() => navigate('/tindakan')} />
          <ActionTile title="Notifikasi Baharu" value={data.priority.notifikasi_belum_dibaca} description="Makluman sistem yang belum dibaca." action={() => navigate('/notifikasi')} />
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{analyticCards.map(([label, value]) => <StatCard key={label} label={label} value={value} />)}</div>
      <div className="grid gap-4 xl:grid-cols-[1fr_1fr_0.9fr]">
        <Card title="Kategori Insiden">
          <ResponsiveContainer width="100%" height={240}><BarChart data={data.byCategory}><CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} /><YAxis allowDecimals={false} tick={{ fill: 'var(--color-text-secondary)' }} /><Tooltip /><Bar dataKey="value" fill="var(--color-brand-navy)" /></BarChart></ResponsiveContainer>
        </Card>
        <Card title="Taburan Risiko">
          <ResponsiveContainer width="100%" height={240}><PieChart><Pie data={data.byRisk} dataKey="value" nameKey="name" outerRadius={86} label>{data.byRisk.map((entry) => <Cell key={entry.name} fill={riskColors[entry.name] || 'var(--color-risk-info)'} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
        </Card>
        <Card title="Trend Laporan Mengikut Tarikh" className="xl:col-span-1">
          <ResponsiveContainer width="100%" height={240}><LineChart data={data.trend}><CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" /><XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} /><YAxis allowDecimals={false} tick={{ fill: 'var(--color-text-secondary)' }} /><Tooltip /><Line type="monotone" dataKey="laporan" stroke="var(--color-brand-gold)" strokeWidth={2} /></LineChart></ResponsiveContainer>
        </Card>
        <Card title="Ringkasan Kata Kunci NLP" className="xl:col-span-3">
          <div className="flex flex-wrap gap-2">{data.keywords.map((item) => <Badge key={item.keyword}>{item.keyword} ({item.value})</Badge>)}</div>
          <div className="mt-5 grid gap-2 xl:grid-cols-2">{data.latest.map((item) => <div key={item.id_laporan} className="app-row flex items-center justify-between rounded-md border p-3 text-sm"><span>{item.tajuk_laporan} - {item.nama_pos}</span><Badge tone={item.tahap_risiko}>{item.tahap_risiko}</Badge></div>)}</div>
        </Card>
      </div>
    </div>
  );
}
