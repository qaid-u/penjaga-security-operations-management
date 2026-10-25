import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileCheck, CalendarDays, ClipboardCheck, Bell, Brain, Activity } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '../api/axios';
import { ShiftBriefing } from '../components/ShiftBriefing';
import { ModelShowcase } from '../components/building/ModelShowcase';
import { ROLE, riskColors } from '../utils/helpers';
import { PageHeader, Card, ActionTile, StatCard, Badge, Button, FilterPanel, Input, Select, LoadingState, EmptyState, AlertMessage } from '../components/ui';

function LiveTickerBanner({ priority }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-l-4 border-[var(--color-brand-gold)] bg-[var(--color-brand-dark)] px-5 py-4 text-white">
    <div className="flex items-start gap-3"><Activity size={21} className="mt-0.5 shrink-0 text-[var(--color-brand-gold)]" aria-hidden="true" /><div><p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-brand-gold)]">Ringkasan rekod operasi</p><p className="mt-1 text-sm leading-relaxed text-slate-100">{Number(priority?.laporan_kritikal_menunggu) > 0 ? `${Number(priority.laporan_kritikal_menunggu)} laporan High/Critical menunggu perhatian.` : 'Tiada laporan High/Critical menunggu semakan dalam rekod yang dipaparkan.'}</p><p className="mt-1 text-xs text-slate-300">Maklumat berdasarkan rekod sistem dan penapis pilihan; bukan pengesahan keadaan fizikal di pos.</p></div></div>
  </div>;
}

