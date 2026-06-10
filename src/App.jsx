import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Bell, CalendarDays, Camera, ChevronDown, ClipboardCheck, Download, Eye, EyeOff, FileCheck, FileText, History, KeyRound, LayoutDashboard, LogOut, MapPin, Menu, Paperclip, RotateCcw, Shield, Users, X } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import api from './api/axios';

const ROLE = {
  admin: 'Pentadbir Sistem',
  chief: 'Ketua Pengawal',
  guard: 'Pengawal Keselamatan',
};

const riskColors = {
  Low: 'var(--color-risk-low)',
  Medium: 'var(--color-risk-medium)',
  High: 'var(--color-risk-high)',
  Critical: 'var(--color-risk-critical)',
};
const API_ORIGIN = 'http://localhost:3000';

async function downloadCsv(path, filename) {
  try {
    const { data } = await api.get(path, { responseType: 'blob' });
    const url = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${filename} dimuat turun`);
  } catch (error) {
    notifyError(error, 'Fail CSV gagal dimuat turun');
  }
}

function notifyError(error, fallback = 'Tindakan gagal. Sila cuba lagi.') {
  toast.error(error?.response?.data?.message || error?.message || fallback);
}

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
    default: 'badge-default',
    Low: 'badge-low',
    Medium: 'badge-medium',
    High: 'badge-high',
    Critical: 'badge-critical',
  };
  return <span className={`inline-flex rounded border px-2 py-0.5 text-[var(--fs-label)] font-medium ${tones[tone] || tones.default}`}>{children}</span>;
}

function Card({ title, children, action }) {
  return (
    <section className="app-surface rounded-lg border p-4 shadow-sm">
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="block text-sm font-medium text-secondary-token">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function Input(props) {
  return <input {...props} className={`app-input w-full rounded-md border px-3 py-2 text-sm ${props.className || ''}`} />;
}

function Select(props) {
  return <select {...props} className={`app-input w-full rounded-md border px-3 py-2 text-sm ${props.className || ''}`} />;
}

function Textarea(props) {
  return <textarea {...props} className={`app-input w-full rounded-md border px-3 py-2 text-sm ${props.className || ''}`} />;
}

function Button({ children, variant = 'primary', ...props }) {
  const variants = {
    primary: 'app-button-primary',
    ghost: 'app-button-ghost border',
    danger: 'app-button-danger',
  };
  return <button {...props} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium disabled:opacity-60 ${variants[variant]} ${props.className || ''}`}>{children}</button>;
}

