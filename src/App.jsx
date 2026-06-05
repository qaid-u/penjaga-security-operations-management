import { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Bell, ClipboardCheck, FileCheck, FileText, History, LayoutDashboard, LogOut, MapPin, Menu, Shield, Users, X } from 'lucide-react';
import api from './api/axios';

const ROLE = {
  admin: 'Pentadbir Sistem',
  chief: 'Ketua Pengawal',
  guard: 'Pengawal Keselamatan',
};

const riskColors = { Low: '#16a34a', Medium: '#ca8a04', High: '#dc2626', Critical: '#111827' };

function useAuth() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('penjaga_user') || 'null'));
  const [loading, setLoading] = useState(false);

  const login = async (username, password) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { username, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('penjaga_user', JSON.stringify(data.user));
      setUser(data.user);
      return { ok: true, role: data.user.nama_peranan };
    } catch (error) {
      return { ok: false, message: error.response?.data?.message || 'Login gagal' };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('penjaga_user');
    setUser(null);
  };

  return { user, loading, login, logout };
}

function Badge({ children, tone = 'default' }) {
  const tones = {
    default: 'bg-gray-100 text-gray-700 border-gray-200',
    Low: 'bg-green-50 text-green-700 border-green-200',
    Medium: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    High: 'bg-red-50 text-red-700 border-red-200',
    Critical: 'bg-gray-900 text-white border-gray-900',
  };
  return <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${tones[tone] || tones.default}`}>{children}</span>;
}

function Card({ title, children, action }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-950">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function Input(props) {
  return <input {...props} className={`w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 ${props.className || ''}`} />;
}

function Select(props) {
  return <select {...props} className={`w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 ${props.className || ''}`} />;
}

function Textarea(props) {
  return <textarea {...props} className={`w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 ${props.className || ''}`} />;
}

function Button({ children, variant = 'primary', ...props }) {
  const variants = {
    primary: 'bg-gray-950 text-white hover:bg-gray-800',
    ghost: 'bg-white text-gray-800 border border-gray-300 hover:bg-gray-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };
  return <button {...props} className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium disabled:opacity-60 ${variants[variant]} ${props.className || ''}`}>{children}</button>;
}

function Login({ auth }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    const result = await auth.login(username, password);
    if (!result.ok) return setError(result.message);
    navigate(result.role === ROLE.guard ? '/pengawal' : '/dashboard');
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gray-950 text-white"><Shield size={22} /></div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-950">PENJAGA</h1>
            <p className="text-sm text-gray-600">Sistem Pengurusan Operasi Keselamatan</p>
          </div>
        </div>
        <Card>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Nama pengguna"><Input value={username} onChange={(e) => setUsername(e.target.value)} required /></Field>
            <Field label="Kata laluan"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
            {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <Button className="w-full" disabled={auth.loading}>Login</Button>
          </form>
          <div className="mt-4 grid gap-2 text-xs text-gray-600">
            <p>Demo: admin / ketua / amir / siti / kumar</p>
            <p>Password: Password123!</p>
          </div>
        </Card>
      </div>
    </main>
  );
}

