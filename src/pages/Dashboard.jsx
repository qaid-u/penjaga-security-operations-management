import {DashboardIntelligence} from '../components/DashboardIntelligence';
import {klToday,periodRange} from '../utils/periodRange';
import '../components/dashboard-intelligence.css';
import { ExportButton } from '../components/ExportButton';
import { PeriodControls } from '../components/PeriodControls';
import { exportDashboard } from '../utils/exportDashboard';
import { ModelShowcase } from '../components/building/ModelShowcase';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarDays, ClipboardCheck, FileCheck, BarChart3, Printer, ListChecks, RefreshCw } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '../api/axios';
import { ShiftBriefing } from '../components/ShiftBriefing';
import { ROLE, riskColors } from '../utils/helpers';
import { PageHeader, Card, StatCard, Badge, Button, Field, Select, LoadingState, EmptyState, AlertMessage } from '../components/ui';


export function Dashboard({ auth }) {
  const [periodReset,setPeriodReset] = useState(0);
  const [view, setView] = useState('overview');
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [filters, setFilters] = useState(()=>({ ...periodRange('fortnight',klToday()), date: '', location: '', risk: '' }));
  const params = filters;
  const { data, isPending, isError, refetch, isFetching, dataUpdatedAt } = useQuery({ queryKey: ['dashboard', params], queryFn: async ({signal}) => (await api.get('/dashboard', { params, signal })).data, refetchOnWindowFocus:true });
  const { data: meta } = useQuery({ queryKey: ['meta'], queryFn: async () => (await api.get('/meta')).data, enabled: true });
  const isChief = auth.user?.nama_peranan === ROLE.chief;
  const priority = data?.priority || {};
  const metrics = [
    { label: isChief ? 'Menunggu semakan' : 'Perlu tindakan baharu', value: isChief ? priority.laporan_menunggu_semakan : priority.laporan_perlu_tindakan, to: isChief ? '/semakan' : '/tindakan', hint: isChief ? 'Semak laporan masuk' : 'Urus laporan diluluskan', icon: FileCheck },
    { label: 'Tindakan terbuka', value: priority.tindakan_terbuka, to: '/tindakan', hint: 'Lihat kemajuan tindakan', icon: ClipboardCheck },
    { label: 'Tugasan hari ini', value: data?.cards?.jadual_hari_ini, to: '/jadual', hint: 'Semak jadual & liputan', icon: CalendarDays },
  ];
  return <div className="desktop-ops insights-dashboard space-y-6">
    <div className="ds-hero"><div className="ds-hero-kicker"><span/>PENJAGA / ANALITIK OPERASI<span className="ds-hero-date">{new Intl.DateTimeFormat('ms-MY',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Kuala_Lumpur'}).format(new Date())}</span></div>{dataUpdatedAt>0&&<p className="ds-refresh-time">Dikemas kini {new Intl.DateTimeFormat('ms-MY',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Kuala_Lumpur'}).format(new Date(dataUpdatedAt))} MYT</p>}<PageHeader title="Ringkasan operasi" description="Fahami corak. Kenal pasti jurang. Tentukan tindakan seterusnya." action={<><Button variant="ghost" aria-label="Muat semula dashboard" title="Muat semula dashboard" disabled={isFetching} onClick={()=>refetch()}><RefreshCw size={16} className={isFetching?'ops-spin':''}/></Button><ExportButton label="Muat turun dashboard" dashboard filters={filters} onExport={async (params,format)=>{const response=await api.get('/dashboard',{params});exportDashboard(response.data,{...params,locationLabel:meta?.posts?.find(p=>String(p.id_pos)===String(params.location))?.nama_pos},format,auth.user?.nama_peranan);}}/><Button variant="ghost" onClick={()=>window.print()}><Printer size={16}/>PDF / Cetak</Button></>}/></div>
    {<div className="workspace-tabs" aria-label="Paparan ringkasan">
      <button aria-pressed={view === 'overview'} onClick={() => setView('overview')}><ListChecks size={15}/>Operasi semasa</button>
      <button aria-pressed={view === 'analytics'} onClick={() => setView('analytics')}><BarChart3 size={15}/>Statistik & trend</button>
    </div>}
    <details className="workspace-disclosure ops-dashboard-filters"><summary><CalendarDays size={15} className="inline mr-2"/>Tempoh & penapis statistik{filters.from ? ' · '+filters.from+' hingga '+filters.to : ' · Semua masa'}</summary><PeriodControls defaultMode="fortnight" key={periodReset} onChange={range=>setFilters(current=>({...current,from:range.from,to:range.to,date:''}))}/><Card title="Tapis statistik">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Pos kawalan"><Select value={filters.location} onChange={e => setFilters({ ...filters, location: e.target.value })}><option value="">Semua pos</option>{(meta?.posts || []).map(p => <option key={p.id_pos} value={p.id_pos}>{p.nama_pos}</option>)}</Select></Field>
        <Field label="Tahap risiko"><Select value={filters.risk} onChange={e => setFilters({ ...filters, risk: e.target.value })}><option value="">Semua risiko</option>{['Low','Medium','High','Critical'].map(r => <option key={r}>{r}</option>)}</Select></Field>
      </div>
      {Object.values(filters).some(Boolean) && <Button className="mt-4" variant="ghost" onClick={() => {setFilters({...periodRange('fortnight',klToday()), date: '', location: '', risk: '' });setPeriodReset(value=>value+1);}}>Kosongkan penapis</Button>}
    </Card></details>
    {(filters.location||filters.risk)&&<p className="ds-method-note">Skop laporan: {meta?.posts?.find(p=>String(p.id_pos)===String(filters.location))?.nama_pos||'Semua pos'} · Risiko: {filters.risk||'Semua klasifikasi'}</p>}
    {isPending ? <LoadingState message="Memuatkan ringkasan operasi..." /> : isError ? <Card><AlertMessage>Ringkasan belum dapat dimuatkan.</AlertMessage><Button className="mt-3" variant="ghost" onClick={() => refetch()}>Cuba lagi</Button></Card> : <>
      {view === 'overview' ? <><DashboardIntelligence data={data} metrics={metrics} filters={filters}/>
        <details className="workspace-disclosure ops-dashboard-latest"><summary>Laporan terkini <small>{data.latest?.length||0} rekod terkini · Buka untuk butiran</small></summary>
          <Card title="Laporan terkini" action={<Link className="workspace-text-link" to="/semakan">Lihat semua</Link>}>
            {(data.latest || []).length ? data.latest.slice(0, 3).map(item => <Link key={item.id_laporan} to={`/semakan?report=${item.id_laporan}`} className="workspace-report-row"><div><strong>{item.tajuk_laporan}</strong><p>{item.nama_pos} · {item.tarikh_laporan?.slice(0, 10)}</p></div><Badge tone={item.tahap_risiko}>{item.tahap_risiko || 'Belum dianalisis'}</Badge><ArrowRight size={16} /></Link>) : <EmptyState title="Belum ada laporan" description="Laporan baharu akan dipaparkan di sini." />}
          </Card>
            <div className="workspace-note space-y-3">
              <p><Link to="/tindakan" className="workspace-text-link">{priority.permintaan_kemaskini_ketua ?? 0} permintaan kemas kini tindakan</Link></p>
              <p><Link to="/notifikasi" className="workspace-text-link">{priority.notifikasi_belum_dibaca ?? 0} notifikasi belum dibaca</Link></p>
            </div>
        </details>
        <details className="workspace-disclosure" onToggle={event => setBriefingOpen(event.currentTarget.open)}><summary>Taklimat syif <small>Ringkasan tambahan untuk serahan tugas</small></summary>{briefingOpen && <ShiftBriefing />}</details>

      </> : <>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">{[['Jumlah laporan', data.cards?.total_laporan], ['Laporan High/Critical', data.cards?.risiko_tinggi], ['Laporan berlampiran', data.cards?.laporan_berlampiran]].map(([label, value]) => <StatCard key={label} label={label} value={value ?? 0} />)}</div>
        <div className="grid gap-5 xl:grid-cols-2">
          <Card title="Kategori insiden"><ResponsiveContainer width="100%" height={260}><BarChart data={data.byCategory || []}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" name="Laporan" fill="#376b80" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer></Card>
          <Card title="Taburan risiko"><ResponsiveContainer width="100%" height={260}><PieChart><Pie data={data.byRisk || []} dataKey="value" nameKey="name" outerRadius={88} innerRadius={52} paddingAngle={3} label>{(data.byRisk || []).map(item => <Cell key={item.name} fill={riskColors[item.name] || '#94a3b8'} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="flex flex-wrap gap-2">{(data.byRisk || []).map(item => <Badge key={item.name} tone={item.name}>{item.name}: {item.value}</Badge>)}</div></Card>
          <Card title={filters.from ? 'Trend laporan dalam tempoh' : 'Trend laporan · 7 hari'} className="xl:col-span-2"><ResponsiveContainer width="100%" height={240}><LineChart data={data.trend || []}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey="laporan" name="Laporan" stroke="#267c88" strokeWidth={2} /></LineChart></ResponsiveContainer></Card>
          <Card title="Kata kunci dikesan" className="xl:col-span-2"><div className="flex flex-wrap gap-2">{(data.keywords || []).map(item => <Badge key={item.keyword}>{item.keyword} ({item.value})</Badge>)}{!data.keywords?.length && <p className="workspace-note">Tiada kata kunci untuk penapis ini.</p>}</div></Card>
        </div>
      </>}
      <div className="ops-dashboard-model"><ModelShowcase compact/></div>
    </>}
  </div>;
}