function PageHeader({ title, description, action }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1>{title}</h1>
        {description && <p className="mt-1 text-sm">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}

function StatCard({ label, value }) {
  return <Card><p className="label-caps">{label}</p><p className="text-kpi mt-2">{value}</p></Card>;
}

function LoadingState({ message = 'Memuatkan data...' }) {
  return <Card><p>{message}</p></Card>;
}

function EmptyState({ title = 'Tiada data', description = 'Belum ada rekod untuk dipaparkan.' }) {
  return <div className="app-row rounded-md border p-4 text-sm"><p className="font-medium text-primary-token">{title}</p><p>{description}</p></div>;
}

function AlertMessage({ children, type = 'error' }) {
  const tone = type === 'success' ? 'status-success' : 'status-error';
  return <p className={`${tone} rounded-md border px-3 py-2 text-sm`}>{children}</p>;
}

function FilterPanel({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <Card title="Tapisan" action={<Button variant="ghost" className="sm:hidden" onClick={() => setOpen((value) => !value)}><ChevronDown size={16} /> {open ? 'Tutup' : 'Buka'}</Button>}>
      <div className={`${open ? 'grid' : 'hidden'} gap-2 sm:grid`}>
        {children}
      </div>
    </Card>
  );
}

function ConfirmModal({ open, title, message, confirmLabel = 'Sahkan', danger = false, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(0,0,0,0.55)] p-4 sm:items-center">
      <div className="app-elevated w-full max-w-md rounded-lg border p-4 shadow-xl">
        <h2>{title}</h2>
        <p className="mt-2">{message}</p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Button variant="ghost" onClick={onCancel}>Batal</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

function PasswordInput({ value, onChange, required = false }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input type={visible ? 'text' : 'password'} value={value} onChange={onChange} required={required} className="pr-12" />
      <button type="button" className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md app-nav" onClick={() => setVisible((state) => !state)} aria-label={visible ? 'Sembunyikan kata laluan' : 'Tunjuk kata laluan'}>
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function Login({ auth }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    const result = await auth.login(username, password);
    if (!result.ok) {
      toast.error(result.message);
      return setError(result.message);
    }
    toast.success('Login berjaya');
    navigate(result.role === ROLE.guard ? '/pengawal' : '/dashboard');
  };

  return (
    <main className="app-page flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="brand-mark flex h-11 w-11 items-center justify-center rounded-lg"><Shield size={22} /></div>
          <div>
            <h1>PENJAGA</h1>
            <p className="text-sm">Sistem Pengurusan Operasi Keselamatan</p>
          </div>
        </div>
        <Card>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Nama pengguna"><Input value={username} onChange={(e) => setUsername(e.target.value)} required /></Field>
            <Field label="Kata laluan"><PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
            {error && <p className="status-error rounded-md border px-3 py-2 text-sm">{error}</p>}
            <Button className="w-full" disabled={auth.loading}>Login</Button>
          </form>
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
    { to: '/jadual', label: 'Jadual Bertugas', icon: CalendarDays, roles: [ROLE.admin, ROLE.chief, ROLE.guard] },
    { to: '/laporan', label: 'Laporan Harian', icon: FileText, roles: [ROLE.guard] },
    { to: '/semakan', label: 'Semakan Laporan', icon: FileCheck, roles: [ROLE.chief] },
    { to: '/tindakan', label: 'Tindakan Susulan', icon: ClipboardCheck, roles: [ROLE.chief] },
    { to: '/audit', label: 'Audit Trail', icon: History, roles: [ROLE.admin] },
    { to: '/pengguna', label: 'Pengguna', icon: Users, roles: [ROLE.admin] },
    { to: '/pos', label: 'Pos Kawalan', icon: MapPin, roles: [ROLE.admin] },
    { to: '/notifikasi', label: 'Notifikasi', icon: Bell, roles: [ROLE.admin, ROLE.chief] },
    { to: '/kata-laluan', label: 'Kata Laluan', icon: KeyRound, roles: [ROLE.admin, ROLE.chief, ROLE.guard] },
  ].filter((item) => item.roles.includes(auth.user?.nama_peranan));

  const doLogout = () => {
    auth.logout();
    navigate('/login');
  };
  const mobileNav = nav.slice(0, 4);
  const overflowCount = Math.max(0, nav.length - mobileNav.length);

  return (
    <div className="app-shell min-h-screen pb-20 lg:flex lg:pb-0">
      <aside className={`${open ? 'translate-x-0' : '-translate-x-full'} app-sidebar fixed inset-y-0 left-0 z-30 w-72 border-r transition lg:static lg:translate-x-0`}>
        <div className="app-divider flex h-16 items-center justify-between border-b px-5">
          <div className="flex items-center gap-3 font-medium"><Shield size={22} /> PENJAGA</div>
          <button className="lg:hidden" onClick={() => setOpen(false)}><X size={20} /></button>
        </div>
        <nav className="space-y-1 p-3">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'app-nav-active' : 'app-nav'}`}>
                <Icon size={18} /> {item.label}
              </NavLink>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="app-surface app-divider flex h-16 items-center justify-between border-b px-4 lg:px-6">
          <button className="lg:hidden" onClick={() => setOpen(true)}><Menu size={22} /></button>
          <div className="ml-auto flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-primary-token">{auth.user?.nama_penuh}</p>
              <p className="text-[var(--fs-small)] text-tertiary-token">{auth.user?.nama_peranan}</p>
            </div>
            <Button variant="ghost" onClick={doLogout}><LogOut size={16} /> Logout</Button>
          </div>
        </header>
        <main className="app-page mx-auto max-w-7xl p-4 lg:p-6">{children}</main>
      </div>
      <nav className="app-surface fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t px-1 py-2 lg:hidden">
        {mobileNav.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium ${isActive ? 'app-nav-active' : 'app-nav'}`}>
              <Icon size={18} />
              <span>{item.label.replace('Dashboard Saya', 'Dashboard').replace('Jadual Bertugas', 'Jadual').replace('Laporan Harian', 'Laporan').replace('Semakan Laporan', 'Semakan').replace('Tindakan Susulan', 'Tindakan').replace('Audit Trail', 'Audit').replace('Pos Kawalan', 'Pos')}</span>
            </NavLink>
          );
        })}
        <button className="app-nav flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium" onClick={() => setOpen(true)}>
          <Menu size={18} />
          <span>{overflowCount ? 'Menu' : 'Lagi'}</span>
        </button>
      </nav>
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
  const load = useCallback(() => api.get('/dashboard', { params: filters }).then((res) => setData(res.data)), [filters]);
  useEffect(() => { api.get('/meta').then((res) => setMeta(res.data)); }, []);
  useEffect(() => { load(); }, [load]);
  if (!data) return <LoadingState message="Memuatkan dashboard..." />;
  const cards = [
    ['Total laporan harian', data.cards.total_laporan],
    ['Laporan berisiko tinggi', data.cards.risiko_tinggi],
    ['Tindakan belum selesai', data.cards.tindakan_belum_selesai],
    ['Pengawal aktif', data.cards.pengawal_aktif],
    ['Jadual hari ini', data.cards.jadual_hari_ini],
    ['Laporan dengan bukti', data.cards.laporan_berlampiran],
  ];
  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard Analitik" description="Pantau laporan, risiko, tindakan dan jadual operasi keselamatan." />
      <FilterPanel>
        <div className="grid gap-2 sm:grid-cols-3">
          <Input type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} />
          <Select value={filters.location} onChange={(e) => setFilters({ ...filters, location: e.target.value })}><option value="">Semua lokasi</option>{meta.posts.map((p) => <option key={p.id_pos} value={p.id_pos}>{p.nama_pos}</option>)}</Select>
          <Select value={filters.risk} onChange={(e) => setFilters({ ...filters, risk: e.target.value })}><option value="">Semua risiko</option><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></Select>
        </div>
      </FilterPanel>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{cards.map(([label, value]) => <StatCard key={label} label={label} value={value} />)}</div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Kategori Insiden">
          <ResponsiveContainer width="100%" height={260}><BarChart data={data.byCategory}><CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} /><YAxis allowDecimals={false} tick={{ fill: 'var(--color-text-secondary)' }} /><Tooltip /><Bar dataKey="value" fill="var(--color-brand-navy)" /></BarChart></ResponsiveContainer>
        </Card>
        <Card title="Taburan Risiko">
          <ResponsiveContainer width="100%" height={260}><PieChart><Pie data={data.byRisk} dataKey="value" nameKey="name" outerRadius={90} label>{data.byRisk.map((entry) => <Cell key={entry.name} fill={riskColors[entry.name] || 'var(--color-risk-info)'} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
        </Card>
        <Card title="Trend Laporan Mengikut Tarikh">
          <ResponsiveContainer width="100%" height={260}><LineChart data={data.trend}><CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" /><XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} /><YAxis allowDecimals={false} tick={{ fill: 'var(--color-text-secondary)' }} /><Tooltip /><Line type="monotone" dataKey="laporan" stroke="var(--color-brand-gold)" strokeWidth={2} /></LineChart></ResponsiveContainer>
        </Card>
        <Card title="Ringkasan Kata Kunci NLP">
          <div className="flex flex-wrap gap-2">{data.keywords.map((item) => <Badge key={item.keyword}>{item.keyword} ({item.value})</Badge>)}</div>
          <div className="mt-5 space-y-2">{data.latest.map((item) => <div key={item.id_laporan} className="app-row flex items-center justify-between rounded-md border p-3 text-sm"><span>{item.tajuk_laporan} - {item.nama_pos}</span><Badge tone={item.tahap_risiko}>{item.tahap_risiko}</Badge></div>)}</div>
        </Card>
      </div>
    </div>
  );
}