export function Dashboard({ auth }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState({ posts: [] });
  const [filters, setFilters] = useState({ date: '', location: '', risk: '' });
  const navigate = useNavigate();
  const load = useCallback(() => api.get('/dashboard', { params: filters }).then((res) => { setData(res.data); setError(''); }).catch(() => setError('Dashboard belum dapat dimuatkan. Semak sambungan dan cuba sekali lagi.')), [filters]);
  useEffect(() => { api.get('/meta').then((res) => setMeta(res.data)).catch(() => setError('Pilihan pos belum dapat dimuatkan. Cuba muat semula halaman.')); }, []);
  useEffect(() => { load(); }, [load]);
  if (!data) return <div className="space-y-5"><ModelShowcase />{error ? <Card title="Dashboard"><AlertMessage>{error}</AlertMessage><Button type="button" variant="ghost" className="mt-3" onClick={load}>Cuba lagi</Button></Card> : <LoadingState message="Memuatkan pusat kawalan operasi..." />}</div>;
  const isChief = auth.user?.nama_peranan === ROLE.chief;
  const isAdmin = auth.user?.nama_peranan === ROLE.admin;

  const analyticCards = [
    ['Total Laporan Harian', data.cards.total_laporan ?? 0],
    ['Laporan Berisiko Tinggi', data.cards.risiko_tinggi ?? 0],
    ['Tindakan Belum Selesai', data.cards.tindakan_belum_selesai ?? 0],
    ['Laporan Berlampiran Bukti', data.cards.laporan_berlampiran ?? 0],
  ];

  const chiefCards = [
    ['Laporan Menunggu', data.priority?.laporan_menunggu_semakan ?? 0],
    ['Laporan Kritikal', data.priority?.laporan_kritikal_menunggu ?? 0],
    ['Tindakan Terbuka', data.priority?.tindakan_terbuka ?? 0],
    ['Jadual Hari Ini', data.cards.jadual_hari_ini ?? 0],
  ];

  if (isChief) {
    return (
      <div className="desktop-ops space-y-5">
        <PageHeader title="Dashboard Ketua Pengawal" description="Fokus kepada laporan yang perlu disemak, tugasan jadual dan komunikasi tindakan susulan." action={<Button variant="ghost" onClick={() => navigate('/semakan')}><FileCheck size={16} /> Semakan Laporan</Button>} />

        <ModelShowcase />

        {error && <AlertMessage>{error}</AlertMessage>}
        <LiveTickerBanner priority={data.priority} />
        <ShiftBriefing />

        <Card title="Tindakan Ketua Hari Ini">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ActionTile title="Laporan Menunggu Semakan" value={data.priority?.laporan_menunggu_semakan || 0} description="Lulus/tolak laporan dan tentukan tindakan susulan." tone={(data.priority?.laporan_menunggu_semakan || 0) > 0 ? 'urgent' : 'default'} action={() => navigate('/semakan')} />
            <ActionTile title="Laporan Kritikal" value={data.priority?.laporan_kritikal_menunggu || 0} description="High/Critical yang perlu didahulukan." tone={(data.priority?.laporan_kritikal_menunggu || 0) > 0 ? 'urgent' : 'default'} action={() => navigate('/semakan')} />
            <ActionTile title="Kemaskini Tindakan" value={data.priority?.permintaan_kemaskini_ketua || 0} description="Permintaan Admin yang menunggu maklum balas Ketua." tone={(data.priority?.permintaan_kemaskini_ketua || 0) > 0 ? 'urgent' : 'default'} action={() => navigate('/tindakan')} />
            <ActionTile title="Jadual Bertugas" value={data.cards.jadual_hari_ini || 0} description="Semak tugasan dan liputan pos hari ini." action={() => navigate('/jadual')} />
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{chiefCards.map(([label, value]) => <StatCard key={label} label={label} value={value} />)}</div>
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Laporan Risiko Perlu Perhatian Utama">
            {(data.latest || []).length ? data.latest.map((item) => (
              <div key={item.id_laporan} className="app-row mb-2 flex items-center justify-between gap-3 rounded-md border p-3 text-sm hover:border-amber-400 transition-colors">
                <div>
                  <p className="font-semibold text-primary-token">{item.tajuk_laporan}</p>
                  <p className="text-xs text-secondary-token">{item.nama_pos} • {item.tarikh_laporan?.slice(0,10)}</p>
                </div>
                <Badge tone={item.tahap_risiko}>{item.tahap_risiko}</Badge>
              </div>
            )) : <EmptyState title="Tiada laporan kritikal" description="Laporan risiko tinggi akan dipaparkan di sini." />}
          </Card>
          <Card title="Akses Pantas Modul">
            <div className="grid gap-2">
              <Button variant="ghost" onClick={() => navigate('/semakan')}><FileCheck size={16} /> Semak Laporan Masuk</Button>
              <Button variant="ghost" onClick={() => navigate('/jadual')}><CalendarDays size={16} /> Urus Jadual Bertugas</Button>
              <Button variant="ghost" onClick={() => navigate('/tindakan')}><ClipboardCheck size={16} /> Balas Kemaskini Tindakan</Button>
              <Button variant="ghost" onClick={() => navigate('/notifikasi')}><Bell size={16} /> Pusat Notifikasi Operasi</Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="desktop-ops space-y-5">
      <PageHeader title="Dashboard Analitik Admin" description="Pantau trend laporan, taburan risiko, tindakan susulan dan prestasi NLP operasi." action={<Button variant="ghost" onClick={() => navigate('/nlp')}><Brain size={16} /> Ringkasan & semakan NLP</Button>} />

      <ModelShowcase />

      {error && <AlertMessage>{error}</AlertMessage>}
      <LiveTickerBanner priority={data.priority} />
      <ShiftBriefing />

      <FilterPanel>
        <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-[180px_1fr_180px]">
          <Input type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} />
          <Select value={filters.location} onChange={(e) => setFilters({ ...filters, location: e.target.value })}><option value="">Semua lokasi pos kawalan</option>{meta.posts.map((p) => <option key={p.id_pos} value={p.id_pos}>{p.nama_pos}</option>)}</Select>
          <Select value={filters.risk} onChange={(e) => setFilters({ ...filters, risk: e.target.value })}><option value="">Semua tahap risiko</option><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></Select>
        </div>
      </FilterPanel>

      <Card title="Tindakan Operasi Perlu Perhatian">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {isAdmin && <ActionTile title="Perlu Tindakan Admin" value={data.priority?.laporan_perlu_tindakan || 0} description="Laporan diluluskan Ketua tetapi belum ada tindakan susulan." tone={(data.priority?.laporan_perlu_tindakan || 0) > 0 ? 'urgent' : 'default'} action={() => navigate('/tindakan')} />}
          <ActionTile title="Tindakan Terbuka" value={data.priority?.tindakan_terbuka || 0} description="Isu susulan yang masih belum selesai." tone={(data.priority?.tindakan_terbuka || 0) > 0 ? 'urgent' : 'default'} action={() => navigate('/tindakan')} />
          <ActionTile title="Permintaan Kemaskini" value={data.priority?.permintaan_kemaskini_ketua || 0} description="Permintaan Admin kepada Ketua yang masih aktif." action={() => navigate('/tindakan')} />
          <ActionTile title="Notifikasi Baharu" value={data.priority?.notifikasi_belum_dibaca || 0} description="Makluman sistem yang belum dibaca." action={() => navigate('/notifikasi')} />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{analyticCards.map(([label, value]) => <StatCard key={label} label={label} value={value} />)}</div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr_0.9fr]">
        <Card title="Analisis Kategori Insiden (NLP)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.byCategory || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
              <YAxis allowDecimals={false} tick={{ fill: 'var(--color-text-secondary)' }} />
              <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Bar dataKey="value" fill="var(--color-brand-navy)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Taburan Tahap Risiko Operations">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={data.byRisk || []} dataKey="value" nameKey="name" outerRadius={86} innerRadius={40} paddingAngle={4} label>
                {(data.byRisk || []).map((entry) => <Cell key={entry.name} fill={riskColors[entry.name] || 'var(--color-risk-info)'} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Trend Laporan Keselamatan" className="xl:col-span-1">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.trend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
              <YAxis allowDecimals={false} tick={{ fill: 'var(--color-text-secondary)' }} />
              <Tooltip />
              <Line type="monotone" dataKey="laporan" stroke="var(--color-brand-gold)" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Pengecaman Kata Kunci Risiko NLP & Laporan Terkini" className="xl:col-span-3">
          <div className="flex flex-wrap gap-2 mb-4">
            {(data.keywords || []).map((item) => (
              <Badge key={item.keyword} tone="urgent">{item.keyword} ({item.value})</Badge>
            ))}
          </div>
          <div className="grid gap-2 xl:grid-cols-2">
            {(data.latest || []).map((item) => (
              <div key={item.id_laporan} className="app-row flex items-center justify-between rounded-md border p-3 text-sm hover:border-slate-400 transition-colors">
                <div>
                  <p className="font-semibold text-primary-token">{item.tajuk_laporan}</p>
                  <p className="text-xs text-secondary-token">{item.nama_pos} • {item.tarikh_laporan?.slice(0, 10)}</p>
                </div>
                <Badge tone={item.tahap_risiko}>{item.tahap_risiko}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