function Shell({ auth, children }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const nav = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: [ROLE.admin, ROLE.chief] },
    { to: '/pengawal', label: 'Dashboard Saya', icon: LayoutDashboard, roles: [ROLE.guard] },
    { to: '/laporan', label: 'Laporan Harian', icon: FileText, roles: [ROLE.guard] },
    { to: '/semakan', label: 'Semakan Laporan', icon: FileCheck, roles: [ROLE.chief] },
    { to: '/tindakan', label: 'Tindakan Susulan', icon: ClipboardCheck, roles: [ROLE.chief] },
    { to: '/audit', label: 'Audit Trail', icon: History, roles: [ROLE.admin] },
    { to: '/pengguna', label: 'Pengguna', icon: Users, roles: [ROLE.admin] },
    { to: '/pos', label: 'Pos Kawalan', icon: MapPin, roles: [ROLE.admin] },
    { to: '/notifikasi', label: 'Notifikasi', icon: Bell, roles: [ROLE.admin, ROLE.chief] },
  ].filter((item) => item.roles.includes(auth.user?.nama_peranan));

  const doLogout = () => {
    auth.logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-950 lg:flex">
      <aside className={`${open ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-30 w-72 border-r border-gray-200 bg-white transition lg:static lg:translate-x-0`}>
        <div className="flex h-16 items-center justify-between border-b border-gray-200 px-5">
          <div className="flex items-center gap-3 font-semibold"><Shield size={22} /> PENJAGA</div>
          <button className="lg:hidden" onClick={() => setOpen(false)}><X size={20} /></button>
        </div>
        <nav className="space-y-1 p-3">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-gray-950 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
                <Icon size={18} /> {item.label}
              </NavLink>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-6">
          <button className="lg:hidden" onClick={() => setOpen(true)}><Menu size={22} /></button>
          <div className="ml-auto flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold">{auth.user?.nama_penuh}</p>
              <p className="text-xs text-gray-500">{auth.user?.nama_peranan}</p>
            </div>
            <Button variant="ghost" onClick={doLogout}><LogOut size={16} /> Logout</Button>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}

function Protected({ auth, roles, children }) {
  if (!auth.user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(auth.user.nama_peranan)) return <Navigate to={auth.user.nama_peranan === ROLE.guard ? '/pengawal' : '/dashboard'} replace />;
  return <Shell auth={auth}>{children}</Shell>;
}

function Dashboard() {
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState({ posts: [] });
  const [filters, setFilters] = useState({ date: '', location: '', risk: '' });
  const load = () => api.get('/dashboard', { params: filters }).then((res) => setData(res.data));
  useEffect(() => { api.get('/meta').then((res) => setMeta(res.data)); }, []);
  useEffect(() => { load(); }, [filters.date, filters.location, filters.risk]);
  if (!data) return <p>Memuatkan dashboard...</p>;
  const cards = [
    ['Total laporan harian', data.cards.total_laporan],
    ['Laporan berisiko tinggi', data.cards.risiko_tinggi],
    ['Tindakan belum selesai', data.cards.tindakan_belum_selesai],
    ['Pengawal aktif', data.cards.pengawal_aktif],
  ];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard Analitik</h1>
          <p className="text-sm text-gray-600">Trend dipaparkan berdasarkan laporan sedia ada sahaja.</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Input type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} />
          <Select value={filters.location} onChange={(e) => setFilters({ ...filters, location: e.target.value })}><option value="">Semua lokasi</option>{meta.posts.map((p) => <option key={p.id_pos} value={p.id_pos}>{p.nama_pos}</option>)}</Select>
          <Select value={filters.risk} onChange={(e) => setFilters({ ...filters, risk: e.target.value })}><option value="">Semua risiko</option><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></Select>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-4">{cards.map(([label, value]) => <Card key={label}><p className="text-sm text-gray-500">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></Card>)}</div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Kategori Insiden">
          <ResponsiveContainer width="100%" height={260}><BarChart data={data.byCategory}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#111827" /></BarChart></ResponsiveContainer>
        </Card>
        <Card title="Taburan Risiko">
          <ResponsiveContainer width="100%" height={260}><PieChart><Pie data={data.byRisk} dataKey="value" nameKey="name" outerRadius={90} label>{data.byRisk.map((entry) => <Cell key={entry.name} fill={riskColors[entry.name] || '#6b7280'} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
        </Card>
        <Card title="Trend Laporan Mengikut Tarikh">
          <ResponsiveContainer width="100%" height={260}><LineChart data={data.trend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey="laporan" stroke="#111827" strokeWidth={2} /></LineChart></ResponsiveContainer>
        </Card>
        <Card title="Ringkasan Kata Kunci NLP">
          <div className="flex flex-wrap gap-2">{data.keywords.map((item) => <Badge key={item.keyword}>{item.keyword} ({item.value})</Badge>)}</div>
          <div className="mt-5 space-y-2">{data.latest.map((item) => <div key={item.id_laporan} className="flex items-center justify-between rounded-md border border-gray-200 p-3 text-sm"><span>{item.tajuk_laporan} - {item.nama_pos}</span><Badge tone={item.tahap_risiko}>{item.tahap_risiko}</Badge></div>)}</div>
        </Card>
      </div>
    </div>
  );
}

function GuardDashboard() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get('/guard-dashboard').then((res) => setData(res.data)); }, []);
  if (!data) return <p>Memuatkan dashboard pengawal...</p>;
  const cards = [
    ['Laporan saya', data.summary.total_laporan],
    ['Menunggu semakan', data.summary.menunggu_semakan],
    ['Diluluskan', data.summary.diluluskan],
    ['Risiko tinggi', data.summary.risiko_tinggi],
  ];
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-semibold">Dashboard Pengawal</h1><p className="text-sm text-gray-600">Ringkasan laporan dan status bertugas saya.</p></div>
      <div className="grid gap-4 md:grid-cols-4">{cards.map(([label, value]) => <Card key={label}><p className="text-sm text-gray-500">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></Card>)}</div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Status Bertugas">{data.duty.map((d) => <div key={d.id_status} className="mb-2 rounded-md border border-gray-200 p-3 text-sm"><b>{d.nama_pos}</b><p className="text-gray-600">{d.tarikh?.slice(0, 10)} - {d.syif} - {d.status_bertugas}</p></div>)}</Card>
        <Card title="Laporan Terkini">{data.latest.map((r) => <div key={r.id_laporan} className="mb-2 rounded-md border border-gray-200 p-3 text-sm"><div className="flex justify-between gap-2"><b>{r.tajuk_laporan}</b><Badge tone={r.tahap_risiko}>{r.tahap_risiko}</Badge></div><p className="text-gray-600">{r.status_laporan} - {r.nama_pos} - NLP {r.kategori_dikesan}</p></div>)}</Card>
      </div>
    </div>
  );
}