function GuardDashboard() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get('/guard-dashboard').then((res) => setData(res.data)); }, []);
  if (!data) return <LoadingState message="Memuatkan dashboard pengawal..." />;
  const cards = [
    ['Laporan saya', data.summary.total_laporan],
    ['Menunggu semakan', data.summary.menunggu_semakan],
    ['Diluluskan', data.summary.diluluskan],
    ['Risiko tinggi', data.summary.risiko_tinggi],
  ];
  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard Pengawal" description="Semak jadual, laporan dan status tugasan anda." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{cards.map(([label, value]) => <StatCard key={label} label={label} value={value} />)}</div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Status Bertugas">{data.duty.length ? data.duty.map((d) => <div key={d.id_status} className="app-row mb-2 rounded-md border p-3 text-sm"><span className="font-medium text-primary-token">{d.nama_pos}</span><p>{d.tarikh?.slice(0, 10)} - {d.syif} - {d.status_bertugas}</p></div>) : <EmptyState title="Tiada jadual" description="Belum ada tugasan bertugas untuk dipaparkan." />}</Card>
        <Card title="Laporan Terkini">{data.latest.length ? data.latest.map((r) => <div key={r.id_laporan} className="app-row mb-2 rounded-md border p-3 text-sm"><div className="flex justify-between gap-2"><span className="font-medium text-primary-token">{r.tajuk_laporan}</span><Badge tone={r.tahap_risiko}>{r.tahap_risiko}</Badge></div><p>{r.status_laporan} - {r.nama_pos} - NLP {r.kategori_dikesan}</p></div>) : <EmptyState title="Tiada laporan" description="Laporan terkini akan dipaparkan di sini." />}</Card>
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
  const [fileKey, setFileKey] = useState(0);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const load = useCallback(() => Promise.all([api.get('/meta'), api.get('/reports')]).then(([m, r]) => { setMeta(m.data); setReports(r.data); }), []);
  useEffect(() => { load(); }, [load]);
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }, []);
  useEffect(() => () => {
    stopCamera();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl, stopCamera]);
  const setEvidenceFile = (file) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setForm((prev) => ({ ...prev, lampiran_fail: file }));
    setPreviewUrl(file?.type?.startsWith('image/') ? URL.createObjectURL(file) : '');
  };
  const openCamera = async () => {
    setCameraError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Kamera tidak disokong oleh pelayar ini');
      toast.error('Kamera tidak disokong oleh pelayar ini');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      streamRef.current = stream;
      setCameraOpen(true);
      toast.success('Kamera dibuka');
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 0);
    } catch {
      setCameraError('Kamera tidak dapat dibuka. Sila benarkan akses kamera atau guna lampiran fail.');
      toast.error('Kamera tidak dapat dibuka');
    }
  };
  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return setCameraError('Gambar gagal ditangkap. Cuba sekali lagi.');
      const file = new File([blob], `bukti-laporan-${Date.now()}.jpg`, { type: 'image/jpeg' });
      setEvidenceFile(file);
      stopCamera();
      toast.success('Gambar bukti ditangkap');
    }, 'image/jpeg', 0.9);
  };
  const setChecklist = (id, key, value) => setForm((prev) => ({ ...prev, checklist: [...prev.checklist.filter((i) => i.id_checklist !== id), { ...(prev.checklist.find((i) => i.id_checklist === id) || { id_checklist: id, jawapan: 'Ya' }), [key]: value }] }));
  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const body = new FormData();
      Object.entries({ ...form, id_pos: Number(form.id_pos), id_kategori_insiden: form.id_kategori_insiden ? Number(form.id_kategori_insiden) : '' }).forEach(([key, value]) => {
        if (key === 'checklist') body.append(key, JSON.stringify(value));
        else if (key !== 'lampiran_fail' && value !== undefined && value !== null) body.append(key, value);
      });
      if (form.lampiran_fail) body.append('lampiran_fail', form.lampiran_fail);
      const { data } = await api.post('/reports', body, { headers: { 'Content-Type': 'multipart/form-data' } });
      setNlp(data.nlp);
      setSubmitted(data.report);
      setForm({ syif: 'Pagi', tarikh_laporan: new Date().toISOString().slice(0, 10), masa_laporan: '08:00', checklist: [] });
      setEvidenceFile(null);
      setFileKey((prev) => prev + 1);
      toast.success('Laporan berjaya dihantar');
      load();
    } catch (error) {
      notifyError(error, 'Laporan gagal dihantar');
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
      <Card title="Laporan Harian">
        <form onSubmit={submit} className="space-y-4">
          <p className="label-caps">Bahagian 1: Tugasan dan pos</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Pos kawalan"><Select required value={form.id_pos || ''} onChange={(e) => setForm({ ...form, id_pos: e.target.value })}><option value="">Pilih pos</option>{meta.posts.map((p) => <option key={p.id_pos} value={p.id_pos}>{p.nama_pos}</option>)}</Select></Field>
            <Field label="Syif"><Select value={form.syif} onChange={(e) => setForm({ ...form, syif: e.target.value })}><option>Pagi</option><option>Petang</option><option>Malam</option></Select></Field>
            <Field label="Tarikh"><Input type="date" required value={form.tarikh_laporan} onChange={(e) => setForm({ ...form, tarikh_laporan: e.target.value })} /></Field>
            <Field label="Masa"><Input type="time" required value={form.masa_laporan} onChange={(e) => setForm({ ...form, masa_laporan: e.target.value })} /></Field>
          </div>
          <p className="label-caps">Bahagian 2: Butiran laporan</p>
          <Field label="Tajuk laporan"><Input required value={form.tajuk_laporan || ''} onChange={(e) => setForm({ ...form, tajuk_laporan: e.target.value })} /></Field>
          <Field label="Kategori insiden pilihan"><Select value={form.id_kategori_insiden || ''} onChange={(e) => setForm({ ...form, id_kategori_insiden: e.target.value })}><option value="">Biarkan NLP klasifikasi</option>{meta.categories.map((c) => <option key={c.id_kategori_insiden} value={c.id_kategori_insiden}>{c.nama_kategori}</option>)}</Select></Field>
          <Field label="Kandungan laporan"><Textarea required rows={6} value={form.kandungan_laporan || ''} onChange={(e) => setForm({ ...form, kandungan_laporan: e.target.value })} /></Field>
          <div className="space-y-2">
            <p className="label-caps">Bahagian 3: Checklist</p>
            {meta.checklist.map((item) => <div key={item.id_checklist} className="app-row grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_120px_1fr]"><span className="text-sm">{item.nama_checklist}</span><Select onChange={(e) => setChecklist(item.id_checklist, 'jawapan', e.target.value)}><option>Ya</option><option>Tidak</option><option>Tidak Berkaitan</option></Select><Input placeholder="Catatan" onChange={(e) => setChecklist(item.id_checklist, 'catatan', e.target.value)} /></div>)}
          </div>
          <div className="space-y-2">
            <p className="label-caps">Bahagian 4: Lampiran bukti</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" variant="ghost" onClick={openCamera}><Camera size={16} /> Guna kamera</Button>
              <Field label="Lampiran bukti"><Input key={fileKey} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)} /></Field>
            </div>
            {cameraError && <AlertMessage>{cameraError}</AlertMessage>}
            {cameraOpen && (
              <div className="app-row space-y-3 rounded-md border p-3">
                <video ref={videoRef} autoPlay playsInline muted className="aspect-video w-full rounded-md object-cover" />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button type="button" onClick={capturePhoto}><Camera size={16} /> Tangkap gambar</Button>
                  <Button type="button" variant="ghost" onClick={stopCamera}>Tutup kamera</Button>
                </div>
              </div>
            )}
            {previewUrl && (
              <div className="app-row rounded-md border p-3">
                <img src={previewUrl} alt="Pratonton bukti laporan" className="max-h-64 w-full rounded-md object-contain" />
                <Button type="button" variant="ghost" className="mt-3 w-full sm:w-auto" onClick={() => { setEvidenceFile(null); setFileKey((prev) => prev + 1); }}><RotateCcw size={16} /> Ambil semula / buang gambar</Button>
              </div>
            )}
            {form.lampiran_fail && <p className="text-data">Fail dipilih: {form.lampiran_fail.name}</p>}
          </div>
          <div className="space-y-2">
            <p className="label-caps">Bahagian 5: Hantar laporan</p>
            <Button className="w-full sm:w-auto" disabled={submitting}>{submitting ? 'Menghantar...' : 'Hantar laporan'}</Button>
          </div>
        </form>
      </Card>
      <div className="space-y-5">
        {submitted && <AlertMessage type="success">Laporan berjaya dihantar dan dianalisis oleh NLP.</AlertMessage>}
        {nlp && <Card title="Keputusan NLP Rule-Based"><div className="space-y-3 text-sm"><p><span className="font-medium text-primary-token">Status laporan:</span> {submitted?.status_laporan}</p><p><span className="font-medium text-primary-token">Kategori:</span> {nlp.kategori_dikesan}</p><p><span className="font-medium text-primary-token">Skor risiko:</span> <span className="text-data">{nlp.skor_risiko}</span></p><p><span className="font-medium text-primary-token">Tahap risiko:</span> <Badge tone={nlp.tahap_risiko}>{nlp.tahap_risiko}</Badge></p><p><span className="font-medium text-primary-token">Kata kunci:</span> {nlp.kata_kunci_dikesan.join(', ')}</p><p><span className="font-medium text-primary-token">Ringkasan:</span> {nlp.ringkasan_automatik}</p></div></Card>}
        <Card title="Laporan Saya">{reports.map((report) => <div key={report.id_laporan} className="app-row mb-2 rounded-md border p-3 text-sm"><div className="flex justify-between gap-2"><span className="font-medium text-primary-token">{report.tajuk_laporan}</span><Badge tone={report.tahap_risiko}>{report.tahap_risiko}</Badge></div><p>{report.nama_pos} - {report.status_laporan}</p>{report.lampiran_fail && <a className="text-primary-token mt-2 inline-flex items-center gap-1 text-sm font-medium underline" href={`${API_ORIGIN}${report.lampiran_fail}`} target="_blank" rel="noreferrer"><Paperclip size={14} /> Lampiran</a>}</div>)}</Card>
      </div>
    </div>
  );
}

