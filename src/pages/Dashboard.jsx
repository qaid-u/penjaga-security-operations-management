import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarDays, ClipboardCheck, FileCheck } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '../api/axios';
import { ShiftBriefing } from '../components/ShiftBriefing';
import { ROLE, riskColors } from '../utils/helpers';
import { PageHeader, Card, StatCard, Badge, Button, Field, Input, Select, LoadingState, EmptyState, AlertMessage } from '../components/ui';
import buildingPhoto from '../assets/johor-government-bg.jpg';

export function Dashboard({ auth }) {
  const [view, setView] = useState('overview');
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [filters, setFilters] = useState({ date: '', location: '', risk: '' });
  const params = view === 'analytics' ? filters : {};
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ['dashboard', params], queryFn: async () => (await api.get('/dashboard', { params })).data });
  const { data: meta } = useQuery({ queryKey: ['meta'], queryFn: async () => (await api.get('/meta')).data, enabled: view === 'analytics' });
  const isChief = auth.user?.nama_peranan === ROLE.chief;
  const priority = data?.priority || {};
  const metrics = [
    { label: isChief ? 'Menunggu semakan' : 'Perlu tindakan baharu', value: isChief ? priority.laporan_menunggu_semakan : priority.laporan_perlu_tindakan, to: isChief ? '/semakan' : '/tindakan', hint: isChief ? 'Semak laporan masuk' : 'Urus laporan diluluskan', icon: FileCheck },
    { label: 'Tindakan terbuka', value: priority.tindakan_terbuka, to: '/tindakan', hint: 'Lihat kemajuan tindakan', icon: ClipboardCheck },
    { label: 'Tugasan hari ini', value: data?.cards?.jadual_hari_ini, to: '/jadual', hint: 'Semak jadual & liputan', icon: CalendarDays },
  ];
  return <div className="desktop-ops space-y-6">
    <PageHeader title="Ringkasan operasi" description="Mulakan dengan perkara yang memerlukan perhatian anda." />
    {!isChief && <div className="workspace-tabs" aria-label="Paparan ringkasan">
      <button aria-pressed={view === 'overview'} onClick={() => setView('overview')}>Operasi semasa</button>
      <button aria-pressed={view === 'analytics'} onClick={() => setView('analytics')}>Statistik & trend</button>
    </div>}
    {view === 'analytics' && <Card title="Tapis statistik">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Tarikh laporan"><Input type="date" value={filters.date} onChange={e => setFilters({ ...filters, date: e.target.value })} /></Field>
        <Field label="Pos kawalan"><Select value={filters.location} onChange={e => setFilters({ ...filters, location: e.target.value })}><option value="">Semua pos</option>{(meta?.posts || []).map(p => <option key={p.id_pos} value={p.id_pos}>{p.nama_pos}</option>)}</Select></Field>
        <Field label="Tahap risiko"><Select value={filters.risk} onChange={e => setFilters({ ...filters, risk: e.target.value })}><option value="">Semua risiko</option>{['Low','Medium','High','Critical'].map(r => <option key={r}>{r}</option>)}</Select></Field>
      </div>
      {Object.values(filters).some(Boolean) && <Button className="mt-4" variant="ghost" onClick={() => setFilters({ date: '', location: '', risk: '' })}>Kosongkan penapis</Button>}
    </Card>}
    {isPending ? <LoadingState message="Memuatkan ringkasan operasi..." /> : isError ? <Card><AlertMessage>Ringkasan belum dapat dimuatkan.</AlertMessage><Button className="mt-3" variant="ghost" onClick={() => refetch()}>Cuba lagi</Button></Card> : <>
      {view === 'overview' ? <>
        <div className="workspace-metrics">{metrics.map(({ label, value, to, hint, icon: Icon }, index) => <Link to={to} key={label} className={`workspace-metric ${index === 0 && Number(value) > 0 ? 'is-priority' : ''}`}>
          <span className="workspace-metric-top"><Icon size={18} />{label}</span><strong>{value ?? 0}</strong><small>{hint}<ArrowRight size={15} /></small>
        </Link>)}</div>
        {Number(priority.laporan_kritikal_menunggu) > 0 && <p className="workspace-note"><Badge tone="High">Perlu perhatian</Badge> {priority.laporan_kritikal_menunggu} laporan High/Critical menunggu semakan. <Link className="workspace-text-link" to="/semakan">Buka laporan</Link></p>}
        <div className="workspace-overview-grid">
          <Card title="Laporan terkini" action={<Link className="workspace-text-link" to="/semakan">Lihat semua</Link>}>
            {(data.latest || []).length ? data.latest.slice(0, 5).map(item => <Link key={item.id_laporan} to={`/semakan?report=${item.id_laporan}`} className="workspace-report-row"><div><strong>{item.tajuk_laporan}</strong><p>{item.nama_pos} · {item.tarikh_laporan?.slice(0, 10)}</p></div><Badge tone={item.tahap_risiko}>{item.tahap_risiko || 'Belum dianalisis'}</Badge><ArrowRight size={16} /></Link>) : <EmptyState title="Belum ada laporan" description="Laporan baharu akan dipaparkan di sini." />}
          </Card>
          <div className="space-y-5">
            <Link to="/3d-command-centre" className="workspace-map-link"><img src={buildingPhoto} alt="Bangunan pentadbiran Johor" /><h2>Terokai pos dalam 3D</h2><p>Lihat lokasi pos dan rekod operasi dalam satu paparan bangunan.</p><span>Buka pusat kawalan <ArrowRight size={16} /></span></Link>
            <div className="workspace-note space-y-3">
              <p><Link to="/tindakan" className="workspace-text-link">{priority.permintaan_kemaskini_ketua ?? 0} permintaan kemas kini tindakan</Link></p>
              <p><Link to="/notifikasi" className="workspace-text-link">{priority.notifikasi_belum_dibaca ?? 0} notifikasi belum dibaca</Link></p>
            </div>
          </div>
        </div>
        <details className="workspace-disclosure" onToggle={event => setBriefingOpen(event.currentTarget.open)}><summary>Taklimat syif <small>Ringkasan tambahan untuk serahan tugas</small></summary>{briefingOpen && <ShiftBriefing />}</details>
        <p className="workspace-note">Maklumat berdasarkan rekod sistem; bukan pengesahan keadaan fizikal di pos.</p>
      </> : <>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">{[['Jumlah laporan', data.cards?.total_laporan], ['Laporan High/Critical', data.cards?.risiko_tinggi], ['Laporan berlampiran', data.cards?.laporan_berlampiran]].map(([label, value]) => <StatCard key={label} label={label} value={value ?? 0} />)}</div>
        <div className="grid gap-5 xl:grid-cols-2">
          <Card title="Kategori insiden"><ResponsiveContainer width="100%" height={260}><BarChart data={data.byCategory || []}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" name="Laporan" fill="#376b80" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer></Card>
          <Card title="Taburan risiko"><ResponsiveContainer width="100%" height={260}><PieChart><Pie data={data.byRisk || []} dataKey="value" nameKey="name" outerRadius={88} innerRadius={52} paddingAngle={3} label>{(data.byRisk || []).map(item => <Cell key={item.name} fill={riskColors[item.name] || '#94a3b8'} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="flex flex-wrap gap-2">{(data.byRisk || []).map(item => <Badge key={item.name} tone={item.name}>{item.name}: {item.value}</Badge>)}</div></Card>
          <Card title="Trend laporan · 7 hari" className="xl:col-span-2"><ResponsiveContainer width="100%" height={240}><LineChart data={data.trend || []}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey="laporan" name="Laporan" stroke="#267c88" strokeWidth={2} /></LineChart></ResponsiveContainer></Card>
          <Card title="Kata kunci dikesan" className="xl:col-span-2"><div className="flex flex-wrap gap-2">{(data.keywords || []).map(item => <Badge key={item.keyword}>{item.keyword} ({item.value})</Badge>)}{!data.keywords?.length && <p className="workspace-note">Tiada kata kunci untuk penapis ini.</p>}</div></Card>
        </div>
      </>}
    </>}
  </div>;
}