function DailyReport() {
  const [meta, setMeta] = useState({ posts: [], categories: [], checklist: [] });
  const [reports, setReports] = useState([]);
  const [nlp, setNlp] = useState(null);
  const [submitted, setSubmitted] = useState(null);
  const [form, setForm] = useState({ syif: 'Pagi', tarikh_laporan: new Date().toISOString().slice(0, 10), masa_laporan: '08:00', checklist: [] });
  const load = () => Promise.all([api.get('/meta'), api.get('/reports')]).then(([m, r]) => { setMeta(m.data); setReports(r.data); });
  useEffect(() => { load(); }, []);
  const setChecklist = (id, key, value) => setForm((prev) => ({ ...prev, checklist: [...prev.checklist.filter((i) => i.id_checklist !== id), { ...(prev.checklist.find((i) => i.id_checklist === id) || { id_checklist: id, jawapan: 'Ya' }), [key]: value }] }));
  const submit = async (event) => {
    event.preventDefault();
    const { data } = await api.post('/reports', { ...form, id_pos: Number(form.id_pos), id_kategori_insiden: form.id_kategori_insiden ? Number(form.id_kategori_insiden) : null });
    setNlp(data.nlp);
    setSubmitted(data.report);
    setForm({ syif: 'Pagi', tarikh_laporan: new Date().toISOString().slice(0, 10), masa_laporan: '08:00', checklist: [] });
    load();
  };
  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
      <Card title="Laporan Harian">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Pos kawalan"><Select required value={form.id_pos || ''} onChange={(e) => setForm({ ...form, id_pos: e.target.value })}><option value="">Pilih pos</option>{meta.posts.map((p) => <option key={p.id_pos} value={p.id_pos}>{p.nama_pos}</option>)}</Select></Field>
            <Field label="Syif"><Select value={form.syif} onChange={(e) => setForm({ ...form, syif: e.target.value })}><option>Pagi</option><option>Petang</option><option>Malam</option></Select></Field>
            <Field label="Tarikh"><Input type="date" required value={form.tarikh_laporan} onChange={(e) => setForm({ ...form, tarikh_laporan: e.target.value })} /></Field>
            <Field label="Masa"><Input type="time" required value={form.masa_laporan} onChange={(e) => setForm({ ...form, masa_laporan: e.target.value })} /></Field>
          </div>
          <Field label="Tajuk laporan"><Input required value={form.tajuk_laporan || ''} onChange={(e) => setForm({ ...form, tajuk_laporan: e.target.value })} /></Field>
          <Field label="Kategori insiden pilihan"><Select value={form.id_kategori_insiden || ''} onChange={(e) => setForm({ ...form, id_kategori_insiden: e.target.value })}><option value="">Biarkan NLP klasifikasi</option>{meta.categories.map((c) => <option key={c.id_kategori_insiden} value={c.id_kategori_insiden}>{c.nama_kategori}</option>)}</Select></Field>
          <Field label="Lampiran fail pilihan"><Input type="file" disabled title="Placeholder akademik: lampiran fail boleh ditambah dalam versi seterusnya" /></Field>
          <Field label="Kandungan laporan"><Textarea required rows={6} value={form.kandungan_laporan || ''} onChange={(e) => setForm({ ...form, kandungan_laporan: e.target.value })} /></Field>
          <div className="space-y-2">
            <p className="text-sm font-semibold">Checklist</p>
            {meta.checklist.map((item) => <div key={item.id_checklist} className="grid gap-2 rounded-md border border-gray-200 p-3 sm:grid-cols-[1fr_120px_1fr]"><span className="text-sm">{item.nama_checklist}</span><Select onChange={(e) => setChecklist(item.id_checklist, 'jawapan', e.target.value)}><option>Ya</option><option>Tidak</option><option>Tidak Berkaitan</option></Select><Input placeholder="Catatan" onChange={(e) => setChecklist(item.id_checklist, 'catatan', e.target.value)} /></div>)}
          </div>
          <Button>Hantar laporan</Button>
        </form>
      </Card>
      <div className="space-y-5">
        {nlp && <Card title="Keputusan NLP Rule-Based"><div className="space-y-3 text-sm"><p><b>Status laporan:</b> {submitted?.status_laporan}</p><p><b>Kategori:</b> {nlp.kategori_dikesan}</p><p><b>Skor risiko:</b> {nlp.skor_risiko}</p><p><b>Tahap risiko:</b> <Badge tone={nlp.tahap_risiko}>{nlp.tahap_risiko}</Badge></p><p><b>Kata kunci:</b> {nlp.kata_kunci_dikesan.join(', ')}</p><p><b>Ringkasan:</b> {nlp.ringkasan_automatik}</p></div></Card>}
        <Card title="Laporan Saya">{reports.map((report) => <div key={report.id_laporan} className="mb-2 rounded-md border border-gray-200 p-3 text-sm"><div className="flex justify-between gap-2"><b>{report.tajuk_laporan}</b><Badge tone={report.tahap_risiko}>{report.tahap_risiko}</Badge></div><p className="text-gray-600">{report.nama_pos} - {report.status_laporan}</p></div>)}</Card>
      </div>
    </div>
  );
}