function ReportDetailContent({ detail }) {
  if (!detail) return null;
  return (
    <div className="space-y-4 text-sm">
      <div>
        <h3>{detail.report.tajuk_laporan}</h3>
        <p>{detail.report.nama_penuh} - {detail.report.nama_pos} - {detail.report.syif}</p>
        <p className="mt-2">{detail.report.kandungan_laporan}</p>
        {detail.report.lampiran_fail && <a className="text-primary-token mt-2 inline-flex items-center gap-1 font-medium underline" href={`${API_ORIGIN}${detail.report.lampiran_fail}`} target="_blank" rel="noreferrer"><Paperclip size={14} /> Buka lampiran bukti</a>}
      </div>
      <div className="app-row rounded-md border p-3">
        <p className="font-medium text-primary-token">Analisis NLP</p>
        <p>Kategori: {detail.report.kategori_dikesan || '-'}</p>
        <p>Skor risiko: <span className="text-data">{detail.report.skor_risiko ?? '-'}</span> - <Badge tone={detail.report.tahap_risiko}>{detail.report.tahap_risiko}</Badge></p>
        <p>Kata kunci: {(detail.report.kata_kunci_dikesan || []).join(', ') || '-'}</p>
        <p>Keyakinan: {Number(detail.report.tahap_keyakinan || 0).toFixed(2)}</p>
      </div>
      <div>
        <p className="mb-2 font-medium text-primary-token">Checklist</p>
        {detail.checklist.length ? detail.checklist.map((item) => <div key={item.id_jawapan} className="app-row mb-2 rounded-md border p-3"><span className="font-medium text-primary-token">{item.nama_checklist}</span><p>{item.jawapan}{item.catatan ? ` - ${item.catatan}` : ''}</p></div>) : <p>Tiada checklist direkodkan.</p>}
      </div>
      <div>
        <p className="mb-2 font-medium text-primary-token">Sejarah Semakan</p>
        {detail.reviews.length ? detail.reviews.map((item) => <div key={item.id_pengesahan} className="app-row mb-2 rounded-md border p-3"><span className="font-medium text-primary-token">{item.status_pengesahan}</span><p>{item.catatan_pengesahan || '-'}</p><p className="text-data">{item.nama_penuh} - {new Date(item.tarikh_pengesahan).toLocaleString()}</p></div>) : <p>Belum disemak.</p>}
      </div>
      <div>
        <p className="mb-2 font-medium text-primary-token">Tindakan Susulan</p>
        {detail.actions.length ? detail.actions.map((item) => <div key={item.id_tindakan} className="app-row mb-2 rounded-md border p-3"><span className="font-medium text-primary-token">{item.tahap_keutamaan}</span><p>{item.tindakan_diambil}</p><p className="text-data">{item.pegawai_bertanggungjawab} - {item.status_tindakan}</p></div>) : <p>Tiada tindakan susulan.</p>}
      </div>
    </div>
  );
}

function ReviewReports() {
  const [reports, setReports] = useState([]);
  const [comments, setComments] = useState({});
  const [detail, setDetail] = useState(null);
  const [confirmReview, setConfirmReview] = useState(null);
  const load = useCallback(() => api.get('/reports').then((res) => setReports(res.data)), []);
  useEffect(() => { load(); }, [load]);
  const loadDetail = async (id) => {
    try {
      const { data } = await api.get(`/reports/${id}`);
      setDetail(data);
      toast.success('Detail laporan dibuka');
    } catch (error) {
      notifyError(error, 'Detail laporan gagal dibuka');
    }
  };
  const review = async (id, status) => {
    try {
      await api.patch(`/reports/${id}/review`, { status, comment: comments[id] || '' });
      setComments((prev) => ({ ...prev, [id]: '' }));
      setConfirmReview(null);
      toast.success(status === 'approved' ? 'Laporan diluluskan' : 'Laporan ditolak');
      await load();
      if (detail?.report?.id_laporan === id) loadDetail(id);
    } catch (error) {
      notifyError(error, 'Semakan laporan gagal');
    }
  };
  return (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <Card title="Semakan Laporan" action={<Button variant="ghost" onClick={() => downloadCsv('/reports/export.csv', 'laporan-harian.csv')}><Download size={16} /> CSV</Button>}>
        {reports.map((r) => (
          <article key={r.id_laporan} className={`mb-3 rounded-md border p-4 ${['High', 'Critical'].includes(r.tahap_risiko) ? 'app-row-alert' : 'app-row'}`}>
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <h3>{r.tajuk_laporan}</h3>
                <p className="text-data">{r.nama_penuh} - {r.nama_pos} - {r.tarikh_laporan?.slice(0, 10)} {r.masa_laporan}</p>
              </div>
              <Badge tone={r.tahap_risiko}>{r.tahap_risiko}</Badge>
            </div>
            <p className="mt-2 text-sm">{r.kandungan_laporan}</p>
            <p className="mt-2 text-sm"><span className="font-medium text-primary-token">NLP:</span> {r.kategori_dikesan} - skor <span className="text-data">{r.skor_risiko}</span>; kata kunci {(r.kata_kunci_dikesan || []).join(', ')}</p>
            {r.lampiran_fail && <a className="text-primary-token mt-2 inline-flex items-center gap-1 text-sm font-medium underline" href={`${API_ORIGIN}${r.lampiran_fail}`} target="_blank" rel="noreferrer"><Paperclip size={14} /> Lampiran bukti</a>}
            <div className="mt-3 grid gap-2 sm:grid-cols-[auto_1fr_auto_auto]">
              <Button variant="ghost" onClick={() => loadDetail(r.id_laporan)}><Eye size={16} /> Detail</Button>
              <Input placeholder="Catatan semakan" value={comments[r.id_laporan] || ''} onChange={(e) => setComments({ ...comments, [r.id_laporan]: e.target.value })} />
              <Button onClick={() => setConfirmReview({ id: r.id_laporan, status: 'approved', title: r.tajuk_laporan })}>Lulus</Button>
              <Button variant="danger" onClick={() => setConfirmReview({ id: r.id_laporan, status: 'rejected', title: r.tajuk_laporan })}>Tolak</Button>
            </div>
          </article>
        ))}
      </Card>
      <Card title={detail ? `Detail Laporan #${detail.report.id_laporan}` : 'Detail Laporan'}>
        {!detail ? <p className="text-sm">Pilih laporan untuk melihat checklist, sejarah semakan dan tindakan susulan.</p> : <ReportDetailContent detail={detail} />}
      </Card>
      {detail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(0,0,0,0.55)] p-0 sm:items-center sm:p-4">
          <div className="app-elevated max-h-[92vh] w-full overflow-y-auto rounded-t-lg border p-4 shadow-xl sm:max-w-3xl sm:rounded-lg">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2>Detail Laporan #{detail.report.id_laporan}</h2>
                <p className="text-sm">Maklumat penuh laporan harian pengawal.</p>
              </div>
              <Button variant="ghost" onClick={() => setDetail(null)}><X size={16} /> Tutup</Button>
            </div>
            <ReportDetailContent detail={detail} />
          </div>
        </div>
      )}
      <ConfirmModal
        open={!!confirmReview}
        title={confirmReview?.status === 'approved' ? 'Luluskan laporan?' : 'Tolak laporan?'}
        message={`Sahkan tindakan untuk laporan "${confirmReview?.title || ''}".`}
        confirmLabel={confirmReview?.status === 'approved' ? 'Luluskan' : 'Tolak'}
        danger={confirmReview?.status === 'rejected'}
        onCancel={() => setConfirmReview(null)}
        onConfirm={() => review(confirmReview.id, confirmReview.status)}
      />
    </div>
  );
}

function FollowUp() {
  const [reports, setReports] = useState([]);
  const [actions, setActions] = useState([]);
  const [form, setForm] = useState({ status_tindakan: 'Baru', tahap_keutamaan: 'High' });
  const load = useCallback(() => Promise.all([api.get('/reports'), api.get('/actions')]).then(([r, a]) => { setReports(r.data.filter((x) => ['High', 'Critical'].includes(x.tahap_risiko))); setActions(a.data); }), []);
  useEffect(() => { load(); }, [load]);
  const create = async (e) => { e.preventDefault(); try { await api.post('/actions', { ...form, id_laporan: Number(form.id_laporan) }); setForm({ status_tindakan: 'Baru', tahap_keutamaan: 'High' }); toast.success('Tindakan susulan disimpan'); load(); } catch (error) { notifyError(error, 'Tindakan gagal disimpan'); } };
  const update = async (id, status_tindakan) => { try { await api.patch(`/actions/${id}`, { status_tindakan }); toast.success(`Status tindakan: ${status_tindakan}`); load(); } catch (error) { notifyError(error, 'Status tindakan gagal dikemas kini'); } };
  return <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]"><Card title="Tambah Tindakan"><form onSubmit={create} className="space-y-3"><Field label="Laporan"><Select required value={form.id_laporan || ''} onChange={(e) => setForm({ ...form, id_laporan: e.target.value })}><option value="">Pilih laporan</option>{reports.map((r) => <option key={r.id_laporan} value={r.id_laporan}>{r.tajuk_laporan}</option>)}</Select></Field><Field label="Pegawai bertanggungjawab"><Input required value={form.pegawai_bertanggungjawab || ''} onChange={(e) => setForm({ ...form, pegawai_bertanggungjawab: e.target.value })} /></Field><Field label="Tindakan diambil"><Textarea required rows={4} value={form.tindakan_diambil || ''} onChange={(e) => setForm({ ...form, tindakan_diambil: e.target.value })} /></Field><Field label="Keutamaan"><Select value={form.tahap_keutamaan} onChange={(e) => setForm({ ...form, tahap_keutamaan: e.target.value })}><option>Medium</option><option>High</option><option>Critical</option></Select></Field><Button>Simpan tindakan</Button></form></Card><Card title="Senarai Tindakan" action={<Button variant="ghost" onClick={() => downloadCsv('/actions/export.csv', 'tindakan-susulan.csv')}><Download size={16} /> CSV</Button>}>{actions.map((a) => <div key={a.id_tindakan} className="app-row mb-3 rounded-md border p-4 text-sm"><div className="flex flex-wrap justify-between gap-2"><span className="font-medium text-primary-token">{a.tajuk_laporan}</span><Badge tone={a.tahap_keutamaan}>{a.tahap_keutamaan}</Badge></div><p className="mt-1">{a.tindakan_diambil}</p><p>Pegawai: {a.pegawai_bertanggungjawab} - Status: {a.status_tindakan}</p><div className="mt-3 flex gap-2"><Button variant="ghost" onClick={() => update(a.id_tindakan, 'Dalam Tindakan')}>Dalam Tindakan</Button><Button onClick={() => update(a.id_tindakan, 'Selesai')}>Selesai</Button></div></div>)}</Card></div>;
}