function ReviewReports() {
  const [reports, setReports] = useState([]);
  const [comment, setComment] = useState('');
  const load = () => api.get('/reports').then((res) => setReports(res.data));
  useEffect(() => { load(); }, []);
  const review = async (id, status) => { await api.patch(`/reports/${id}/review`, { status, comment }); setComment(''); load(); };
  return <Card title="Semakan Laporan">{reports.map((r) => <article key={r.id_laporan} className={`mb-3 rounded-md border p-4 ${['High', 'Critical'].includes(r.tahap_risiko) ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{r.tajuk_laporan}</h3><Badge tone={r.tahap_risiko}>{r.tahap_risiko}</Badge></div><p className="mt-1 text-sm text-gray-700">{r.kandungan_laporan}</p><p className="mt-2 text-sm"><b>NLP:</b> {r.kategori_dikesan} - skor {r.skor_risiko}; kata kunci {(r.kata_kunci_dikesan || []).join(', ')}</p><div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]"><Input placeholder="Catatan semakan" value={comment} onChange={(e) => setComment(e.target.value)} /><Button onClick={() => review(r.id_laporan, 'approved')}>Lulus</Button><Button variant="danger" onClick={() => review(r.id_laporan, 'rejected')}>Tolak</Button></div></article>)}</Card>;
}

function FollowUp() {
  const [reports, setReports] = useState([]);
  const [actions, setActions] = useState([]);
  const [form, setForm] = useState({ status_tindakan: 'Baru', tahap_keutamaan: 'High' });
  const load = () => Promise.all([api.get('/reports'), api.get('/actions')]).then(([r, a]) => { setReports(r.data.filter((x) => ['High', 'Critical'].includes(x.tahap_risiko))); setActions(a.data); });
  useEffect(() => { load(); }, []);
  const create = async (e) => { e.preventDefault(); await api.post('/actions', { ...form, id_laporan: Number(form.id_laporan) }); setForm({ status_tindakan: 'Baru', tahap_keutamaan: 'High' }); load(); };
  const update = async (id, status_tindakan) => { await api.patch(`/actions/${id}`, { status_tindakan }); load(); };
  return <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]"><Card title="Tambah Tindakan"><form onSubmit={create} className="space-y-3"><Field label="Laporan"><Select required value={form.id_laporan || ''} onChange={(e) => setForm({ ...form, id_laporan: e.target.value })}><option value="">Pilih laporan</option>{reports.map((r) => <option key={r.id_laporan} value={r.id_laporan}>{r.tajuk_laporan}</option>)}</Select></Field><Field label="Pegawai bertanggungjawab"><Input required value={form.pegawai_bertanggungjawab || ''} onChange={(e) => setForm({ ...form, pegawai_bertanggungjawab: e.target.value })} /></Field><Field label="Tindakan diambil"><Textarea required rows={4} value={form.tindakan_diambil || ''} onChange={(e) => setForm({ ...form, tindakan_diambil: e.target.value })} /></Field><Field label="Keutamaan"><Select value={form.tahap_keutamaan} onChange={(e) => setForm({ ...form, tahap_keutamaan: e.target.value })}><option>Medium</option><option>High</option><option>Critical</option></Select></Field><Button>Simpan tindakan</Button></form></Card><Card title="Senarai Tindakan">{actions.map((a) => <div key={a.id_tindakan} className="mb-3 rounded-md border border-gray-200 p-4 text-sm"><div className="flex flex-wrap justify-between gap-2"><b>{a.tajuk_laporan}</b><Badge tone={a.tahap_keutamaan}>{a.tahap_keutamaan}</Badge></div><p className="mt-1">{a.tindakan_diambil}</p><p className="text-gray-600">Pegawai: {a.pegawai_bertanggungjawab} - Status: {a.status_tindakan}</p><div className="mt-3 flex gap-2"><Button variant="ghost" onClick={() => update(a.id_tindakan, 'Dalam Tindakan')}>Dalam Tindakan</Button><Button onClick={() => update(a.id_tindakan, 'Selesai')}>Selesai</Button></div></div>)}</Card></div>;
}

function AuditTrail() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get('/audit').then((res) => setRows(res.data)); }, []);
  return <Card title="Audit Trail"><div className="mb-3 grid gap-2 md:grid-cols-4"><Input placeholder="User" /><Input placeholder="Modul" /><Input placeholder="Aktiviti" /><Input type="date" /></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="py-2">Masa</th><th>User</th><th>Role</th><th>Aktiviti</th><th>Modul</th><th>Status</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id_audit} className="border-b"><td className="py-2">{new Date(r.tarikh_masa_aktiviti).toLocaleString()}</td><td>{r.nama_penuh || '-'}</td><td>{r.nama_peranan || '-'}</td><td>{r.jenis_aktiviti}</td><td>{r.modul_sistem}</td><td>{r.status_aktiviti}</td></tr>)}</tbody></table></div></Card>;
}

function NotificationsPage() {
  const [rows, setRows] = useState([]);
  const load = () => api.get('/notifications').then((res) => setRows(res.data));
  useEffect(() => { load(); }, []);
  const markRead = async (id) => { await api.patch(`/notifications/${id}/read`); load(); };
  return <Card title="Notifikasi">{rows.map((n) => <div key={n.id_notifikasi} className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 p-4 text-sm"><div><div className="flex items-center gap-2"><b>{n.tajuk_notifikasi}</b><Badge tone={n.tahap_keutamaan}>{n.tahap_keutamaan}</Badge></div><p className="mt-1 text-gray-700">{n.mesej_notifikasi}</p><p className="text-xs text-gray-500">{new Date(n.tarikh_hantar).toLocaleString()} - {n.status_bacaan}</p></div>{n.status_bacaan !== 'Dibaca' && <Button variant="ghost" onClick={() => markRead(n.id_notifikasi)}>Tanda dibaca</Button>}</div>)}</Card>;
}

function UsersPage() {
  const [meta, setMeta] = useState({ roles: [] });
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ kata_laluan: 'Password123!' });
  const load = () => Promise.all([api.get('/meta'), api.get('/users')]).then(([m, u]) => { setMeta(m.data); setUsers(u.data); });
  useEffect(() => { load(); }, []);
  const create = async (e) => { e.preventDefault(); await api.post('/users', form); setForm({ kata_laluan: 'Password123!' }); load(); };
  const update = async (id, patch) => { await api.patch(`/users/${id}`, patch); load(); };
  return <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]"><Card title="Tambah Pengguna"><form onSubmit={create} className="space-y-3"><Field label="Peranan"><Select required value={form.id_peranan || ''} onChange={(e) => setForm({ ...form, id_peranan: Number(e.target.value) })}><option value="">Pilih peranan</option>{meta.roles.map((r) => <option key={r.id_peranan} value={r.id_peranan}>{r.nama_peranan}</option>)}</Select></Field><Field label="Nama penuh"><Input required value={form.nama_penuh || ''} onChange={(e) => setForm({ ...form, nama_penuh: e.target.value })} /></Field><Field label="Nama pengguna"><Input required value={form.nama_pengguna || ''} onChange={(e) => setForm({ ...form, nama_pengguna: e.target.value })} /></Field><Field label="Emel"><Input type="email" required value={form.emel || ''} onChange={(e) => setForm({ ...form, emel: e.target.value })} /></Field><Field label="No telefon"><Input value={form.no_telefon || ''} onChange={(e) => setForm({ ...form, no_telefon: e.target.value })} /></Field><Button>Tambah pengguna</Button></form></Card><Card title="Senarai Pengguna">{users.map((u) => <div key={u.id_pengguna} className="mb-2 grid gap-2 rounded-md border border-gray-200 p-3 text-sm md:grid-cols-[1fr_220px_auto]"><span><b>{u.nama_penuh}</b><br />{u.nama_pengguna} - {u.emel}</span><Select value={u.id_peranan} onChange={(e) => update(u.id_pengguna, { id_peranan: Number(e.target.value) })}>{meta.roles.map((r) => <option key={r.id_peranan} value={r.id_peranan}>{r.nama_peranan}</option>)}</Select><Button variant="ghost" onClick={() => update(u.id_pengguna, { status_akaun: u.status_akaun === 'Aktif' ? 'Tidak Aktif' : 'Aktif' })}>{u.status_akaun}</Button></div>)}</Card></div>;
}

function PostsPage() {
  const [posts, setPosts] = useState([]);
  const [form, setForm] = useState({ status_pos: 'Aktif' });
  const load = () => api.get('/posts').then((res) => setPosts(res.data));
  useEffect(() => { load(); }, []);
  const create = async (e) => { e.preventDefault(); await api.post('/posts', form); setForm({ status_pos: 'Aktif' }); load(); };
  const update = async (id, patch) => { await api.patch(`/posts/${id}`, patch); load(); };
  return <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]"><Card title="Tambah Pos Kawalan"><form onSubmit={create} className="space-y-3"><Field label="Nama pos"><Input required value={form.nama_pos || ''} onChange={(e) => setForm({ ...form, nama_pos: e.target.value })} /></Field><Field label="Bangunan"><Input value={form.nama_bangunan || ''} onChange={(e) => setForm({ ...form, nama_bangunan: e.target.value })} /></Field><Field label="Lokasi"><Input value={form.lokasi || ''} onChange={(e) => setForm({ ...form, lokasi: e.target.value })} /></Field><Field label="Waktu operasi"><Input value={form.waktu_operasi || ''} onChange={(e) => setForm({ ...form, waktu_operasi: e.target.value })} /></Field><Button>Simpan pos</Button></form></Card><Card title="Senarai Pos">{posts.map((p) => <div key={p.id_pos} className="mb-2 grid gap-2 rounded-md border border-gray-200 p-3 text-sm md:grid-cols-[1fr_auto]"><span><b>{p.nama_pos}</b><p className="text-gray-600">{p.nama_bangunan} - {p.lokasi} - {p.waktu_operasi}</p></span><Button variant="ghost" onClick={() => update(p.id_pos, { status_pos: p.status_pos === 'Aktif' ? 'Tidak Aktif' : 'Aktif' })}>{p.status_pos}</Button></div>)}</Card></div>;
}

function App() {
  const auth = useAuth();
  const defaultPath = useMemo(() => auth.user?.nama_peranan === ROLE.guard ? '/pengawal' : '/dashboard', [auth.user]);
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={auth.user ? <Navigate to={defaultPath} replace /> : <Login auth={auth} />} />
        <Route path="/dashboard" element={<Protected auth={auth} roles={[ROLE.admin, ROLE.chief]}><Dashboard /></Protected>} />
        <Route path="/pengawal" element={<Protected auth={auth} roles={[ROLE.guard]}><GuardDashboard /></Protected>} />
        <Route path="/laporan" element={<Protected auth={auth} roles={[ROLE.guard]}><DailyReport /></Protected>} />
        <Route path="/semakan" element={<Protected auth={auth} roles={[ROLE.chief]}><ReviewReports /></Protected>} />
        <Route path="/tindakan" element={<Protected auth={auth} roles={[ROLE.chief]}><FollowUp /></Protected>} />
        <Route path="/audit" element={<Protected auth={auth} roles={[ROLE.admin]}><AuditTrail /></Protected>} />
        <Route path="/pengguna" element={<Protected auth={auth} roles={[ROLE.admin]}><UsersPage /></Protected>} />
        <Route path="/pos" element={<Protected auth={auth} roles={[ROLE.admin]}><PostsPage /></Protected>} />
        <Route path="/notifikasi" element={<Protected auth={auth} roles={[ROLE.admin, ROLE.chief]}><NotificationsPage /></Protected>} />
        <Route path="*" element={<Navigate to={auth.user ? defaultPath : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