function SchedulePage({ auth }) {
  const canManage = [ROLE.admin, ROLE.chief].includes(auth.user?.nama_peranan);
  const [meta, setMeta] = useState({ posts: [], guards: [] });
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ date: '', pos: '', guard: '', status: '' });
  const [form, setForm] = useState({ tarikh: new Date().toISOString().slice(0, 10), syif: 'Pagi', status_bertugas: 'Dijadualkan' });
  const [error, setError] = useState('');
  const load = useCallback(() => api.get('/schedules', { params: filters }).then((res) => setRows(res.data)), [filters]);
  useEffect(() => { api.get('/meta').then((res) => setMeta(res.data)); }, []);
  useEffect(() => { load(); }, [load]);
  const create = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await api.post('/schedules', { ...form, id_pengguna: Number(form.id_pengguna), id_pos: Number(form.id_pos) });
      setForm({ tarikh: form.tarikh, syif: 'Pagi', status_bertugas: 'Dijadualkan' });
      toast.success('Jadual bertugas disimpan');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Jadual gagal disimpan');
      notifyError(err, 'Jadual gagal disimpan');
    }
  };
  const updateStatus = async (id, status_bertugas) => { try { await api.patch(`/schedules/${id}`, { status_bertugas }); toast.success(`Status jadual: ${status_bertugas}`); load(); } catch (error) { notifyError(error, 'Status jadual gagal dikemas kini'); } };

  return (
    <div className="space-y-5">
      <div>
        <h1>Jadual Bertugas</h1>
        <p className="text-sm">{canManage ? 'Tetapkan pengawal kepada pos, syif dan tarikh bertugas.' : 'Semak jadual bertugas saya.'}</p>
      </div>
      <Card title="Tapisan Jadual">
        <div className="grid gap-2 md:grid-cols-4">
          <Input type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} />
          <Select value={filters.pos} onChange={(e) => setFilters({ ...filters, pos: e.target.value })}><option value="">Semua pos</option>{meta.posts.map((p) => <option key={p.id_pos} value={p.id_pos}>{p.nama_pos}</option>)}</Select>
          {canManage && <Select value={filters.guard} onChange={(e) => setFilters({ ...filters, guard: e.target.value })}><option value="">Semua pengawal</option>{meta.guards.map((g) => <option key={g.id_pengguna} value={g.id_pengguna}>{g.nama_penuh}</option>)}</Select>}
          <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">Semua status</option><option>Dijadualkan</option><option>Bertugas</option><option>Selesai</option><option>Tidak Hadir</option></Select>
        </div>
      </Card>
      <div className={`grid gap-5 ${canManage ? 'lg:grid-cols-[0.75fr_1.25fr]' : ''}`}>
        {canManage && (
          <Card title="Tambah Jadual">
            <form onSubmit={create} className="space-y-3">
              <Field label="Pengawal"><Select required value={form.id_pengguna || ''} onChange={(e) => setForm({ ...form, id_pengguna: e.target.value })}><option value="">Pilih pengawal</option>{meta.guards.map((g) => <option key={g.id_pengguna} value={g.id_pengguna}>{g.nama_penuh}</option>)}</Select></Field>
              <Field label="Pos kawalan"><Select required value={form.id_pos || ''} onChange={(e) => setForm({ ...form, id_pos: e.target.value })}><option value="">Pilih pos</option>{meta.posts.map((p) => <option key={p.id_pos} value={p.id_pos}>{p.nama_pos}</option>)}</Select></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Tarikh"><Input type="date" required value={form.tarikh} onChange={(e) => setForm({ ...form, tarikh: e.target.value })} /></Field>
                <Field label="Syif"><Select value={form.syif} onChange={(e) => setForm({ ...form, syif: e.target.value })}><option>Pagi</option><option>Petang</option><option>Malam</option></Select></Field>
                <Field label="Masa mula"><Input type="time" value={form.masa_mula || ''} onChange={(e) => setForm({ ...form, masa_mula: e.target.value })} /></Field>
                <Field label="Masa tamat"><Input type="time" value={form.masa_tamat || ''} onChange={(e) => setForm({ ...form, masa_tamat: e.target.value })} /></Field>
              </div>
              {error && <p className="status-error rounded-md border px-3 py-2 text-sm">{error}</p>}
              <Button>Simpan jadual</Button>
            </form>
          </Card>
        )}
        <Card title="Senarai Jadual">
          {rows.length ? rows.map((s) => (
            <div key={s.id_status} className="app-row mb-3 grid gap-3 rounded-md border p-4 text-sm md:grid-cols-[1fr_auto]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-primary-token">{s.nama_penuh}</span>
                  <Badge>{s.status_bertugas}</Badge>
                </div>
                <p>{s.nama_pos} - {s.nama_bangunan || s.lokasi || '-'}</p>
                <p className="text-data">{s.tarikh?.slice(0, 10)} - {s.syif} - {s.masa_mula || '--:--'} hingga {s.masa_tamat || '--:--'}</p>
              </div>
              {canManage && (
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <Button variant="ghost" onClick={() => updateStatus(s.id_status, 'Bertugas')}>Bertugas</Button>
                  <Button variant="ghost" onClick={() => updateStatus(s.id_status, 'Selesai')}>Selesai</Button>
                  <Button variant="danger" onClick={() => updateStatus(s.id_status, 'Tidak Hadir')}>Tidak Hadir</Button>
                </div>
              )}
            </div>
          )) : <p className="text-sm">Tiada jadual dijumpai.</p>}
        </Card>
      </div>
    </div>
  );
}

function AuditTrail() {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ user: '', module: '', activity: '', date: '', status: '' });
  const load = useCallback(() => api.get('/audit', { params: filters }).then((res) => setRows(res.data)), [filters]);
  useEffect(() => { load(); }, [load]);
  return (
    <Card title="Audit Trail" action={<Button variant="ghost" onClick={() => downloadCsv('/audit/export.csv', 'audit-trail.csv')}><Download size={16} /> CSV</Button>}>
      <div className="mb-3 grid gap-2 md:grid-cols-5">
        <Input placeholder="User" value={filters.user} onChange={(e) => setFilters({ ...filters, user: e.target.value })} />
        <Input placeholder="Modul" value={filters.module} onChange={(e) => setFilters({ ...filters, module: e.target.value })} />
        <Input placeholder="Aktiviti" value={filters.activity} onChange={(e) => setFilters({ ...filters, activity: e.target.value })} />
        <Input type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} />
        <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">Semua status</option><option>Berjaya</option><option>Gagal</option></Select>
      </div>
      <div className="space-y-3 md:hidden">
        {rows.length ? rows.map((r) => (
          <div key={r.id_audit} className="app-row rounded-md border p-3 text-sm">
            <p className="text-data">{new Date(r.tarikh_masa_aktiviti).toLocaleString()}</p>
            <p className="font-medium text-primary-token">{r.jenis_aktiviti}</p>
            <p>{r.modul_sistem} - {r.status_aktiviti}</p>
            <p>{r.nama_penuh || '-'} - {r.nama_peranan || '-'}</p>
          </div>
        )) : <EmptyState title="Tiada audit" description="Log audit akan dipaparkan selepas aktiviti sistem." />}
      </div>
      <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead><tr className="app-divider border-b"><th className="py-2">Masa</th><th>User</th><th>Role</th><th>Aktiviti</th><th>Modul</th><th>Status</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id_audit} className="app-divider border-b"><td className="text-data py-2">{new Date(r.tarikh_masa_aktiviti).toLocaleString()}</td><td>{r.nama_penuh || '-'}</td><td>{r.nama_peranan || '-'}</td><td>{r.jenis_aktiviti}</td><td>{r.modul_sistem}</td><td>{r.status_aktiviti}</td></tr>)}</tbody></table></div>
    </Card>
  );
}

function NotificationsPage() {
  const [rows, setRows] = useState([]);
  const navigate = useNavigate();
  const load = useCallback(() => api.get('/notifications').then((res) => setRows(res.data)), []);
  useEffect(() => { load(); }, [load]);
  const markRead = async (id) => { try { await api.patch(`/notifications/${id}/read`); toast.success('Notifikasi ditanda dibaca'); load(); } catch (error) { notifyError(error, 'Notifikasi gagal dikemas kini'); } };
  return <Card title="Notifikasi">{rows.map((n) => <div key={n.id_notifikasi} className="app-row mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border p-4 text-sm"><div><div className="flex items-center gap-2"><span className="font-medium text-primary-token">{n.tajuk_notifikasi}</span><Badge tone={n.tahap_keutamaan}>{n.tahap_keutamaan}</Badge></div><p className="mt-1">{n.mesej_notifikasi}</p><p className="text-data">{new Date(n.tarikh_hantar).toLocaleString()} - {n.status_bacaan}</p></div><div className="flex flex-wrap gap-2">{n.id_laporan && <Button variant="ghost" onClick={() => navigate('/semakan')}><Eye size={16} /> Buka laporan</Button>}{n.status_bacaan !== 'Dibaca' && <Button variant="ghost" onClick={() => markRead(n.id_notifikasi)}>Tanda dibaca</Button>}</div></div>)}</Card>;
}

function ChangePasswordPage() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');
    if (form.newPassword !== form.confirmPassword) return setError('Kata laluan baharu tidak sepadan');
    try {
      await api.post('/auth/change-password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMessage('Kata laluan berjaya ditukar');
      toast.success('Kata laluan berjaya ditukar');
    } catch (err) {
      setError(err.response?.data?.message || 'Kata laluan gagal ditukar');
      notifyError(err, 'Kata laluan gagal ditukar');
    }
  };
  return (
    <div className="max-w-xl">
      <Card title="Tukar Kata Laluan">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Kata laluan semasa"><PasswordInput required value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} /></Field>
          <Field label="Kata laluan baharu"><PasswordInput required value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} /></Field>
          <Field label="Sahkan kata laluan baharu"><PasswordInput required value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} /></Field>
          {error && <AlertMessage>{error}</AlertMessage>}
          {message && <AlertMessage type="success">{message}</AlertMessage>}
          <Button className="w-full sm:w-auto">Tukar kata laluan</Button>
        </form>
      </Card>
    </div>
  );
}

function UsersPage() {
  const [meta, setMeta] = useState({ roles: [] });
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [confirmUser, setConfirmUser] = useState(null);
  const load = useCallback(() => Promise.all([api.get('/meta'), api.get('/users')]).then(([m, u]) => { setMeta(m.data); setUsers(u.data); }), []);
  useEffect(() => { load(); }, [load]);
  const create = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/users', form);
      setForm({});
      toast.success('Pengguna berjaya ditambah');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Pengguna gagal ditambah');
      notifyError(err, 'Pengguna gagal ditambah');
    }
  };
  const update = async (id, patch) => { try { await api.patch(`/users/${id}`, patch); toast.success('Pengguna dikemas kini'); load(); } catch (error) { notifyError(error, 'Pengguna gagal dikemas kini'); } };
  return <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]"><Card title="Tambah Pengguna"><form onSubmit={create} className="space-y-3"><Field label="Peranan"><Select required value={form.id_peranan || ''} onChange={(e) => setForm({ ...form, id_peranan: Number(e.target.value) })}><option value="">Pilih peranan</option>{meta.roles.map((r) => <option key={r.id_peranan} value={r.id_peranan}>{r.nama_peranan}</option>)}</Select></Field><Field label="Nama penuh"><Input required value={form.nama_penuh || ''} onChange={(e) => setForm({ ...form, nama_penuh: e.target.value })} /></Field><Field label="Nama pengguna"><Input required value={form.nama_pengguna || ''} onChange={(e) => setForm({ ...form, nama_pengguna: e.target.value })} /></Field><Field label="Emel"><Input type="email" required value={form.emel || ''} onChange={(e) => setForm({ ...form, emel: e.target.value })} /></Field><Field label="No telefon"><Input value={form.no_telefon || ''} onChange={(e) => setForm({ ...form, no_telefon: e.target.value })} /></Field><Field label="Kata laluan sementara"><PasswordInput required value={form.kata_laluan || ''} onChange={(e) => setForm({ ...form, kata_laluan: e.target.value })} /></Field>{error && <AlertMessage>{error}</AlertMessage>}<Button className="w-full sm:w-auto">Tambah pengguna</Button></form></Card><Card title="Senarai Pengguna">{users.length ? users.map((u) => <div key={u.id_pengguna} className="app-row mb-2 grid gap-2 rounded-md border p-3 text-sm md:grid-cols-[1fr_220px_auto]"><span><span className="font-medium text-primary-token">{u.nama_penuh}</span><br />{u.nama_pengguna} - {u.emel}</span><Select value={u.id_peranan} onChange={(e) => update(u.id_pengguna, { id_peranan: Number(e.target.value) })}>{meta.roles.map((r) => <option key={r.id_peranan} value={r.id_peranan}>{r.nama_peranan}</option>)}</Select><Button variant="ghost" onClick={() => setConfirmUser(u)}>{u.status_akaun}</Button></div>) : <EmptyState title="Tiada pengguna" description="Pengguna baharu akan dipaparkan di sini." />}</Card><ConfirmModal open={!!confirmUser} title="Tukar status akaun?" message={`Akaun ${confirmUser?.nama_penuh || ''} akan ditukar status.`} confirmLabel="Sahkan" danger={confirmUser?.status_akaun === 'Aktif'} onCancel={() => setConfirmUser(null)} onConfirm={async () => { await update(confirmUser.id_pengguna, { status_akaun: confirmUser.status_akaun === 'Aktif' ? 'Tidak Aktif' : 'Aktif' }); setConfirmUser(null); }} /></div>;
}

function PostsPage() {
  const [posts, setPosts] = useState([]);
  const [form, setForm] = useState({ status_pos: 'Aktif' });
  const load = useCallback(() => api.get('/posts').then((res) => setPosts(res.data)), []);
  useEffect(() => { load(); }, [load]);
  const create = async (e) => { e.preventDefault(); try { await api.post('/posts', form); setForm({ status_pos: 'Aktif' }); toast.success('Pos kawalan disimpan'); load(); } catch (error) { notifyError(error, 'Pos kawalan gagal disimpan'); } };
  const update = async (id, patch) => { try { await api.patch(`/posts/${id}`, patch); toast.success('Pos kawalan dikemas kini'); load(); } catch (error) { notifyError(error, 'Pos kawalan gagal dikemas kini'); } };
  return <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]"><Card title="Tambah Pos Kawalan"><form onSubmit={create} className="space-y-3"><Field label="Nama pos"><Input required value={form.nama_pos || ''} onChange={(e) => setForm({ ...form, nama_pos: e.target.value })} /></Field><Field label="Bangunan"><Input value={form.nama_bangunan || ''} onChange={(e) => setForm({ ...form, nama_bangunan: e.target.value })} /></Field><Field label="Lokasi"><Input value={form.lokasi || ''} onChange={(e) => setForm({ ...form, lokasi: e.target.value })} /></Field><Field label="Waktu operasi"><Input value={form.waktu_operasi || ''} onChange={(e) => setForm({ ...form, waktu_operasi: e.target.value })} /></Field><Button>Simpan pos</Button></form></Card><Card title="Senarai Pos">{posts.map((p) => <div key={p.id_pos} className="app-row mb-2 grid gap-2 rounded-md border p-3 text-sm md:grid-cols-[1fr_auto]"><span><span className="font-medium text-primary-token">{p.nama_pos}</span><p>{p.nama_bangunan} - {p.lokasi} - {p.waktu_operasi}</p></span><Button variant="ghost" onClick={() => update(p.id_pos, { status_pos: p.status_pos === 'Aktif' ? 'Tidak Aktif' : 'Aktif' })}>{p.status_pos}</Button></div>)}</Card></div>;
}

function App() {
  const auth = useAuth();
  const defaultPath = useMemo(() => auth.user?.nama_peranan === ROLE.guard ? '/pengawal' : '/dashboard', [auth.user]);
  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3500,
          style: {
            background: 'var(--color-bg-elevated)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border-default)',
            fontFamily: 'var(--font-ui)',
            fontSize: 'var(--fs-body)',
          },
        }}
      />
      <Routes>
        <Route path="/login" element={auth.user ? <Navigate to={defaultPath} replace /> : <Login auth={auth} />} />
        <Route path="/dashboard" element={<Protected auth={auth} roles={[ROLE.admin, ROLE.chief]}><Dashboard /></Protected>} />
        <Route path="/pengawal" element={<Protected auth={auth} roles={[ROLE.guard]}><GuardDashboard /></Protected>} />
        <Route path="/jadual" element={<Protected auth={auth} roles={[ROLE.admin, ROLE.chief, ROLE.guard]}><SchedulePage auth={auth} /></Protected>} />
        <Route path="/laporan" element={<Protected auth={auth} roles={[ROLE.guard]}><DailyReport /></Protected>} />
        <Route path="/semakan" element={<Protected auth={auth} roles={[ROLE.chief]}><ReviewReports /></Protected>} />
        <Route path="/tindakan" element={<Protected auth={auth} roles={[ROLE.chief]}><FollowUp /></Protected>} />
        <Route path="/audit" element={<Protected auth={auth} roles={[ROLE.admin]}><AuditTrail /></Protected>} />
        <Route path="/pengguna" element={<Protected auth={auth} roles={[ROLE.admin]}><UsersPage /></Protected>} />
        <Route path="/pos" element={<Protected auth={auth} roles={[ROLE.admin]}><PostsPage /></Protected>} />
        <Route path="/notifikasi" element={<Protected auth={auth} roles={[ROLE.admin, ROLE.chief]}><NotificationsPage /></Protected>} />
        <Route path="/kata-laluan" element={<Protected auth={auth} roles={[ROLE.admin, ROLE.chief, ROLE.guard]}><ChangePasswordPage /></Protected>} />
        <Route path="*" element={<Navigate to={auth.user ? defaultPath : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
