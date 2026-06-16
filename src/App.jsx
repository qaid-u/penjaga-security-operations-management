import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Bell, Brain, CalendarDays, Camera, ChevronDown, ClipboardCheck, Download, Eye, EyeOff, FileCheck, FileText, History, KeyRound, LayoutDashboard, LogOut, MapPin, Menu, Paperclip, RotateCcw, Shield, Upload, Users, X } from 'lucide-react';
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
const maxEvidenceFiles = 6;

function parseAttachmentPaths(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [value];
  } catch {
    return [value];
  }
}

function AttachmentLinks({ value, label = 'Lampiran bukti' }) {
  const paths = parseAttachmentPaths(value);
  if (!paths.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {paths.map((path, index) => (
        <a key={`${path}-${index}`} className="text-primary-token inline-flex items-center gap-1 text-sm font-medium underline" href={`${API_ORIGIN}${path}`} target="_blank" rel="noreferrer">
          <Paperclip size={14} /> {paths.length > 1 ? `${label} ${index + 1}` : label}
        </a>
      ))}
    </div>
  );
}

function EvidencePreview({ value }) {
  const paths = parseAttachmentPaths(value);
  if (!paths.length) return null;
  const imagePaths = paths.filter((path) => /\.(jpe?g|png|webp)$/i.test(path));
  const documentPaths = paths.filter((path) => !/\.(jpe?g|png|webp)$/i.test(path));
  return (
    <section>
      <p className="document-section-title">Bukti Bergambar</p>
      {imagePaths.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {imagePaths.map((path, index) => (
            <a key={path} href={`${API_ORIGIN}${path}`} target="_blank" rel="noreferrer" className="rounded-lg border bg-white p-2">
              <img src={`${API_ORIGIN}${path}`} alt={`Bukti laporan ${index + 1}`} className="h-48 w-full rounded-md object-contain" />
              <p className="mt-2 text-center text-xs font-medium text-primary-token">Bukti gambar {index + 1}</p>
            </a>
          ))}
        </div>
      ) : <p className="document-box text-secondary-token">Tiada gambar dilampirkan untuk laporan ini.</p>}
      {documentPaths.length > 0 && (
        <div className="mt-3">
          <p className="label-caps mb-2">Lampiran dokumen</p>
          <AttachmentLinks value={documentPaths} label="Buka dokumen" />
        </div>
      )}
    </section>
  );
}

function dateToWeekValue(value) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function monthLabel(value) {
  if (!value) return '';
  const [year, month] = value.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('ms-MY', { month: 'long', year: 'numeric' });
}

function recentMonthOptions(count = 36) {
  const options = [];
  const cursor = new Date();
  cursor.setDate(1);
  for (let index = 0; index < count; index += 1) {
    options.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
    cursor.setMonth(cursor.getMonth() - 1);
  }
  return options;
}

function weekLabel(value) {
  if (!value) return '';
  const [year, week] = value.split('-W').map(Number);
  const janFourth = new Date(Date.UTC(year, 0, 4));
  const janFourthDay = janFourth.getUTCDay() || 7;
  const weekStart = new Date(janFourth);
  weekStart.setUTCDate(janFourth.getUTCDate() - janFourthDay + 1 + ((week - 1) * 7));
  const monthName = weekStart.toLocaleDateString('ms-MY', { month: 'long' });
  const weekOfMonth = Math.ceil(weekStart.getUTCDate() / 7);
  return `${monthName} Minggu ${weekOfMonth}`;
}

async function downloadCsv(path, filename) {
  try {
    const { data } = await api.get(path, { responseType: 'blob' });
    const url = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    notifySuccess(`${filename} dimuat turun`);
  } catch (error) {
    notifyError(error, 'Fail CSV gagal dimuat turun');
  }
}

function notifyError(error, fallback = 'Tindakan gagal. Sila cuba lagi.') {
  playFeedbackTone('error');
  toast.error(error?.response?.data?.message || error?.message || fallback);
}

function playFeedbackTone(type = 'success') {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    const gain = context.createGain();
    const oscillator = context.createOscillator();
    const secondOscillator = context.createOscillator();
    const now = context.currentTime;
    const frequencies = type === 'error' ? [220, 164] : type === 'action' ? [440, 554] : [523, 659];

    oscillator.frequency.setValueAtTime(frequencies[0], now);
    secondOscillator.frequency.setValueAtTime(frequencies[1], now + 0.06);
    oscillator.type = 'sine';
    secondOscillator.type = 'sine';
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.06, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    oscillator.connect(gain);
    secondOscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    secondOscillator.start(now + 0.055);
    oscillator.stop(now + 0.16);
    secondOscillator.stop(now + 0.2);
    window.setTimeout(() => context.close(), 260);
  } catch {
    // Audio feedback is optional; ignore browsers that block it.
  }
}

function notifySuccess(message) {
  playFeedbackTone('success');
  toast.success(message);
}

function notifyAction(message) {
  playFeedbackTone('action');
  toast(message);
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
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[var(--fs-label)] font-medium ${tones[tone] || tones.default}`}>{children}</span>;
}

function Card({ title, children, action, className = '' }) {
  return (
    <section className={`app-surface rounded-2xl border p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className={title ? 'gov-card-title text-[var(--color-brand-navy)]' : ''}>{title}</h2>
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
  return <input {...props} className={`app-input w-full rounded-lg border px-3 py-2 text-sm ${props.className || ''}`} />;
}

function Select(props) {
  return <select {...props} className={`app-input w-full rounded-lg border px-3 py-2 text-sm ${props.className || ''}`} />;
}

function Textarea(props) {
  return <textarea {...props} className={`app-input w-full rounded-lg border px-3 py-2 text-sm ${props.className || ''}`} />;
}

function Button({ children, variant = 'primary', ...props }) {
  const variants = {
    primary: 'app-button-primary',
    ghost: 'app-button-ghost border',
    danger: 'app-button-danger',
  };
  return <button {...props} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 ${variants[variant]} ${props.className || ''}`}>{children}</button>;
}

function ChecklistChoice({ active, children, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`min-h-10 rounded-lg border px-3 py-2 text-sm font-medium ${active ? 'app-button-primary' : 'app-button-ghost'}`}>
      {active ? '✓ ' : ''}{children}
    </button>
  );
}

function PageHeader({ title, description, action }) {
  return (
    <div className="app-surface mb-5 rounded-2xl border p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="border-l-4 border-[var(--color-brand-gold)] pl-4">
          <p className="label-caps">PENJAGA</p>
          <h1 className="mt-1 text-[var(--color-brand-navy)]">{title}</h1>
          {description && <p className="mt-2 max-w-3xl text-sm">{description}</p>}
        </div>
        {action && <div className="flex flex-wrap gap-2 sm:justify-end">{action}</div>}
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return <Card><p className="label-caps">{label}</p><p className="text-kpi mt-3">{value}</p></Card>;
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
      <div className="app-elevated motion-sheet w-full max-w-md rounded-lg border p-4 shadow-xl">
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

function statusTone(status) {
  if (['Diluluskan', 'Selesai', 'Aktif', 'Disahkan', 'Hadir'].includes(status)) return 'Low';
  if (['Ditolak', 'Tidak Hadir', 'Tidak Aktif', 'Lewat'].includes(status)) return 'Critical';
  if (['Dihantar', 'Dalam Semakan', 'Dalam Tindakan', 'Draf', 'Dijadualkan'].includes(status)) return 'Medium';
  if (['Dikunci'].includes(status)) return 'High';
  return 'default';
}

const shiftTimes = {
  Pagi: { start: '07:00', end: '16:00', label: '07:00-16:00' },
  Petang: { start: '14:45', end: '23:45', label: '14:45-23:45' },
  Malam: { start: '23:00', end: '08:00', label: '23:00-08:00' },
  'Office Hour': { start: '07:00', end: '17:00', label: '07:00-17:00' },
};

function shiftTimeLabel(shift) {
  return shiftTimes[shift]?.label || 'Masa belum ditetapkan';
}

function ReportLifecycle({ report, actions = [] }) {
  const hasOpenAction = actions.some((item) => item.status_tindakan !== 'Selesai');
  const requiresAction = report.status_laporan === 'Diluluskan' && ['High', 'Critical'].includes(report.tahap_risiko);
  const steps = [
    { label: 'Dihantar', active: true },
    { label: report.status_laporan === 'Ditolak' ? 'Ditolak' : 'Diluluskan', active: ['Diluluskan', 'Ditolak'].includes(report.status_laporan) },
    { label: 'Tindakan Susulan', active: requiresAction && actions.length > 0, pending: requiresAction && actions.length === 0 },
    { label: 'Selesai', active: actions.length > 0 && !hasOpenAction },
  ];
  return (
    <div className="app-row rounded-md border p-3">
      <p className="mb-3 font-medium text-primary-token">Aliran Status Laporan</p>
      <div className="grid gap-2 sm:grid-cols-4">
        {steps.map((step) => (
          <div key={step.label} className={`rounded-md border p-3 ${step.active ? 'status-success' : step.pending ? 'badge-medium' : 'badge-default'}`}>
            <p className="font-medium">{step.label}</p>
            <p className="text-[var(--fs-small)]">{step.active ? 'Selesai' : step.pending ? 'Perlu tindakan' : 'Belum'}</p>
          </div>
        ))}
      </div>
      {report.status_laporan === 'Ditolak' && <p className="mt-3">Laporan ditolak. Pengawal perlu semak catatan dan hantar laporan baharu jika pembetulan diperlukan.</p>}
      {requiresAction && actions.length === 0 && <p className="mt-3">Laporan risiko tinggi telah diluluskan. Admin perlu cipta tindakan susulan.</p>}
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
      notifyError({ message: result.message }, result.message);
      return setError(result.message);
    }
    notifySuccess('Login berjaya');
    navigate(result.role === ROLE.guard ? '/pengawal' : '/dashboard');
  };

  return (
    <main className="login-hero min-h-screen">
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center text-white">
            <div className="brand-mark mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"><Shield size={26} /></div>
            <p className="label-caps text-[rgba(255,255,255,0.72)]">Portal Operasi Keselamatan</p>
            <h1 className="mt-2 text-white">PENJAGA</h1>
            <p className="mt-2 text-sm text-[rgba(255,255,255,0.78)]">Sistem Pengurusan Operasi Keselamatan</p>
          </div>
          <Card title="Log Masuk Sistem">
            <form onSubmit={submit} className="space-y-4">
              <Field label="Nama pengguna"><Input value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" /></Field>
              <Field label="Kata laluan"><PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
              {error && <p className="status-error rounded-md border px-3 py-2 text-sm">{error}</p>}
              <Button className="w-full" disabled={auth.loading}>Log Masuk</Button>
            </form>
          </Card>
        </div>
      </div>
    </main>
  );
}

function Shell({ auth, children }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const nav = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: [ROLE.admin, ROLE.chief] },
    { to: '/pengawal', label: 'Dashboard', icon: LayoutDashboard, roles: [ROLE.guard] },
    { to: '/jadual', label: 'Jadual Bertugas', icon: CalendarDays, roles: [ROLE.admin, ROLE.chief, ROLE.guard] },
    { to: '/laporan', label: 'Hantar Laporan', icon: FileText, roles: [ROLE.guard] },
    { to: '/semakan', label: 'Semakan Laporan', icon: FileCheck, roles: [ROLE.admin, ROLE.chief] },
    { to: '/tindakan', label: 'Tindakan Susulan', icon: ClipboardCheck, roles: [ROLE.admin, ROLE.chief] },
    { to: '/nlp', label: 'Analisis NLP', icon: Brain, roles: [ROLE.admin] },
    { to: '/audit', label: 'Audit Trail', icon: History, roles: [ROLE.admin] },
    { to: '/pengguna', label: 'Pengurusan Pengguna', icon: Users, roles: [ROLE.admin] },
    { to: '/pos', label: 'Pos Kawalan', icon: MapPin, roles: [ROLE.admin] },
    { to: '/notifikasi', label: 'Notifikasi', icon: Bell, roles: [ROLE.admin, ROLE.chief, ROLE.guard] },
    { to: '/kata-laluan', label: 'Profil', icon: KeyRound, roles: [ROLE.admin, ROLE.chief, ROLE.guard] },
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
        <div className="flex min-h-20 items-center justify-between border-b border-white/10 px-5">
          <div className="flex items-center gap-3 font-medium">
            <span className="brand-mark flex h-10 w-10 items-center justify-center rounded-xl"><Shield size={20} /></span>
            <span><span className="block text-white">PENJAGA</span><span className="block text-[11px] font-normal text-white/60">Operasi Keselamatan</span></span>
          </div>
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
        <header className="app-surface app-divider flex min-h-16 items-center gap-3 border-b px-3 sm:px-4 lg:px-6">
          <button className="shrink-0 lg:hidden" onClick={() => setOpen(true)} aria-label="Buka menu"><Menu size={22} /></button>
          <div className="hidden min-w-0 lg:block">
            <p className="label-caps">Sistem Pengurusan Operasi Keselamatan</p>
            <p className="font-medium text-primary-token">Panel Operasi PENJAGA</p>
          </div>
          <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="min-w-0 text-right">
              <p className="truncate text-sm font-medium text-primary-token">{auth.user?.nama_penuh}</p>
              <span className="block truncate text-[11px] font-medium text-tertiary-token sm:hidden">{auth.user?.nama_peranan}</span>
              <span className="hidden sm:inline-flex"><Badge>{auth.user?.nama_peranan}</Badge></span>
            </div>
            <Button variant="ghost" onClick={doLogout} className="min-h-10 shrink-0 px-3" aria-label="Logout"><LogOut size={16} /><span className="hidden sm:inline">Logout</span></Button>
          </div>
        </header>
        <main className="app-page mx-auto min-h-[calc(100vh-7.5rem)] max-w-screen-2xl p-4 lg:p-6">{children}</main>
        <footer className="app-surface app-divider border-t px-4 py-4 text-center text-sm text-tertiary-token lg:px-6">PENJAGA (c) 2026 | Sistem Pengurusan Operasi Keselamatan</footer>
      </div>
      <nav className="app-surface fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t px-1 py-2 lg:hidden">
        {mobileNav.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium ${isActive ? 'app-nav-active' : 'app-nav'}`}>
              <Icon size={18} />
              <span className="max-w-full truncate px-1">{item.label.replace('Dashboard Saya', 'Dashboard').replace('Jadual Bertugas', 'Jadual').replace('Hantar Laporan', 'Laporan').replace('Laporan Harian', 'Laporan').replace('Semakan Laporan', 'Semakan').replace('Tindakan Susulan', 'Tindakan').replace('Audit Trail', 'Audit').replace('Pengurusan Pengguna', 'Pengguna').replace('Pos Kawalan', 'Pos')}</span>
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
  const navigate = useNavigate();
  if (!auth.user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(auth.user.nama_peranan)) {
    return (
      <Shell auth={auth}>
        <Card title="Akses Tidak Dibenarkan">
          <p>Anda tidak mempunyai kebenaran untuk mengakses halaman ini.</p>
          <Button className="mt-4" onClick={() => navigate(auth.user.nama_peranan === ROLE.guard ? '/pengawal' : '/dashboard')}>Kembali ke dashboard</Button>
        </Card>
      </Shell>
    );
  }
  return <Shell auth={auth}>{children}</Shell>;
}

function Dashboard() {
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState({ posts: [] });
  const [filters, setFilters] = useState({ date: '', location: '', risk: '' });
  const navigate = useNavigate();
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
    <div className="desktop-ops space-y-5">
      <PageHeader title="Dashboard Analitik" description="Pantau laporan, risiko, tindakan dan jadual operasi keselamatan." action={<Button variant="ghost" onClick={() => navigate('/jadual')}><CalendarDays size={16} /> Buka Jadual Bertugas</Button>} />
      <FilterPanel>
        <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-[180px_1fr_180px]">
          <Input type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} />
          <Select value={filters.location} onChange={(e) => setFilters({ ...filters, location: e.target.value })}><option value="">Semua lokasi</option>{meta.posts.map((p) => <option key={p.id_pos} value={p.id_pos}>{p.nama_pos}</option>)}</Select>
          <Select value={filters.risk} onChange={(e) => setFilters({ ...filters, risk: e.target.value })}><option value="">Semua risiko</option><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></Select>
        </div>
      </FilterPanel>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{cards.map(([label, value]) => (
        label === 'Jadual hari ini'
          ? <button key={label} type="button" onClick={() => navigate('/jadual')} className="text-left"><StatCard label={label} value={value} /></button>
          : <StatCard key={label} label={label} value={value} />
      ))}</div>
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
  const [previewUrls, setPreviewUrls] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const previewUrlsRef = useRef([]);
  const load = useCallback(() => Promise.all([api.get('/meta'), api.get('/reports')]).then(([m, r]) => { setMeta(m.data); setReports(r.data); }), []);
  useEffect(() => { load(); }, [load]);
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }, []);
  useEffect(() => { previewUrlsRef.current = previewUrls; }, [previewUrls]);
  useEffect(() => () => {
    stopCamera();
    previewUrlsRef.current.forEach((item) => { if (item.url) URL.revokeObjectURL(item.url); });
  }, [stopCamera]);
  const addEvidenceFiles = (files = []) => {
    const selectedFiles = Array.from(files).filter(Boolean);
    if (!selectedFiles.length) return;
    setForm((prev) => {
      const currentFiles = prev.lampiran_fail || [];
      const nextFiles = [...currentFiles, ...selectedFiles].slice(0, maxEvidenceFiles);
      if (currentFiles.length + selectedFiles.length > maxEvidenceFiles) notifyError({ message: `Maksimum ${maxEvidenceFiles} lampiran sahaja untuk satu laporan` });
      return { ...prev, lampiran_fail: nextFiles };
    });
    const nextPreviews = selectedFiles.map((file) => ({ name: file.name, url: file.type?.startsWith('image/') ? URL.createObjectURL(file) : '' }));
    setPreviewUrls((current) => [...current, ...nextPreviews].slice(0, maxEvidenceFiles));
  };
  const removeEvidenceFile = (index) => {
    setForm((prev) => ({ ...prev, lampiran_fail: (prev.lampiran_fail || []).filter((_, fileIndex) => fileIndex !== index) }));
    setPreviewUrls((current) => {
      const preview = current[index];
      if (preview?.url) URL.revokeObjectURL(preview.url);
      return current.filter((_, previewIndex) => previewIndex !== index);
    });
  };
  const clearEvidenceFiles = () => {
    previewUrls.forEach((item) => { if (item.url) URL.revokeObjectURL(item.url); });
    setPreviewUrls([]);
    setForm((prev) => ({ ...prev, lampiran_fail: [] }));
  };
  const openCamera = async () => {
    setCameraError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Kamera tidak disokong oleh pelayar ini');
      notifyError({ message: 'Kamera tidak disokong oleh pelayar ini' });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      streamRef.current = stream;
      setCameraOpen(true);
      notifyAction('Kamera dibuka');
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 0);
    } catch {
      setCameraError('Kamera tidak dapat dibuka. Sila benarkan akses kamera atau guna lampiran fail.');
      notifyError({ message: 'Kamera tidak dapat dibuka' });
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
      addEvidenceFiles([file]);
      stopCamera();
      notifySuccess('Gambar bukti ditangkap');
    }, 'image/jpeg', 0.9);
  };
  const getChecklistValue = (id) => form.checklist.find((item) => item.id_checklist === id);
  const setChecklist = (id, key, value) => setForm((prev) => ({ ...prev, checklist: [...prev.checklist.filter((i) => i.id_checklist !== id), { ...(prev.checklist.find((i) => i.id_checklist === id) || { id_checklist: id, jawapan: '' }), [key]: value }] }));
  const submit = async (event) => {
    event.preventDefault();
    const unansweredChecklist = meta.checklist.filter((item) => !getChecklistValue(item.id_checklist)?.jawapan);
    if (unansweredChecklist.length) {
      notifyError({ message: `Sila jawab semua checklist. ${unansweredChecklist.length} item belum ditanda.` });
      return;
    }
    setSubmitting(true);
    try {
      const body = new FormData();
      Object.entries({ ...form, id_pos: Number(form.id_pos), id_kategori_insiden: form.id_kategori_insiden ? Number(form.id_kategori_insiden) : '' }).forEach(([key, value]) => {
        if (key === 'checklist') body.append(key, JSON.stringify(value));
        else if (key !== 'lampiran_fail' && value !== undefined && value !== null) body.append(key, value);
      });
      (form.lampiran_fail || []).forEach((file) => body.append('lampiran_fail', file));
      const { data } = await api.post('/reports', body, { headers: { 'Content-Type': 'multipart/form-data' } });
      setNlp(data.nlp);
      setSubmitted(data.report);
      setForm({ syif: 'Pagi', tarikh_laporan: new Date().toISOString().slice(0, 10), masa_laporan: '08:00', checklist: [] });
      clearEvidenceFiles();
      setFileKey((prev) => prev + 1);
      notifySuccess('Laporan berjaya dihantar');
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
            <p className="text-sm">Tekan satu pilihan untuk setiap pemeriksaan. Checklist bermula kosong supaya setiap jawapan dibuat secara sengaja.</p>
            {meta.checklist.map((item) => {
              const current = getChecklistValue(item.id_checklist)?.jawapan || '';
              return (
                <div key={item.id_checklist} className="app-row grid gap-3 rounded-md border p-3">
                  <span className="text-sm font-medium text-primary-token">{item.nama_checklist}</span>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {['Ya', 'Tidak', 'Tidak Berkaitan'].map((answer) => <ChecklistChoice key={answer} active={current === answer} onClick={() => setChecklist(item.id_checklist, 'jawapan', answer)}>{answer}</ChecklistChoice>)}
                  </div>
                  <Input placeholder="Catatan jika perlu" value={getChecklistValue(item.id_checklist)?.catatan || ''} onChange={(e) => setChecklist(item.id_checklist, 'catatan', e.target.value)} />
                </div>
              );
            })}
          </div>
          <div className="gov-upload-panel space-y-3 rounded-2xl p-4">
            <p className="label-caps">Bahagian 4: Lampiran bukti</p>
            <p className="text-sm">Muat naik sehingga {maxEvidenceFiles} gambar/PDF, atau gunakan kamera beberapa kali jika terdapat lebih daripada satu isu.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" variant="ghost" onClick={openCamera}><Camera size={16} /> Guna kamera</Button>
              <Field label="Lampiran bukti"><Input key={fileKey} type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(e) => { addEvidenceFiles(e.target.files || []); setFileKey((prev) => prev + 1); }} /></Field>
            </div>
            {cameraError && <AlertMessage>{cameraError}</AlertMessage>}
            {cameraOpen && (
              <div className="app-row motion-pop space-y-3 rounded-md border p-3">
                <video ref={videoRef} autoPlay playsInline muted className="aspect-video w-full rounded-md object-cover" />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button type="button" onClick={capturePhoto}><Camera size={16} /> Tangkap gambar</Button>
                  <Button type="button" variant="ghost" onClick={stopCamera}>Tutup kamera</Button>
                </div>
              </div>
            )}
            {previewUrls.length > 0 && (
              <div className="app-row motion-pop rounded-md border p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  {previewUrls.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="rounded-md border bg-white p-2">
                      {file.url ? <img src={file.url} alt={`Pratonton bukti ${index + 1}`} className="max-h-44 w-full rounded-md object-contain" /> : <div className="flex min-h-28 items-center justify-center rounded-md border border-dashed text-sm text-secondary-token">Fail PDF / dokumen</div>}
                      <p className="mt-2 truncate text-sm font-medium text-primary-token">{file.name}</p>
                      <Button type="button" variant="ghost" className="mt-2 w-full" onClick={() => removeEvidenceFile(index)}><RotateCcw size={16} /> Buang lampiran</Button>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="ghost" className="mt-3 w-full sm:w-auto" onClick={() => { clearEvidenceFiles(); setFileKey((prev) => prev + 1); }}><RotateCcw size={16} /> Buang semua lampiran</Button>
              </div>
            )}
            {(form.lampiran_fail || []).length > 0 && <p className="text-data">{form.lampiran_fail.length} lampiran dipilih.</p>}
          </div>
          <div className="space-y-2">
            <p className="label-caps">Bahagian 5: Hantar laporan</p>
            <Button className="w-full sm:w-auto" disabled={submitting}>{submitting ? 'Menghantar...' : 'Hantar laporan'}</Button>
          </div>
        </form>
      </Card>
      <div className="space-y-5">
        {submitted && <AlertMessage type="success">Laporan berjaya dihantar. Status laporan boleh disemak selepas semakan Ketua.</AlertMessage>}
        {nlp && <Card title="Keputusan NLP Rule-Based"><div className="space-y-4 text-sm"><p>Analisis automatik berdasarkan kata kunci laporan.</p><div className={`rounded-2xl border p-4 ${['High', 'Critical'].includes(nlp.tahap_risiko) ? 'app-row-alert' : 'app-row'}`}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="label-caps">Kategori dikesan</p><h3>{nlp.kategori_dikesan}</h3></div><Badge tone={nlp.tahap_risiko}>{nlp.tahap_risiko}</Badge></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div><p className="label-caps">Skor risiko</p><p className="text-kpi">{nlp.skor_risiko}</p></div><div><p className="label-caps">Status laporan</p><p className="font-medium text-primary-token">{submitted?.status_laporan}</p></div></div></div><div><p className="label-caps mb-2">Kata kunci dikesan</p><div className="flex flex-wrap gap-2">{nlp.kata_kunci_dikesan.length ? nlp.kata_kunci_dikesan.map((keyword) => <Badge key={keyword}>{keyword}</Badge>) : <Badge>Tiada kata kunci khusus</Badge>}</div></div><p><span className="font-medium text-primary-token">Ringkasan:</span> {nlp.ringkasan_automatik}</p></div></Card>}
        <Card title="Laporan Saya">{reports.length ? reports.map((report) => <div key={report.id_laporan} className="app-row mb-2 rounded-md border p-3 text-sm"><div className="flex justify-between gap-2"><span className="font-medium text-primary-token">{report.tajuk_laporan}</span><Badge tone={report.tahap_risiko}>{report.tahap_risiko}</Badge></div><div className="mt-2 flex flex-wrap gap-2"><Badge tone={statusTone(report.status_laporan)}>{report.status_laporan}</Badge><span>{report.nama_pos}</span></div>{report.status_laporan === 'Ditolak' && <AlertMessage>Laporan ditolak. Semak catatan Ketua dan hantar laporan baharu jika pembetulan diperlukan.</AlertMessage>}{report.status_laporan === 'Diluluskan' && <AlertMessage type="success">Laporan telah diluluskan.</AlertMessage>}<AttachmentLinks value={report.lampiran_fail} label="Lampiran" /></div>) : <EmptyState title="Tiada laporan" description="Laporan yang anda hantar akan dipaparkan di sini." />}</Card>
      </div>
    </div>
  );
}

function ReportDetailContent({ detail }) {
  if (!detail) return null;
  return (
    <div className="report-document space-y-5 text-sm">
      <div className="border-b pb-4">
        <p className="label-caps">Dokumen Laporan Harian</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[var(--color-brand-navy)]">{detail.report.tajuk_laporan}</h2>
            <p className="text-data">No. Laporan: {detail.report.id_laporan}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={statusTone(detail.report.status_laporan)}>{detail.report.status_laporan}</Badge>
            <Badge tone={detail.report.tahap_risiko}>{detail.report.tahap_risiko}</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="document-field"><span>Pengawal</span><strong>{detail.report.nama_penuh || '-'}</strong></div>
        <div className="document-field"><span>Pos Kawalan</span><strong>{detail.report.nama_pos || '-'}</strong></div>
        <div className="document-field"><span>Syif</span><strong>{detail.report.syif || '-'}</strong></div>
        <div className="document-field"><span>Tarikh / Masa</span><strong>{detail.report.tarikh_laporan?.slice(0, 10) || '-'} {detail.report.masa_laporan || ''}</strong></div>
      </div>

      <section>
        <p className="document-section-title">Kandungan Laporan</p>
        <div className="document-box whitespace-pre-wrap">{detail.report.kandungan_laporan}</div>
        <AttachmentLinks value={detail.report.lampiran_fail} label="Buka lampiran bukti" />
      </section>

      <EvidencePreview value={detail.report.lampiran_fail} />

      <ReportLifecycle report={detail.report} actions={detail.actions} />

      {detail.report.kategori_dikesan && (
        <section>
          <p className="document-section-title">Analisis NLP</p>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="document-field"><span>Kategori</span><strong>{detail.report.kategori_dikesan || '-'}</strong></div>
            <div className="document-field"><span>Skor Risiko</span><strong>{detail.report.skor_risiko ?? '-'}</strong></div>
            <div className="document-field"><span>Tahap Risiko</span><Badge tone={detail.report.tahap_risiko}>{detail.report.tahap_risiko}</Badge></div>
            <div className="document-field"><span>Keyakinan</span><strong>{Number(detail.report.tahap_keyakinan || 0).toFixed(2)}</strong></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">{(detail.report.kata_kunci_dikesan || []).length ? detail.report.kata_kunci_dikesan.map((keyword) => <Badge key={keyword}>{keyword}</Badge>) : <Badge>Tiada kata kunci</Badge>}</div>
        </section>
      )}

      <section>
        <p className="document-section-title">Checklist Pemeriksaan</p>
        {detail.checklist.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr><th className="py-2">Item</th><th>Jawapan</th><th>Catatan</th></tr></thead>
              <tbody>{detail.checklist.map((item) => <tr key={item.id_jawapan} className="app-divider border-b"><td className="py-2">{item.nama_checklist}</td><td>{item.jawapan}</td><td>{item.catatan || '-'}</td></tr>)}</tbody>
            </table>
          </div>
        ) : <p>Tiada checklist direkodkan.</p>}
      </section>

      <section>
        <p className="document-section-title">Sejarah Semakan</p>
        {detail.reviews.length ? detail.reviews.map((item) => <div key={item.id_pengesahan} className="document-box mb-2"><strong>{item.status_pengesahan}</strong><p>{item.catatan_pengesahan || '-'}</p><p className="text-data">{item.nama_penuh} - {new Date(item.tarikh_pengesahan).toLocaleString()}</p></div>) : <p>Belum disemak.</p>}
      </section>

      <section>
        <p className="document-section-title">Tindakan Susulan</p>
        {detail.actions.length ? detail.actions.map((item) => <div key={item.id_tindakan} className="document-box mb-2"><div className="flex flex-wrap gap-2"><Badge tone={item.tahap_keutamaan}>{item.tahap_keutamaan}</Badge><Badge tone={statusTone(item.status_tindakan)}>{item.status_tindakan}</Badge></div><p className="mt-2">{item.tindakan_diambil}</p><p className="text-data">{item.pegawai_bertanggungjawab}</p></div>) : <p>Tiada tindakan susulan.</p>}
      </section>
    </div>
  );
}

function ReviewReports({ auth }) {
  const canReviewReports = auth.user?.nama_peranan === ROLE.chief;
  const [reports, setReports] = useState([]);
  const [comments, setComments] = useState({});
  const [followUpFlags, setFollowUpFlags] = useState({});
  const [pinnedReports, setPinnedReports] = useState([]);
  const [detail, setDetail] = useState(null);
  const [confirmReview, setConfirmReview] = useState(null);
  const [reviewFilters, setReviewFilters] = useState({ status: 'Dihantar', search: '', post: '', shift: '', risk: '', date: '' });
  const navigate = useNavigate();
  const load = useCallback(() => api.get('/reports').then((res) => setReports(res.data)), []);
  useEffect(() => { load(); }, [load]);
  const postOptions = [...new Set(reports.map((report) => report.nama_pos).filter(Boolean))].sort();
  const visibleReports = reports.filter((report) => {
    const search = reviewFilters.search.trim().toLowerCase();
    const matchesSearch = !search || [report.tajuk_laporan, report.nama_penuh, report.nama_pos, report.kandungan_laporan].some((value) => String(value || '').toLowerCase().includes(search));
    const matchesStatus = reviewFilters.status === 'Semua' || report.status_laporan === reviewFilters.status;
    const matchesPost = !reviewFilters.post || report.nama_pos === reviewFilters.post;
    const matchesShift = !reviewFilters.shift || report.syif === reviewFilters.shift;
    const matchesRisk = !reviewFilters.risk || report.tahap_risiko === reviewFilters.risk;
    const matchesDate = !reviewFilters.date || report.tarikh_laporan?.slice(0, 10) === reviewFilters.date;
    return matchesSearch && matchesStatus && matchesPost && matchesShift && matchesRisk && matchesDate;
  }).sort((a, b) => Number(pinnedReports.includes(b.id_laporan)) - Number(pinnedReports.includes(a.id_laporan)));
  const loadDetail = async (id) => {
    try {
      const { data } = await api.get(`/reports/${id}`);
      setDetail(data);
      notifyAction('Detail laporan dibuka');
    } catch (error) {
      notifyError(error, 'Detail laporan gagal dibuka');
    }
  };
  const review = async (id, status) => {
    if (status === 'approved' && typeof followUpFlags[id] !== 'boolean') {
      notifyError({ message: 'Sila tentukan sama ada laporan ini memerlukan tindakan susulan atau tidak.' });
      return;
    }
    try {
      await api.patch(`/reports/${id}/review`, { status, comment: comments[id] || '', requiresFollowUp: Boolean(followUpFlags[id]) });
      setComments((prev) => ({ ...prev, [id]: '' }));
      setFollowUpFlags((prev) => ({ ...prev, [id]: false }));
      setConfirmReview(null);
      notifySuccess(status === 'approved' ? 'Laporan diluluskan' : 'Laporan ditolak');
      await load();
      if (detail?.report?.id_laporan === id) loadDetail(id);
    } catch (error) {
      notifyError(error, 'Semakan laporan gagal');
    }
  };
  return (
    <div className="desktop-ops">
      <Card title={canReviewReports ? 'Semakan Laporan' : 'Pemantauan Laporan'} action={<Button variant="ghost" onClick={() => downloadCsv('/reports/export.csv', 'laporan-harian.csv')}><Download size={16} /> CSV</Button>}>
        {!canReviewReports && <AlertMessage type="success">Admin boleh membaca dan memantau laporan, tetapi kelulusan atau penolakan laporan hanya dibuat oleh Ketua Pengawal.</AlertMessage>}
        <div className="mb-4 grid gap-2 sm:grid-cols-4 xl:max-w-3xl">
          {['Dihantar', 'Diluluskan', 'Ditolak', 'Semua'].map((status) => <Button key={status} variant={reviewFilters.status === status ? 'primary' : 'ghost'} onClick={() => setReviewFilters({ ...reviewFilters, status })}>{status}</Button>)}
        </div>
        <div className="mb-4 grid gap-2 md:grid-cols-3 xl:grid-cols-[minmax(260px,1fr)_220px_140px_150px_160px]">
          <Input placeholder="Cari tajuk, pengawal, pos" value={reviewFilters.search} onChange={(e) => setReviewFilters({ ...reviewFilters, search: e.target.value })} className="xl:col-span-1" />
          <Select value={reviewFilters.post} onChange={(e) => setReviewFilters({ ...reviewFilters, post: e.target.value })}><option value="">Semua pos</option>{postOptions.map((post) => <option key={post}>{post}</option>)}</Select>
          <Select value={reviewFilters.shift} onChange={(e) => setReviewFilters({ ...reviewFilters, shift: e.target.value })}><option value="">Semua syif</option><option>Pagi</option><option>Petang</option><option>Malam</option></Select>
          <Select value={reviewFilters.risk} onChange={(e) => setReviewFilters({ ...reviewFilters, risk: e.target.value })}><option value="">Semua risiko</option><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></Select>
          <Input type="date" value={reviewFilters.date} onChange={(e) => setReviewFilters({ ...reviewFilters, date: e.target.value })} />
        </div>
        <p className="mb-3 text-sm text-secondary-token">{visibleReports.length} daripada {reports.length} laporan dipaparkan.</p>
        {visibleReports.length ? visibleReports.map((r) => (
          <article key={r.id_laporan} className={`desktop-record mb-3 rounded-md border p-4 ${['High', 'Critical'].includes(r.tahap_risiko) ? 'app-row-alert' : 'app-row'}`}>
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <h3>{r.tajuk_laporan}</h3>
                <p className="text-data">{r.nama_penuh} - {r.nama_pos} - {r.tarikh_laporan?.slice(0, 10)} {r.masa_laporan}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {pinnedReports.includes(r.id_laporan) && <Badge>Dipin</Badge>}
                <Badge tone={statusTone(r.status_laporan)}>{r.status_laporan}</Badge>
                <Badge tone={r.tahap_risiko}>{r.tahap_risiko}</Badge>
              </div>
            </div>
            <p className="desktop-clamp mt-2 text-sm">{r.kandungan_laporan}</p>
            <p className="mt-2 text-sm"><span className="font-medium text-primary-token">Risiko ringkas:</span> <Badge tone={r.tahap_risiko}>{r.tahap_risiko}</Badge></p>
            {r.status_laporan === 'Diluluskan' && r.perlu_tindakan_susulan && !r.ada_tindakan_susulan && <AlertMessage>Laporan ini sudah diluluskan dan ditanda memerlukan tindakan susulan.</AlertMessage>}
            <AttachmentLinks value={r.lampiran_fail} label="Lampiran bukti" />
            <div className="mt-3 grid gap-2 sm:grid-cols-[auto_auto_1fr_auto_auto]">
              <Button variant="ghost" onClick={() => setPinnedReports((current) => current.includes(r.id_laporan) ? current.filter((id) => id !== r.id_laporan) : [...current, r.id_laporan])}>{pinnedReports.includes(r.id_laporan) ? 'Nyahpin' : 'Pin'}</Button>
              <Button variant="ghost" onClick={() => loadDetail(r.id_laporan)}><Eye size={16} /> Detail</Button>
              {canReviewReports && <Input placeholder="Catatan semakan" value={comments[r.id_laporan] || ''} onChange={(e) => setComments({ ...comments, [r.id_laporan]: e.target.value })} />}
              {canReviewReports && r.status_laporan === 'Dihantar' && <Button onClick={() => {
                if (typeof followUpFlags[r.id_laporan] !== 'boolean') return notifyError({ message: 'Sila tentukan sama ada laporan ini memerlukan tindakan susulan atau tidak.' });
                return setConfirmReview({ id: r.id_laporan, status: 'approved', title: r.tajuk_laporan });
              }}>Lulus</Button>}
              {canReviewReports && r.status_laporan === 'Dihantar' && <Button variant="danger" onClick={() => setConfirmReview({ id: r.id_laporan, status: 'rejected', title: r.tajuk_laporan })}>Tolak</Button>}
              {r.status_laporan === 'Diluluskan' && r.perlu_tindakan_susulan && <Button onClick={() => navigate('/tindakan')}>Tindakan</Button>}
            </div>
            {canReviewReports && r.status_laporan === 'Dihantar' && (
              <div className="mt-3 rounded-lg border bg-white p-3 text-sm">
                <p className="font-medium text-primary-token">Keputusan Ketua untuk tindakan susulan</p>
                <p className="mt-1 text-secondary-token">Pilih satu sebelum meluluskan laporan. Jika perlu tindakan susulan, laporan akan dihantar ke Admin.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Button type="button" variant={followUpFlags[r.id_laporan] === false ? 'primary' : 'ghost'} onClick={() => setFollowUpFlags({ ...followUpFlags, [r.id_laporan]: false })}>Tidak perlu tindakan susulan</Button>
                  <Button type="button" variant={followUpFlags[r.id_laporan] === true ? 'primary' : 'ghost'} onClick={() => setFollowUpFlags({ ...followUpFlags, [r.id_laporan]: true })}>Perlu tindakan susulan</Button>
                </div>
              </div>
            )}
          </article>
        )) : <EmptyState title="Tiada laporan" description="Tiada laporan untuk status yang dipilih." />}
      </Card>
      {detail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(0,0,0,0.55)] p-0 sm:items-center sm:p-4">
          <div className="app-elevated motion-sheet max-h-[94vh] w-full overflow-y-auto rounded-t-lg border p-4 shadow-xl sm:max-w-5xl sm:rounded-lg lg:p-6">
            <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-4 flex items-start justify-between gap-3 border-b bg-white px-4 py-4 lg:-mx-6 lg:-mt-6 lg:px-6">
              <div>
                <h2>Dokumen Laporan #{detail.report.id_laporan}</h2>
                <p className="text-sm">Paparan lengkap laporan harian untuk semakan Ketua dan pemantauan Admin.</p>
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

function FollowUp({ auth }) {
  const canManageFollowUp = auth.user?.nama_peranan === ROLE.admin;
  const [reports, setReports] = useState([]);
  const [actions, setActions] = useState([]);
  const [form, setForm] = useState({ status_tindakan: 'Baru', tahap_keutamaan: 'High' });
  const [filters, setFilters] = useState({ status: '', priority: '', search: '' });
  const [reportSearch, setReportSearch] = useState('');
  const [notes, setNotes] = useState({});
  const [progressNotes, setProgressNotes] = useState({});
  const [requestNotes, setRequestNotes] = useState({});
  const [progressFiles, setProgressFiles] = useState({});
  const [requestFiles, setRequestFiles] = useState({});
  const [reportDetail, setReportDetail] = useState(null);
  const load = useCallback(() => Promise.all([api.get('/reports'), api.get('/actions')]).then(([r, a]) => { setReports(r.data.filter((x) => ['High', 'Critical'].includes(x.tahap_risiko))); setActions(a.data); }), []);
  useEffect(() => { load(); }, [load]);
  const loadReportDetail = async (id) => {
    try {
      const { data } = await api.get(`/reports/${id}`);
      setReportDetail(data);
      notifyAction('Laporan asal dibuka');
    } catch (error) {
      notifyError(error, 'Laporan asal gagal dibuka');
    }
  };
  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post('/actions', { ...form, id_laporan: Number(form.id_laporan) });
      setForm({ status_tindakan: 'Baru', tahap_keutamaan: 'High' });
      notifySuccess('Tindakan susulan disimpan');
      load();
    } catch (error) {
      notifyError(error, 'Tindakan gagal disimpan');
    }
  };
  const update = async (id, status_tindakan) => {
    try {
      await api.patch(`/actions/${id}`, { status_tindakan, catatan_tindakan: notes[id] || undefined });
      setNotes((prev) => ({ ...prev, [id]: '' }));
      notifySuccess(`Status tindakan: ${status_tindakan}`);
      load();
    } catch (error) {
      notifyError(error, 'Status tindakan gagal dikemas kini');
    }
  };
  const submitProgress = async (id) => {
    try {
      const body = new FormData();
      body.append('catatan_progress', progressNotes[id] || '');
      Array.from(progressFiles[id] || []).forEach((file) => body.append('lampiran_fail', file));
      await api.post(`/actions/${id}/progress`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
      setProgressNotes((prev) => ({ ...prev, [id]: '' }));
      setProgressFiles((prev) => ({ ...prev, [id]: [] }));
      notifySuccess('Progress dihantar kepada Admin untuk semakan');
      load();
    } catch (error) {
      notifyError(error, 'Progress gagal dihantar');
    }
  };
  const requestChiefUpdate = async (id) => {
    try {
      const body = new FormData();
      body.append('catatan_progress', requestNotes[id] || '');
      Array.from(requestFiles[id] || []).forEach((file) => body.append('lampiran_fail', file));
      await api.post(`/actions/${id}/request-update`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
      setRequestNotes((prev) => ({ ...prev, [id]: '' }));
      setRequestFiles((prev) => ({ ...prev, [id]: [] }));
      notifySuccess('Permintaan kemaskini dihantar kepada Ketua');
      load();
    } catch (error) {
      notifyError(error, 'Permintaan kemaskini gagal dihantar');
    }
  };

  const reportsNeedingAction = reports.filter((report) => report.status_laporan === 'Diluluskan' && report.perlu_tindakan_susulan && !report.ada_tindakan_susulan);
  const filteredReportsForAction = reportsNeedingAction.filter((report) => {
    const search = reportSearch.trim().toLowerCase();
    if (!search) return true;
    return [report.tajuk_laporan, report.nama_penuh, report.nama_pos, report.tahap_risiko, report.tarikh_laporan]
      .some((value) => String(value || '').toLowerCase().includes(search));
  });
  const filteredActions = actions.filter((action) => {
    const search = filters.search.toLowerCase();
    const matchesSearch = !search || [action.tajuk_laporan, action.pegawai_bertanggungjawab, action.nama_pos, action.nama_penuh, action.tindakan_diambil].some((value) => String(value || '').toLowerCase().includes(search));
    const matchesStatus = !filters.status || action.status_tindakan === filters.status;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="desktop-ops space-y-5">
      <PageHeader
        title="Tindakan Susulan"
        description={canManageFollowUp ? 'Admin mengurus, mengemas kini dan menutup tindakan untuk insiden berisiko.' : 'Ketua boleh memantau tindakan susulan selepas laporan diluluskan.'}
      />
      {canManageFollowUp ? (
        <AlertMessage type="success">Aliran tindakan: pilih laporan yang telah diluluskan, cipta tindakan susulan, semak progress Ketua, kemudian ubah status rasmi bila tindakan benar-benar bergerak atau selesai.</AlertMessage>
      ) : (
        <AlertMessage type="success">Ketua hanya menghantar progress/catatan kepada Admin. Status rasmi tindakan kekal dikawal oleh Pentadbir Sistem.</AlertMessage>
      )}
      {reportsNeedingAction.length > 0 && (
        <AlertMessage>{reportsNeedingAction.length} laporan High/Critical telah diluluskan tetapi belum ada tindakan susulan. Admin perlu cipta dan kemas kini tindakan.</AlertMessage>
      )}
      <div className={`grid gap-5 ${canManageFollowUp ? 'xl:grid-cols-[420px_minmax(0,1fr)] 2xl:grid-cols-[460px_minmax(0,1fr)]' : ''}`}>
        {canManageFollowUp && <Card title="Tambah Tindakan" className="desktop-sticky-panel">
          <form onSubmit={create} className="space-y-3">
            <Field label="Cari laporan">
              <Input placeholder="Cari tajuk, pengawal, pos atau risiko" value={reportSearch} onChange={(e) => setReportSearch(e.target.value)} />
            </Field>
            <Field label="Laporan">
              <Select required value={form.id_laporan || ''} onChange={(e) => setForm({ ...form, id_laporan: e.target.value })}>
                <option value="">Pilih laporan diluluskan</option>
                {filteredReportsForAction.map((r) => <option key={r.id_laporan} value={r.id_laporan}>{r.tajuk_laporan} - {r.nama_pos} - {r.tahap_risiko}</option>)}
              </Select>
            </Field>
            {!filteredReportsForAction.length && <AlertMessage type="success">Tiada laporan diluluskan yang sepadan dan memerlukan tindakan susulan.</AlertMessage>}
            <Field label="Pegawai bertanggungjawab"><Input required value={form.pegawai_bertanggungjawab || ''} onChange={(e) => setForm({ ...form, pegawai_bertanggungjawab: e.target.value })} /></Field>
            <Field label="Tindakan diambil"><Textarea required rows={4} value={form.tindakan_diambil || ''} onChange={(e) => setForm({ ...form, tindakan_diambil: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Keutamaan"><Select value={form.tahap_keutamaan} onChange={(e) => setForm({ ...form, tahap_keutamaan: e.target.value })}><option>Medium</option><option>High</option><option>Critical</option></Select></Field>
              <Field label="Tarikh mula"><Input type="date" value={form.tarikh_mula || ''} onChange={(e) => setForm({ ...form, tarikh_mula: e.target.value })} /></Field>
            </div>
            <Field label="Catatan awal"><Textarea rows={3} value={form.catatan_tindakan || ''} onChange={(e) => setForm({ ...form, catatan_tindakan: e.target.value })} /></Field>
            <Button className="w-full sm:w-auto">Simpan tindakan</Button>
          </form>
        </Card>}
        <div className="space-y-5">
          <FilterPanel>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_220px]">
              <Input placeholder="Cari laporan, pegawai, pos" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
              <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">Semua status</option><option>Baru</option><option>Dalam Tindakan</option><option>Selesai</option></Select>
            </div>
          </FilterPanel>
          <Card title="Senarai Tindakan">
            <p className="mb-3 text-sm text-secondary-token">{filteredActions.length} daripada {actions.length} tindakan dipaparkan.</p>
            {filteredActions.length ? filteredActions.map((a) => (
              <div key={a.id_tindakan} className={`desktop-record mb-3 rounded-md border p-4 text-sm ${a.tahap_keutamaan === 'Critical' && a.status_tindakan !== 'Selesai' ? 'app-row-alert' : 'app-row'}`}>
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <span className="font-medium text-primary-token">{a.tajuk_laporan}</span>
                    <p className="text-data">{a.nama_penuh || '-'} - {a.nama_pos || '-'} - {a.tarikh_laporan?.slice(0, 10)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={a.tahap_keutamaan}>{a.tahap_keutamaan}</Badge>
                    <Badge tone={statusTone(a.status_tindakan)}>{a.status_tindakan}</Badge>
                  </div>
                </div>
                <p className="mt-2">{a.tindakan_diambil}</p>
                <p className="mt-1">Pegawai: {a.pegawai_bertanggungjawab}</p>
                <Button className="mt-3 w-full justify-center sm:w-auto" variant="ghost" onClick={() => loadReportDetail(a.id_laporan)}><Eye size={16} /> Lihat laporan asal</Button>
                {a.catatan_tindakan && <p className="mt-1">Catatan: {a.catatan_tindakan}</p>}
                {a.progress_notes?.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="label-caps">Komunikasi Admin dan Ketua</p>
                    {a.progress_notes.map((progress) => (
                      <div key={progress.id_progress} className={`rounded-lg border bg-white p-3 ${progress.perlu_respon_ketua ? 'border-amber-300' : ''}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Badge tone={progress.jenis_progress === 'Permintaan Admin' ? 'High' : 'Low'}>{progress.jenis_progress || 'Kemaskini'}</Badge>
                          {progress.perlu_respon_ketua && <Badge tone="Medium">Perlu respon Ketua</Badge>}
                        </div>
                        <p className="mt-2">{progress.catatan_progress}</p>
                        <AttachmentLinks value={progress.lampiran_fail} label="Bukti" />
                        <p className="text-data">{progress.nama_penuh} - {progress.nama_peranan} - {new Date(progress.tarikh_progress).toLocaleString()} - {progress.dilihat_admin ? 'Dilihat Admin' : 'Belum dilihat Admin'}</p>
                      </div>
                    ))}
                  </div>
                )}
                {canManageFollowUp ? <div className="mt-3 grid gap-2">
                  <Textarea rows={2} placeholder="Catatan kemas kini" value={notes[a.id_tindakan] || ''} onChange={(e) => setNotes({ ...notes, [a.id_tindakan]: e.target.value })} />
                  <div className="rounded-lg border bg-white p-3">
                    <p className="font-medium text-primary-token">Minta kemaskini daripada Ketua</p>
                    <p className="mb-2 text-sm text-secondary-token">Gunakan ini jika Admin perlukan maklumat lapangan, gambar tambahan, atau pengesahan keadaan semasa.</p>
                    <Textarea rows={2} placeholder="Contoh: Sila kemaskini keadaan pintu dan lampirkan gambar terkini." value={requestNotes[a.id_tindakan] || ''} onChange={(e) => setRequestNotes({ ...requestNotes, [a.id_tindakan]: e.target.value })} />
                    <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                      <Input type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(e) => setRequestFiles({ ...requestFiles, [a.id_tindakan]: Array.from(e.target.files || []) })} />
                      <Button type="button" variant="ghost" onClick={() => requestChiefUpdate(a.id_tindakan)}>Minta kemaskini</Button>
                    </div>
                    {(requestFiles[a.id_tindakan] || []).length > 0 && <p className="text-data">{requestFiles[a.id_tindakan].length} lampiran dipilih.</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" onClick={() => update(a.id_tindakan, 'Baru')}>Baru</Button>
                    <Button variant="ghost" onClick={() => update(a.id_tindakan, 'Dalam Tindakan')}>Dalam Tindakan</Button>
                    <Button onClick={() => update(a.id_tindakan, 'Selesai')}>Selesai</Button>
                  </div>
                </div> : <div className="mt-3 grid gap-2"><AlertMessage type="success">Status rasmi hanya boleh dikemaskini oleh Pentadbir Sistem. Jika Admin meminta kemaskini, balas di sini bersama bukti jika perlu.</AlertMessage><Textarea rows={2} placeholder="Catatan / progress untuk Admin" value={progressNotes[a.id_tindakan] || ''} onChange={(e) => setProgressNotes({ ...progressNotes, [a.id_tindakan]: e.target.value })} /><Input type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(e) => setProgressFiles({ ...progressFiles, [a.id_tindakan]: Array.from(e.target.files || []) })} />{(progressFiles[a.id_tindakan] || []).length > 0 && <p className="text-data">{progressFiles[a.id_tindakan].length} lampiran bukti dipilih.</p>}<Button onClick={() => submitProgress(a.id_tindakan)}>Hantar progress kepada Admin</Button></div>}
              </div>
            )) : <EmptyState title="Tiada tindakan" description="Tiada tindakan susulan sepadan dengan tapisan semasa." />}
          </Card>
        </div>
      </div>
      {reportDetail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(0,0,0,0.55)] p-0 sm:items-center sm:p-4">
          <div className="app-elevated motion-sheet max-h-[94vh] w-full overflow-y-auto rounded-t-lg border p-4 shadow-xl sm:max-w-5xl sm:rounded-lg lg:p-6">
            <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-4 flex items-start justify-between gap-3 border-b bg-white px-4 py-4 lg:-mx-6 lg:-mt-6 lg:px-6">
              <div>
                <h2>Laporan Asal #{reportDetail.report.id_laporan}</h2>
                <p className="text-sm">Rujukan penuh laporan yang menjadi asas tindakan susulan.</p>
              </div>
              <Button variant="ghost" onClick={() => setReportDetail(null)}><X size={16} /> Tutup</Button>
            </div>
            <ReportDetailContent detail={reportDetail} />
          </div>
        </div>
      )}
    </div>
  );
}

function SchedulePage({ auth }) {
  const canManage = [ROLE.admin, ROLE.chief].includes(auth.user?.nama_peranan);
  const isAdmin = auth.user?.nama_peranan === ROLE.admin;
  const today = new Date().toISOString().slice(0, 10);
  const [meta, setMeta] = useState({ posts: [], guards: [] });
  const [selectedWeekId, setSelectedWeekId] = useState('');
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [coverage, setCoverage] = useState(null);
  const [requirements, setRequirements] = useState([]);
  const [mySchedule, setMySchedule] = useState([]);
  const [requirementForm, setRequirementForm] = useState({ id_pos: '', syif: 'Pagi', bilangan_diperlukan: 1, status_aktif: true });
  const [quickDate, setQuickDate] = useState(today);
  const [assignmentFilters, setAssignmentFilters] = useState({ post: '', shift: '', status: 'need' });
  const [assignmentForm, setAssignmentForm] = useState(null);
  const [conflict, setConflict] = useState(null);
  const [importFile, setImportFile] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadMeta = useCallback(() => api.get('/meta').then((res) => setMeta(res.data)), []);
  const loadWeeks = useCallback(() => api.get('/jadual/mingguan').then((res) => {
    setSelectedWeekId((current) => current || String(res.data[0]?.id_jadual_mingguan || ''));
  }), []);
  const loadWeekData = useCallback(async () => {
    if (!selectedWeekId) return;
    const [week, summary] = await Promise.all([
      api.get(`/jadual/mingguan/${selectedWeekId}`),
      api.get(`/jadual/mingguan/${selectedWeekId}/coverage-summary`),
    ]);
    setSelectedWeek(week.data);
    setCoverage(summary.data);
  }, [selectedWeekId]);
  const loadMySchedule = useCallback(() => api.get('/jadual/my-schedule').then((res) => setMySchedule(res.data)), []);
  const loadRequirements = useCallback(() => api.get('/jadual/keperluan-pos').then((res) => setRequirements(res.data)), []);

  useEffect(() => { loadMeta(); }, [loadMeta]);
  useEffect(() => { if (canManage) loadRequirements(); }, [canManage, loadRequirements]);
  useEffect(() => { canManage ? loadWeeks() : loadMySchedule(); }, [canManage, loadWeeks, loadMySchedule]);
  useEffect(() => {
    if (!canManage || !selectedWeekId) return;
    Promise.all([
      api.get(`/jadual/mingguan/${selectedWeekId}`),
      api.get(`/jadual/mingguan/${selectedWeekId}/coverage-summary`),
    ]).then(([week, summary]) => {
      setSelectedWeek(week.data);
      setCoverage(summary.data);
    });
  }, [canManage, selectedWeekId]);
  const assignmentRows = useMemo(() => {
    const rows = coverage?.coverageByPost || [];
    return rows.filter((row) => {
      const shortage = Math.max(0, Number(row.required) - Number(row.assigned));
      const matchesPost = !assignmentFilters.post || String(row.id_pos) === String(assignmentFilters.post);
      const matchesShift = !assignmentFilters.shift || row.syif === assignmentFilters.shift;
      const matchesStatus = assignmentFilters.status === 'all' || (assignmentFilters.status === 'need' ? shortage > 0 : shortage === 0);
      return matchesPost && matchesShift && matchesStatus;
    });
  }, [assignmentFilters, coverage]);

  const openAssignment = (assignment = null) => {
    const baseDate = selectedWeek?.tarikh_mula?.slice(0, 10) || today;
    setConflict(null);
    setAssignmentForm(assignment ? {
      id_jadual: assignment.id_jadual,
      tarikh_tugas: assignment.tarikh_tugas?.slice(0, 10),
      syif: assignment.syif,
      masa_mula: assignment.masa_mula?.slice(0, 5),
      masa_tamat: assignment.masa_tamat?.slice(0, 5),
      id_pos: assignment.id_pos,
      id_pengguna: assignment.id_pengguna,
      catatan: assignment.catatan || '',
    } : {
      tarikh_tugas: baseDate,
      syif: 'Pagi',
      masa_mula: '07:00',
      masa_tamat: '16:00',
      id_pos: '',
      id_pengguna: '',
      catatan: '',
    });
  };

  const openAssignmentForRequirement = (requirement) => {
    const times = shiftTimes[requirement.syif] || shiftTimes.Pagi;
    setConflict(null);
    setAssignmentForm({
      tarikh_tugas: quickDate || selectedWeek?.tarikh_mula?.slice(0, 10) || today,
      syif: requirement.syif,
      masa_mula: times.start,
      masa_tamat: times.end,
      id_pos: requirement.id_pos,
      id_pengguna: '',
      catatan: '',
    });
  };

  const checkConflict = async (form = assignmentForm) => {
    if (!form?.id_pengguna || !form?.id_pos || !selectedWeekId) return null;
    const { data } = await api.post('/jadual/check-conflict', { ...form, id_jadual_mingguan: Number(selectedWeekId) });
    setConflict(data);
    return data;
  };

  const saveAssignment = async (event) => {
    event.preventDefault();
    const result = await checkConflict();
    if (result && !result.ok) return notifyError({ message: result.critical.join('. ') }, 'Konflik jadual dikesan');
    setSaving(true);
    try {
      if (assignmentForm.id_jadual) await api.put(`/jadual/assignments/${assignmentForm.id_jadual}`, assignmentForm);
      else await api.post(`/jadual/mingguan/${selectedWeekId}/assignments`, assignmentForm);
      notifySuccess('Tugasan jadual disimpan');
      setAssignmentForm(null);
      await loadWeekData();
    } catch (error) {
      notifyError(error, 'Tugasan jadual gagal disimpan');
    } finally {
      setSaving(false);
    }
  };

  const deleteAssignment = async (id) => {
    try {
      await api.delete(`/jadual/assignments/${id}`);
      notifySuccess('Tugasan jadual dipadam');
      await loadWeekData();
    } catch (error) {
      notifyError(error, 'Tugasan jadual gagal dipadam');
    }
  };

  const saveRequirement = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post('/jadual/keperluan-pos', {
        ...requirementForm,
        id_pos: Number(requirementForm.id_pos),
        bilangan_diperlukan: Number(requirementForm.bilangan_diperlukan),
      });
      notifySuccess('Keperluan pos dikemas kini');
      setRequirementForm({ id_pos: '', syif: 'Pagi', bilangan_diperlukan: 1, status_aktif: true });
      await loadRequirements();
      if (selectedWeekId) await loadWeekData();
    } catch (error) {
      notifyError(error, 'Keperluan pos gagal dikemas kini');
    } finally {
      setSaving(false);
    }
  };

  const updateWeekStatus = async (action) => {
    try {
      await api.post(`/jadual/mingguan/${selectedWeekId}/${action}`);
      notifySuccess(action === 'confirm' ? 'Jadual disahkan' : action === 'lock' ? 'Jadual dikunci' : 'Jadual dibuka kunci');
      await loadWeeks();
      await loadWeekData();
    } catch (error) {
      notifyError(error, 'Status jadual gagal dikemas kini');
    }
  };

  const uploadScheduleFile = async (event, type) => {
    event.preventDefault();
    const file = type === 'csv' ? importFile : pdfFile;
    if (!file) return notifyError({ message: 'Pilih fail dahulu' });
    const body = new FormData();
    body.append('jadual_fail', file);
    setSaving(true);
    try {
      const endpoint = type === 'csv' ? 'import-csv' : 'upload-pdf';
      const { data } = await api.post(`/jadual/mingguan/${selectedWeekId}/${endpoint}`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
      notifySuccess(type === 'csv' ? `Import CSV selesai: ${data.imported} tugasan` : 'PDF rujukan dimuat naik');
      setImportFile(null);
      setPdfFile(null);
      event.target.reset();
      await loadWeekData();
    } catch (error) {
      notifyError(error, type === 'csv' ? 'Import CSV gagal' : 'Muat naik PDF gagal');
    } finally {
      setSaving(false);
    }
  };

  const guardCheck = async (id, action) => {
    try {
      await api.post(`/jadual/assignments/${id}/${action}`);
      notifySuccess(action === 'check-in' ? 'Check-in berjaya' : 'Check-out berjaya');
      await loadMySchedule();
    } catch (error) {
      notifyError(error, 'Status kehadiran gagal dikemas kini');
    }
  };

  if (!canManage) {
    return (
      <div className="space-y-5">
        <PageHeader title="Jadual Bertugas Saya" description="Lihat tugasan pos, syif, masa dan status kehadiran anda." />
        <Card title="Tugasan Saya">
          {mySchedule.length ? mySchedule.map((item) => {
            const dutyDate = item.tarikh_tugas?.slice(0, 10);
            const canCheckIn = dutyDate === today && !item.masa_check_in;
            const canCheckOut = dutyDate === today && item.masa_check_in && !item.masa_check_out;
            return (
              <div key={item.id_jadual} className="app-row mb-3 rounded-md border p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-primary-token">{item.nama_pos}</p>
                    <p>{item.nama_bangunan || item.lokasi || '-'}</p>
                    <p className="text-data">{dutyDate} - {item.syif} - {item.masa_mula?.slice(0, 5)} hingga {item.masa_tamat?.slice(0, 5)}</p>
                  </div>
                  <Badge tone={statusTone(item.status_bertugas)}>{item.status_kehadiran || item.status_bertugas}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {canCheckIn && <Button onClick={() => guardCheck(item.id_jadual, 'check-in')}>Check-in</Button>}
                  {canCheckOut && <Button onClick={() => guardCheck(item.id_jadual, 'check-out')}>Check-out</Button>}
                </div>
              </div>
            );
          }) : <EmptyState title="Tiada jadual" description="Jadual anda akan dipaparkan selepas Ketua/Admin membuat tugasan." />}
        </Card>
      </div>
    );
  }

  const lockedForChief = auth.user?.nama_peranan === ROLE.chief && selectedWeek?.status_jadual === 'Dikunci';

  return (
    <div className="desktop-ops space-y-5">
      <PageHeader title="Pengurusan Jadual Bertugas Berasaskan Templat Mingguan" description="Rancang jadual mingguan mengikut tarikh, syif, pos dan pengawal tanpa algoritma automatik." />
      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-5">
          {selectedWeek && <Card title="Status Jadual Semasa">
            <div className="space-y-2 text-sm">
              <Badge tone={statusTone(selectedWeek.status_jadual)}>{selectedWeek.status_jadual}</Badge>
              <p>{selectedWeek.tarikh_mula?.slice(0, 10)} hingga {selectedWeek.tarikh_tamat?.slice(0, 10)}</p>
              {selectedWeek.catatan && <p>{selectedWeek.catatan}</p>}
              <div className="flex flex-wrap gap-2">
                {isAdmin && <Button variant="ghost" onClick={() => updateWeekStatus('confirm')}>Sahkan</Button>}
                {isAdmin && <Button variant="ghost" onClick={() => updateWeekStatus('lock')}>Kunci</Button>}
                {isAdmin && <Button variant="ghost" onClick={() => updateWeekStatus('unlock')}>Buka Kunci</Button>}
              </div>
              {lockedForChief && <AlertMessage>Jadual dikunci. Ketua tidak boleh mengubah tugasan sehingga Admin membuka kunci.</AlertMessage>}
            </div>
          </Card>}

          <Card title="Tetapan Keperluan Pos">
            <form onSubmit={saveRequirement} className="space-y-3">
              <Field label="Pos kawalan"><Select required value={requirementForm.id_pos} onChange={(e) => setRequirementForm({ ...requirementForm, id_pos: e.target.value })}><option value="">Pilih pos</option>{meta.posts.map((post) => <option key={post.id_pos} value={post.id_pos}>{post.nama_pos}</option>)}</Select></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Syif"><Select value={requirementForm.syif} onChange={(e) => setRequirementForm({ ...requirementForm, syif: e.target.value })}><option value="Pagi">Pagi ({shiftTimeLabel('Pagi')})</option><option value="Petang">Petang ({shiftTimeLabel('Petang')})</option><option value="Malam">Malam ({shiftTimeLabel('Malam')})</option><option value="Office Hour">Office Hour ({shiftTimeLabel('Office Hour')})</option></Select></Field>
                <Field label="Bilangan pengawal"><Input type="number" min="0" value={requirementForm.bilangan_diperlukan} onChange={(e) => setRequirementForm({ ...requirementForm, bilangan_diperlukan: e.target.value })} /></Field>
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={requirementForm.status_aktif} onChange={(e) => setRequirementForm({ ...requirementForm, status_aktif: e.target.checked })} /> Aktif untuk liputan</label>
              <Button disabled={saving}>Simpan keperluan</Button>
            </form>
            <p className="mt-3 text-sm">Keperluan ini menentukan berapa orang perlu dijadualkan untuk setiap pos dan syif. Aktif sekarang: {requirements.filter((item) => item.status_aktif).length} tetapan.</p>
          </Card>

          {isAdmin && selectedWeekId && <Card title="Import / Rujukan">
            <form onSubmit={(e) => uploadScheduleFile(e, 'csv')} className="mb-4 space-y-2">
              <Field label="CSV jadual"><Input type="file" accept=".csv,text/csv" onChange={(e) => setImportFile(e.target.files?.[0] || null)} /></Field>
              <Button disabled={saving}><Upload size={16} /> Import CSV</Button>
            </form>
            <form onSubmit={(e) => uploadScheduleFile(e, 'pdf')} className="space-y-2">
              <Field label="PDF rujukan"><Input type="file" accept=".pdf,application/pdf" onChange={(e) => setPdfFile(e.target.files?.[0] || null)} /></Field>
              <Button variant="ghost" disabled={saving}><Upload size={16} /> Muat naik PDF</Button>
            </form>
          </Card>}
        </div>

        <div className="space-y-5">
          {coverage && <Card title="Ringkasan Liputan">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <StatCard label="Keperluan" value={coverage.totalRequired} />
              <StatCard label="Ditugaskan" value={coverage.totalAssigned} />
              <StatCard label="Kekurangan" value={coverage.shortage} />
              <StatCard label="Sedang Hadir" value={coverage.activeDutyCount} />
              <StatCard label="Tidak Hadir" value={coverage.absentGuardCount} />
            </div>
            {coverage.uncoveredPosts?.length > 0 && <AlertMessage>{coverage.uncoveredPosts.length} kombinasi pos/syif belum mempunyai pengawal.</AlertMessage>}
          </Card>}

          {coverage && <Card title="Keperluan Pos & Tugasan Pengawal">
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">Cara guna ringkas</p>
              <p>1. Pilih tarikh tugasan. 2. Semak pos yang bertanda Perlu tambah. 3. Klik Tugaskan pengawal dan pilih nama pengawal.</p>
            </div>
            <div className="mb-4 grid gap-3 rounded-lg border bg-white p-3 md:grid-cols-[180px_1fr_160px_170px]">
              <Field label="Tarikh tugasan"><Input type="date" value={quickDate} onChange={(e) => setQuickDate(e.target.value)} /></Field>
              <Field label="Cari ikut pos"><Select value={assignmentFilters.post} onChange={(e) => setAssignmentFilters({ ...assignmentFilters, post: e.target.value })}><option value="">Semua pos</option>{meta.posts.map((post) => <option key={post.id_pos} value={post.id_pos}>{post.nama_pos}</option>)}</Select></Field>
              <Field label="Syif dan masa"><Select value={assignmentFilters.shift} onChange={(e) => setAssignmentFilters({ ...assignmentFilters, shift: e.target.value })}><option value="">Semua syif</option><option value="Pagi">Pagi ({shiftTimeLabel('Pagi')})</option><option value="Petang">Petang ({shiftTimeLabel('Petang')})</option><option value="Malam">Malam ({shiftTimeLabel('Malam')})</option><option value="Office Hour">Office Hour ({shiftTimeLabel('Office Hour')})</option></Select></Field>
              <Field label="Paparan"><Select value={assignmentFilters.status} onChange={(e) => setAssignmentFilters({ ...assignmentFilters, status: e.target.value })}><option value="need">Perlu tambah</option><option value="complete">Cukup lengkap</option><option value="all">Semua</option></Select></Field>
            </div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <p className="text-secondary-token">{assignmentRows.length} pos/syif dipaparkan. Fokus utama ialah pos yang belum cukup pengawal.</p>
              <Button variant="ghost" onClick={() => setAssignmentFilters({ post: '', shift: '', status: 'need' })}>Reset penapis</Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {assignmentRows.length ? assignmentRows.map((row) => {
                const shortage = Math.max(0, Number(row.required) - Number(row.assigned));
                const isCovered = shortage === 0;
                return (
                  <div key={`${row.id_pos}-${row.syif}`} className={`rounded-lg border p-4 text-sm shadow-sm ${isCovered ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-base font-semibold text-primary-token">{row.nama_pos}</p>
                        <p className="text-secondary-token">Syif {row.syif}</p>
                        <p className="mt-1 inline-flex rounded-md bg-white px-2 py-1 text-xs font-semibold text-primary-token">Masa {shiftTimeLabel(row.syif)}</p>
                      </div>
                      <Badge tone={isCovered ? 'Low' : 'Medium'}>{isCovered ? 'Cukup' : 'Perlu tambah'}</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-md bg-white p-2"><p className="text-lg font-bold text-primary-token">{row.required}</p><p className="text-xs text-secondary-token">Perlu</p></div>
                      <div className="rounded-md bg-white p-2"><p className="text-lg font-bold text-primary-token">{row.assigned}</p><p className="text-xs text-secondary-token">Ada</p></div>
                      <div className="rounded-md bg-white p-2"><p className={`text-lg font-bold ${shortage ? 'text-amber-700' : 'text-green-700'}`}>{shortage}</p><p className="text-xs text-secondary-token">Kurang</p></div>
                    </div>
                    {shortage > 0 && <AlertMessage>Tambah {shortage} pengawal untuk lengkapkan pos ini.</AlertMessage>}
                    {row.assigned_guards?.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        <p className="label-caps">Pengawal ditugaskan</p>
                        {row.assigned_guards.map((guard) => (
                          <div key={guard.id_jadual} className="rounded-md border bg-white p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="font-medium text-primary-token">{guard.nama_penuh}</p>
                                <p className="text-data">{guard.tarikh_tugas?.slice(0, 10)} - {guard.masa_mula?.slice(0, 5)} hingga {guard.masa_tamat?.slice(0, 5)}</p>
                              </div>
                              <Badge tone={statusTone(guard.status_bertugas)}>{guard.status_bertugas}</Badge>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Button variant="ghost" onClick={() => openAssignment({ ...guard, id_pos: row.id_pos, syif: row.syif })} disabled={lockedForChief}>Edit</Button>
                              <Button variant="danger" onClick={() => deleteAssignment(guard.id_jadual)} disabled={lockedForChief}>Padam</Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <p className="mt-3 rounded-md border border-dashed bg-white p-3 text-secondary-token">Belum ada pengawal ditugaskan untuk pos dan syif ini.</p>}
                    <Button className="mt-3 w-full justify-center sm:w-auto" variant={shortage ? 'primary' : 'ghost'} onClick={() => openAssignmentForRequirement(row)} disabled={!selectedWeekId || lockedForChief}>{shortage ? 'Tugaskan pengawal sekarang' : 'Tambah pengawal lain'}</Button>
                  </div>
                );
              }) : <EmptyState title="Tiada pos untuk paparan ini" description="Cuba pilih Semua atau tukar penapis pos/syif." />}
            </div>
          </Card>}
        </div>
      </div>

      {assignmentForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(0,0,0,0.55)] p-0 sm:items-center sm:p-4">
          <div className="app-elevated motion-sheet max-h-[92vh] w-full overflow-y-auto rounded-t-lg border p-4 shadow-xl sm:max-w-2xl sm:rounded-lg">
            <div className="mb-4 flex justify-between gap-3">
              <div><h2>{assignmentForm.id_jadual ? 'Edit Tugasan' : 'Tambah Tugasan'}</h2><p className="text-sm">Semak konflik sebelum simpan tugasan.</p></div>
              <Button variant="ghost" onClick={() => setAssignmentForm(null)}><X size={16} /> Tutup</Button>
            </div>
            <form onSubmit={saveAssignment} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Tarikh"><Input type="date" required value={assignmentForm.tarikh_tugas} onChange={(e) => setAssignmentForm({ ...assignmentForm, tarikh_tugas: e.target.value })} /></Field>
                <Field label="Syif"><Select value={assignmentForm.syif} onChange={(e) => {
                  const times = shiftTimes[e.target.value] || shiftTimes.Pagi;
                  setAssignmentForm({ ...assignmentForm, syif: e.target.value, masa_mula: times.start, masa_tamat: times.end });
                }}><option value="Pagi">Pagi ({shiftTimeLabel('Pagi')})</option><option value="Petang">Petang ({shiftTimeLabel('Petang')})</option><option value="Malam">Malam ({shiftTimeLabel('Malam')})</option><option value="Office Hour">Office Hour ({shiftTimeLabel('Office Hour')})</option></Select></Field>
                <Field label="Masa mula"><Input type="time" required value={assignmentForm.masa_mula} onChange={(e) => setAssignmentForm({ ...assignmentForm, masa_mula: e.target.value })} /></Field>
                <Field label="Masa tamat"><Input type="time" required value={assignmentForm.masa_tamat} onChange={(e) => setAssignmentForm({ ...assignmentForm, masa_tamat: e.target.value })} /></Field>
              </div>
              <Field label="Pos kawalan"><Select required value={assignmentForm.id_pos} onChange={(e) => setAssignmentForm({ ...assignmentForm, id_pos: e.target.value })}><option value="">Pilih pos</option>{meta.posts.map((post) => <option key={post.id_pos} value={post.id_pos}>{post.nama_pos}</option>)}</Select></Field>
              <Field label="Pengawal"><Select required value={assignmentForm.id_pengguna} onChange={(e) => setAssignmentForm({ ...assignmentForm, id_pengguna: e.target.value })}><option value="">Pilih pengawal</option>{meta.guards.map((guard) => <option key={guard.id_pengguna} value={guard.id_pengguna}>{guard.nama_penuh}</option>)}</Select></Field>
              <Field label="Catatan"><Textarea rows={3} value={assignmentForm.catatan} onChange={(e) => setAssignmentForm({ ...assignmentForm, catatan: e.target.value })} /></Field>
              {conflict?.critical?.length > 0 && <AlertMessage>{conflict.critical.join('. ')}</AlertMessage>}
              {conflict?.ok && <AlertMessage type="success">Tiada konflik kritikal dikesan.</AlertMessage>}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="ghost" onClick={() => checkConflict()}>Semak konflik</Button>
                <Button disabled={saving || conflict?.critical?.length}>{saving ? 'Menyimpan...' : 'Simpan tugasan'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function AuditTrail() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ roles: [], posts: [] });
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ user: '', role: '', pos: '', module: '', activity: '', dateMode: 'all', date: '', month: '', year: '', status: '' });
  const auditMonthOptions = useMemo(() => recentMonthOptions(36), []);
  const load = useCallback(() => api.get('/audit', { params: filters }).then((res) => setRows(res.data)), [filters]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    Promise.all([api.get('/meta'), api.get('/users')]).then(([m, u]) => {
      setMeta(m.data);
      setUsers(u.data);
    });
  }, []);
  return (
    <div className="desktop-ops">
      <Card title="Audit Trail" action={<Button variant="ghost" onClick={() => downloadCsv('/audit/export.csv', 'audit-trail.csv')}><Download size={16} /> CSV</Button>}>
        <AlertMessage type="success">Gunakan penapis ini untuk semak aktiviti mengikut pengguna, peranan, pos, modul atau status sebelum membuka log yang panjang.</AlertMessage>
        <div className="mb-4 space-y-3 rounded-xl border bg-white p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="Pengguna"><Select value={filters.user} onChange={(e) => setFilters({ ...filters, user: e.target.value })}><option value="">Semua pengguna</option>{users.map((user) => <option key={user.id_pengguna} value={user.nama_penuh}>{user.nama_penuh}</option>)}</Select></Field>
              <Field label="Peranan"><Select value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value })}><option value="">Semua peranan</option>{meta.roles.map((role) => <option key={role.id_peranan} value={role.nama_peranan}>{role.nama_peranan}</option>)}</Select></Field>
              <Field label="Pos"><Select value={filters.pos} onChange={(e) => setFilters({ ...filters, pos: e.target.value })}><option value="">Semua pos</option>{meta.posts.map((post) => <option key={post.id_pos} value={post.nama_pos}>{post.nama_pos}</option>)}</Select></Field>
            </div>
            <Button type="button" variant="ghost" className="self-end" onClick={() => setFilters({ user: '', role: '', pos: '', module: '', activity: '', dateMode: 'all', date: '', month: '', year: '', status: '' })}>Reset tapisan</Button>
          </div>
          <div className="grid gap-3 border-t pt-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_minmax(260px,1.3fr)_180px]">
            <Field label="Modul"><Input placeholder="Contoh: Laporan Harian" value={filters.module} onChange={(e) => setFilters({ ...filters, module: e.target.value })} /></Field>
            <Field label="Aktiviti / penerangan"><Input placeholder="Cari aktiviti atau penerangan audit" value={filters.activity} onChange={(e) => setFilters({ ...filters, activity: e.target.value })} /></Field>
            <Field label="Status"><Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">Semua status</option><option>Berjaya</option><option>Gagal</option></Select></Field>
          </div>
          <div className="grid gap-3 border-t pt-3 sm:grid-cols-2 lg:grid-cols-[220px_minmax(220px,320px)]">
            <Field label="Tempoh audit"><Select value={filters.dateMode} onChange={(e) => setFilters({ ...filters, dateMode: e.target.value, date: '', month: '', year: '' })}><option value="all">Semua masa</option><option value="date">Tarikh tepat</option><option value="month">Bulan</option><option value="year">Tahun</option></Select></Field>
            {filters.dateMode === 'date' && <Field label="Pilih tarikh"><Input type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} /></Field>}
            {filters.dateMode === 'month' && <Field label="Pilih bulan"><Select value={filters.month} onChange={(e) => setFilters({ ...filters, month: e.target.value })}><option value="">Semua bulan</option>{auditMonthOptions.map((month) => <option key={month} value={month}>{monthLabel(month)}</option>)}</Select></Field>}
            {filters.dateMode === 'year' && <Field label="Pilih tahun"><Input type="number" min="2020" max="2100" placeholder="Contoh: 2026" value={filters.year} onChange={(e) => setFilters({ ...filters, year: e.target.value })} /></Field>}
          </div>
        </div>
        <p className="mb-3 text-sm text-secondary-token">{rows.length} rekod audit terkini dipaparkan.</p>
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
        <div className="desktop-table-scroll hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead><tr className="app-divider border-b"><th className="py-2">Masa</th><th>User</th><th>Role</th><th>Aktiviti</th><th>Modul</th><th>Status</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id_audit} className="app-divider border-b"><td className="text-data py-2">{new Date(r.tarikh_masa_aktiviti).toLocaleString()}</td><td>{r.nama_penuh || '-'}</td><td>{r.nama_peranan || '-'}</td><td>{r.jenis_aktiviti}</td><td>{r.modul_sistem}</td><td>{r.status_aktiviti}</td></tr>)}</tbody></table></div>
      </Card>
    </div>
  );
}

function NotificationsPage() {
  const [rows, setRows] = useState([]);
  const [detail, setDetail] = useState(null);
  const navigate = useNavigate();
  const load = useCallback(() => api.get('/notifications').then((res) => setRows(res.data)), []);
  useEffect(() => { load(); }, [load]);
  const markRead = async (id) => { try { await api.patch(`/notifications/${id}/read`); notifySuccess('Notifikasi ditanda dibaca'); load(); } catch (error) { notifyError(error, 'Notifikasi gagal dikemas kini'); } };
  const openReport = async (notification) => {
    try {
      if (notification.status_bacaan !== 'Dibaca') await api.patch(`/notifications/${notification.id_notifikasi}/read`);
      const { data } = await api.get(`/reports/${notification.id_laporan}`);
      setDetail(data);
      notifyAction('Laporan notifikasi dibuka');
      load();
    } catch (error) {
      notifyError(error, 'Laporan notifikasi gagal dibuka');
    }
  };
  const openAction = async (notification) => {
    try {
      if (notification.status_bacaan !== 'Dibaca') await api.patch(`/notifications/${notification.id_notifikasi}/read`);
      navigate('/tindakan');
      load();
    } catch (error) {
      notifyError(error, 'Notifikasi gagal dibuka');
    }
  };
  return <div className="space-y-5"><Card title="Notifikasi">{rows.length ? rows.map((n) => <div key={n.id_notifikasi} className="app-row mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border p-4 text-sm"><div><div className="flex items-center gap-2"><span className="font-medium text-primary-token">{n.tajuk_notifikasi}</span><Badge tone={n.tahap_keutamaan}>{n.tahap_keutamaan}</Badge></div><p className="mt-1">{n.mesej_notifikasi}</p><p className="text-data">{new Date(n.tarikh_hantar).toLocaleString()} - {n.status_bacaan}</p></div><div className="flex flex-wrap gap-2">{n.id_laporan && <Button variant="ghost" onClick={() => openReport(n)}><Eye size={16} /> Buka laporan</Button>}{n.id_tindakan && <Button variant="ghost" onClick={() => openAction(n)}><ClipboardCheck size={16} /> Buka tindakan</Button>}{n.status_bacaan !== 'Dibaca' && <Button variant="ghost" onClick={() => markRead(n.id_notifikasi)}>Tanda dibaca</Button>}</div></div>) : <EmptyState title="Tiada notifikasi" description="Notifikasi baharu akan dipaparkan di sini." />}</Card>{detail && <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(0,0,0,0.55)] p-0 sm:items-center sm:p-4"><div className="app-elevated motion-sheet max-h-[94vh] w-full overflow-y-auto rounded-t-lg border p-4 shadow-xl sm:max-w-5xl sm:rounded-lg lg:p-6"><div className="sticky top-0 z-10 -mx-4 -mt-4 mb-4 flex items-start justify-between gap-3 border-b bg-white px-4 py-4 lg:-mx-6 lg:-mt-6 lg:px-6"><div><h2>Laporan Notifikasi #{detail.report.id_laporan}</h2><p className="text-sm">Dibuka terus daripada notifikasi.</p></div><Button variant="ghost" onClick={() => setDetail(null)}><X size={16} /> Tutup</Button></div><ReportDetailContent detail={detail} /></div></div>}</div>;
}

function NlpTrainingPage() {
  const [rules, setRules] = useState([]);
  const [reports, setReports] = useState([]);
  const [nlpFilters, setNlpFilters] = useState({ search: '', post: '', shift: '', risk: '', status: '', timeMode: 'all', month: '', week: '' });
  const [pinnedNlpReports, setPinnedNlpReports] = useState([]);
  const [selectedNlp, setSelectedNlp] = useState(null);
  const [edits, setEdits] = useState({});
  const [newRule, setNewRule] = useState({ nama_kategori: '', tahap_keutamaan: 'Low', penerangan_kategori: '', kata_kunci_rujukan: '', status_kategori: 'Aktif' });
  const [saving, setSaving] = useState(null);
  const [confirmDeleteRule, setConfirmDeleteRule] = useState(null);
  const load = useCallback(() => api.get('/nlp-training').then((res) => {
    setRules(res.data);
    setEdits(Object.fromEntries(res.data.map((item) => [item.id_kategori_insiden, {
      nama_kategori: item.nama_kategori,
      tahap_keutamaan: item.tahap_keutamaan,
      penerangan_kategori: item.penerangan_kategori || '',
      kata_kunci_rujukan: (item.kata_kunci_rujukan || []).join(', '),
      status_kategori: item.status_kategori,
    }])));
  }), []);
  const loadReports = useCallback(() => api.get('/reports').then((res) => setReports(res.data)), []);
  useEffect(() => { load(); loadReports(); }, [load, loadReports]);
  const openNlp = async (reportId) => {
    try {
      const { data } = await api.get(`/nlp/${reportId}`);
      setSelectedNlp(data);
      notifyAction('Analisis NLP dibuka');
    } catch (error) {
      notifyError(error, 'Analisis NLP gagal dibuka');
    }
  };
  const updateEdit = (id, patch) => setEdits((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  const createRule = async (event) => {
    event.preventDefault();
    setSaving('new');
    try {
      await api.post('/nlp-training', newRule);
      setNewRule({ nama_kategori: '', tahap_keutamaan: 'Low', penerangan_kategori: '', kata_kunci_rujukan: '', status_kategori: 'Aktif' });
      notifySuccess('Kategori NLP baharu ditambah');
      load();
    } catch (error) {
      notifyError(error, 'Kategori NLP gagal ditambah');
    } finally {
      setSaving(null);
    }
  };
  const save = async (id) => {
    setSaving(id);
    try {
      const current = edits[id];
      await api.patch(`/nlp-training/${id}`, {
        nama_kategori: current.nama_kategori,
        tahap_keutamaan: current.tahap_keutamaan,
        penerangan_kategori: current.penerangan_kategori,
        kata_kunci_rujukan: current.kata_kunci_rujukan,
        status_kategori: current.status_kategori,
      });
      notifySuccess('Peraturan NLP dikemas kini');
      load();
    } catch (error) {
      notifyError(error, 'Peraturan NLP gagal dikemas kini');
    } finally {
      setSaving(null);
    }
  };
  const deleteRule = async () => {
    if (!confirmDeleteRule) return;
    setSaving(confirmDeleteRule.id_kategori_insiden);
    try {
      const { data } = await api.delete(`/nlp-training/${confirmDeleteRule.id_kategori_insiden}`);
      notifySuccess(data.deactivated ? 'Kategori NLP dinyahaktif kerana sudah digunakan dalam laporan' : 'Kategori NLP dipadam');
      setConfirmDeleteRule(null);
      load();
    } catch (error) {
      notifyError(error, 'Kategori NLP gagal dipadam');
    } finally {
      setSaving(null);
    }
  };
  const filteredNlpReports = reports.filter((report) => {
    const search = nlpFilters.search.trim().toLowerCase();
    const matchesSearch = !search || [report.tajuk_laporan, report.nama_penuh, report.nama_pos].some((value) => String(value || '').toLowerCase().includes(search));
    const matchesPost = !nlpFilters.post || report.nama_pos === nlpFilters.post;
    const matchesShift = !nlpFilters.shift || report.syif === nlpFilters.shift;
    const matchesRisk = !nlpFilters.risk || report.tahap_risiko === nlpFilters.risk;
    const matchesStatus = !nlpFilters.status || report.status_laporan === nlpFilters.status;
    const reportDate = report.tarikh_laporan?.slice(0, 10) || '';
    const reportMonth = reportDate.slice(0, 7);
    const matchesTime = nlpFilters.timeMode === 'all'
      || (nlpFilters.timeMode === 'month' && (!nlpFilters.month || reportMonth === nlpFilters.month))
      || (nlpFilters.timeMode === 'week' && (!nlpFilters.week || dateToWeekValue(reportDate) === nlpFilters.week));
    return matchesSearch && matchesPost && matchesShift && matchesRisk && matchesStatus && matchesTime;
  }).sort((a, b) => Number(pinnedNlpReports.includes(b.id_laporan)) - Number(pinnedNlpReports.includes(a.id_laporan)));
  const nlpPostOptions = [...new Set(reports.map((report) => report.nama_pos).filter(Boolean))].sort();
  const nlpMonthOptions = [...new Set(reports.map((report) => report.tarikh_laporan?.slice(0, 7)).filter(Boolean))].sort().reverse();
  const nlpWeekOptions = [...new Set(reports.map((report) => dateToWeekValue(report.tarikh_laporan?.slice(0, 10))).filter(Boolean))].sort().reverse();
  return (
    <div className="desktop-ops space-y-5">
      <PageHeader title="Analisis NLP" description="Pentadbir Sistem boleh melihat keputusan NLP penuh dan melatih kata kunci model operasi." />
      <AlertMessage type="success">Tujuan halaman ini: semak bagaimana sistem mengklasifikasikan laporan, lihat kata kunci/skor risiko, dan kemas kini kata kunci rujukan supaya laporan baharu lebih tepat. Halaman ini bukan tempat untuk meluluskan laporan atau menutup tindakan.</AlertMessage>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_460px] 2xl:grid-cols-[minmax(0,1fr)_520px]">
        <Card title="Senarai Laporan">
          <div className="mb-4 space-y-3 rounded-xl border bg-white p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(280px,1fr)_auto]">
              <Field label="Carian laporan">
                <Input placeholder="Cari laporan, pengawal atau pos" value={nlpFilters.search} onChange={(e) => setNlpFilters({ ...nlpFilters, search: e.target.value })} />
              </Field>
              <Button type="button" variant="ghost" className="self-end" onClick={() => setNlpFilters({ search: '', post: '', shift: '', risk: '', status: '', timeMode: 'all', month: '', week: '' })}>Reset tapisan</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Field label="Pos"><Select value={nlpFilters.post} onChange={(e) => setNlpFilters({ ...nlpFilters, post: e.target.value })}><option value="">Semua pos</option>{nlpPostOptions.map((post) => <option key={post}>{post}</option>)}</Select></Field>
              <Field label="Syif"><Select value={nlpFilters.shift} onChange={(e) => setNlpFilters({ ...nlpFilters, shift: e.target.value })}><option value="">Semua syif</option><option>Pagi</option><option>Petang</option><option>Malam</option></Select></Field>
              <Field label="Risiko"><Select value={nlpFilters.risk} onChange={(e) => setNlpFilters({ ...nlpFilters, risk: e.target.value })}><option value="">Semua risiko</option><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></Select></Field>
              <Field label="Status"><Select value={nlpFilters.status} onChange={(e) => setNlpFilters({ ...nlpFilters, status: e.target.value })}><option value="">Semua status</option><option>Dihantar</option><option>Diluluskan</option><option>Ditolak</option></Select></Field>
            </div>
            <div className="grid gap-3 border-t pt-3 sm:grid-cols-2 lg:grid-cols-[220px_minmax(260px,360px)]">
              <Field label="Tempoh laporan"><Select value={nlpFilters.timeMode} onChange={(e) => setNlpFilters({ ...nlpFilters, timeMode: e.target.value, month: '', week: '' })}><option value="all">Semua masa</option><option value="month">Ikut bulan</option><option value="week">Ikut minggu</option></Select></Field>
              {nlpFilters.timeMode === 'month' && <Field label="Pilih bulan"><Select value={nlpFilters.month} onChange={(e) => setNlpFilters({ ...nlpFilters, month: e.target.value })}><option value="">Semua bulan</option>{nlpMonthOptions.map((month) => <option key={month} value={month}>{monthLabel(month)}</option>)}</Select></Field>}
              {nlpFilters.timeMode === 'week' && <Field label="Pilih minggu"><Select value={nlpFilters.week} onChange={(e) => setNlpFilters({ ...nlpFilters, week: e.target.value })}><option value="">Semua minggu</option>{nlpWeekOptions.map((week) => <option key={week} value={week}>{weekLabel(week)}</option>)}</Select></Field>}
            </div>
          </div>
          <p className="mb-3 text-sm text-secondary-token">{filteredNlpReports.length} daripada {reports.length} laporan dipaparkan.</p>
          {filteredNlpReports.length ? filteredNlpReports.map((report) => (
            <div key={report.id_laporan} className="desktop-record app-row mb-2 grid gap-3 rounded-xl border p-3 text-sm md:grid-cols-[1fr_auto]">
              <div>
                <p className="font-medium text-primary-token">{report.tajuk_laporan}</p>
                <p>{report.nama_penuh} - {report.nama_pos} - {report.syif}</p>
                <p className="text-data">{report.tarikh_laporan?.slice(0, 10)} {report.masa_laporan || ''} - {monthLabel(report.tarikh_laporan?.slice(0, 7))} - {weekLabel(dateToWeekValue(report.tarikh_laporan?.slice(0, 10))) || '-'}</p>
                <div className="mt-2 flex flex-wrap gap-2">{pinnedNlpReports.includes(report.id_laporan) && <Badge>Dipin</Badge>}<Badge tone={report.tahap_risiko}>{report.tahap_risiko}</Badge><Badge tone={statusTone(report.status_laporan)}>{report.status_laporan}</Badge></div>
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                <Button variant="ghost" onClick={() => setPinnedNlpReports((current) => current.includes(report.id_laporan) ? current.filter((id) => id !== report.id_laporan) : [...current, report.id_laporan])}>{pinnedNlpReports.includes(report.id_laporan) ? 'Nyahpin' : 'Pin'}</Button>
                <Button variant="ghost" onClick={() => openNlp(report.id_laporan)}><Eye size={16} /> NLP</Button>
              </div>
            </div>
          )) : <EmptyState title="Tiada laporan" description="Laporan harian akan dipaparkan di sini." />}
        </Card>
        <Card title="Keputusan NLP Penuh" className="desktop-sticky-panel">
          {selectedNlp ? (
            <div className="space-y-4 text-sm">
              <div><p className="label-caps">Laporan</p><h3>{selectedNlp.tajuk_laporan}</h3><p>{selectedNlp.kandungan_laporan}</p></div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="app-row rounded-xl border p-4"><p className="label-caps">Skor Risiko</p><p className="text-kpi mt-2">{selectedNlp.skor_risiko}</p></div>
                <div className="app-row rounded-xl border p-4"><p className="label-caps">Keyakinan</p><p className="text-kpi mt-2">{Math.round(Number(selectedNlp.tahap_keyakinan || 0) * 100)}%</p></div>
                <div className="app-row rounded-xl border p-4"><p className="label-caps">Tahap Risiko</p><div className="mt-3"><Badge tone={selectedNlp.tahap_risiko}>{selectedNlp.tahap_risiko}</Badge></div></div>
              </div>
              <p><span className="font-medium text-primary-token">Kategori:</span> {selectedNlp.kategori_dikesan}</p>
              <div><p className="label-caps mb-2">Kata kunci dikesan</p><div className="flex flex-wrap gap-2">{(selectedNlp.kata_kunci_dikesan || []).map((keyword) => <Badge key={keyword}>{keyword}</Badge>)}</div></div>
              <p><span className="font-medium text-primary-token">Ringkasan:</span> {selectedNlp.ringkasan_automatik}</p>
              <p><span className="font-medium text-primary-token">Penjelasan:</span> {selectedNlp.explanation}</p>
            </div>
          ) : <EmptyState title="Pilih laporan" description="Pilih laporan untuk melihat kata kunci, kategori, skor risiko dan keyakinan NLP." />}
        </Card>
      </div>
      <AlertMessage type="success">Perubahan latihan di bawah digunakan untuk laporan baharu selepas disimpan. Tambah istilah lapangan sebenar seperti nama insiden, lokasi biasa, atau perkataan yang selalu digunakan pengawal.</AlertMessage>
      <Card title="Tambah Kategori NLP Baharu">
        <form onSubmit={createRule} className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-[1fr_180px_160px]">
            <Field label="Nama kategori"><Input required value={newRule.nama_kategori} onChange={(e) => setNewRule({ ...newRule, nama_kategori: e.target.value })} placeholder="Contoh: Gangguan Awam" /></Field>
            <Field label="Tahap risiko"><Select value={newRule.tahap_keutamaan} onChange={(e) => setNewRule({ ...newRule, tahap_keutamaan: e.target.value })}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></Select></Field>
            <Field label="Status"><Select value={newRule.status_kategori} onChange={(e) => setNewRule({ ...newRule, status_kategori: e.target.value })}><option>Aktif</option><option>Tidak Aktif</option></Select></Field>
          </div>
          <Field label="Penerangan"><Input value={newRule.penerangan_kategori} onChange={(e) => setNewRule({ ...newRule, penerangan_kategori: e.target.value })} placeholder="Kegunaan kategori ini dalam laporan operasi" /></Field>
          <Field label="Kata kunci rujukan"><Textarea rows={3} required value={newRule.kata_kunci_rujukan} onChange={(e) => setNewRule({ ...newRule, kata_kunci_rujukan: e.target.value })} placeholder="Pisahkan dengan koma. Contoh: kekecohan, bergaduh, enggan patuh arahan" /></Field>
          <Button disabled={saving === 'new'}>{saving === 'new' ? 'Menambah...' : 'Tambah NLP'}</Button>
        </form>
      </Card>
      <div className="grid gap-4 xl:grid-cols-3">
        {rules.length ? rules.map((rule) => {
          const edit = edits[rule.id_kategori_insiden] || {};
          return (
            <Card key={rule.id_kategori_insiden} title={rule.nama_kategori} action={<Badge tone={edit.tahap_keutamaan}>{edit.tahap_keutamaan}</Badge>}>
              <div className="space-y-3">
                <Field label="Nama kategori"><Input value={edit.nama_kategori || ''} onChange={(e) => updateEdit(rule.id_kategori_insiden, { nama_kategori: e.target.value })} /></Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Tahap risiko"><Select value={edit.tahap_keutamaan || 'Low'} onChange={(e) => updateEdit(rule.id_kategori_insiden, { tahap_keutamaan: e.target.value })}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></Select></Field>
                  <Field label="Status"><Select value={edit.status_kategori || 'Aktif'} onChange={(e) => updateEdit(rule.id_kategori_insiden, { status_kategori: e.target.value })}><option>Aktif</option><option>Tidak Aktif</option></Select></Field>
                </div>
                <Field label="Penerangan"><Input value={edit.penerangan_kategori || ''} onChange={(e) => updateEdit(rule.id_kategori_insiden, { penerangan_kategori: e.target.value })} /></Field>
                <Field label="Kata kunci rujukan"><Textarea rows={4} value={edit.kata_kunci_rujukan || ''} onChange={(e) => updateEdit(rule.id_kategori_insiden, { kata_kunci_rujukan: e.target.value })} /></Field>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => save(rule.id_kategori_insiden)} disabled={saving === rule.id_kategori_insiden}>{saving === rule.id_kategori_insiden ? 'Menyimpan...' : 'Simpan latihan'}</Button>
                  <Button variant="danger" onClick={() => setConfirmDeleteRule(rule)} disabled={saving === rule.id_kategori_insiden}>Padam</Button>
                </div>
              </div>
            </Card>
          );
        }) : <LoadingState message="Memuatkan peraturan NLP..." />}
      </div>
      <ConfirmModal
        open={!!confirmDeleteRule}
        title="Padam kategori NLP?"
        message={`Kategori "${confirmDeleteRule?.nama_kategori || ''}" akan dipadam jika belum digunakan. Jika sudah digunakan dalam laporan, sistem akan nyahaktifkan kategori ini supaya rekod lama kekal selamat.`}
        confirmLabel="Padam"
        danger
        onCancel={() => setConfirmDeleteRule(null)}
        onConfirm={deleteRule}
      />
    </div>
  );
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
      notifySuccess('Kata laluan berjaya ditukar');
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

function UsersPage({ auth }) {
  const [meta, setMeta] = useState({ roles: [] });
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
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
      notifySuccess('Pengguna berjaya ditambah');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Pengguna gagal ditambah');
      notifyError(err, 'Pengguna gagal ditambah');
    }
  };
  const update = async (id, patch) => { try { await api.patch(`/users/${id}`, patch); notifySuccess('Pengguna dikemas kini'); load(); } catch (error) { notifyError(error, 'Pengguna gagal dikemas kini'); } };
  const query = search.trim().toLowerCase();
  const filteredUsers = users.filter((user) => !query || [user.nama_penuh, user.nama_pengguna, user.emel, user.nama_peranan].some((value) => String(value || '').toLowerCase().includes(query)));
  return <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]"><Card title="Tambah Pengguna"><form onSubmit={create} className="space-y-3"><Field label="Peranan"><Select required value={form.id_peranan || ''} onChange={(e) => setForm({ ...form, id_peranan: Number(e.target.value) })}><option value="">Pilih peranan</option>{meta.roles.map((r) => <option key={r.id_peranan} value={r.id_peranan}>{r.nama_peranan}</option>)}</Select></Field><Field label="Nama penuh"><Input required value={form.nama_penuh || ''} onChange={(e) => setForm({ ...form, nama_penuh: e.target.value })} /></Field><Field label="Nama pengguna"><Input required value={form.nama_pengguna || ''} onChange={(e) => setForm({ ...form, nama_pengguna: e.target.value })} /></Field><Field label="Emel"><Input type="email" required value={form.emel || ''} onChange={(e) => setForm({ ...form, emel: e.target.value })} /></Field><Field label="No telefon"><Input value={form.no_telefon || ''} onChange={(e) => setForm({ ...form, no_telefon: e.target.value })} /></Field><Field label="Kata laluan sementara"><PasswordInput required value={form.kata_laluan || ''} onChange={(e) => setForm({ ...form, kata_laluan: e.target.value })} /></Field>{error && <AlertMessage>{error}</AlertMessage>}<Button className="w-full sm:w-auto">Tambah pengguna</Button></form></Card><Card title="Senarai Pengguna" action={<Input placeholder="Cari nama / username" value={search} onChange={(e) => setSearch(e.target.value)} className="min-w-64" />}>{filteredUsers.length ? filteredUsers.map((u) => { const isSelf = Number(u.id_pengguna) === Number(auth.user?.id_pengguna); return <div key={u.id_pengguna} className="app-row mb-2 grid gap-2 rounded-md border p-3 text-sm md:grid-cols-[1fr_220px_auto]"><span><span className="font-medium text-primary-token">{u.nama_penuh}</span>{isSelf && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Akaun saya</span>}<br />{u.nama_pengguna} - {u.emel}</span><div><Select value={u.id_peranan} disabled={isSelf} onChange={(e) => update(u.id_pengguna, { id_peranan: Number(e.target.value) })}>{meta.roles.map((r) => <option key={r.id_peranan} value={r.id_peranan}>{r.nama_peranan}</option>)}</Select>{isSelf && <p className="mt-1 text-xs text-secondary-token">Peranan dan status akaun sendiri tidak boleh ditukar.</p>}</div><Button variant="ghost" disabled={isSelf} onClick={() => setConfirmUser(u)}>{u.status_akaun}</Button></div>; }) : <EmptyState title="Tiada pengguna" description="Tiada pengguna sepadan dengan carian semasa." />}</Card><ConfirmModal open={!!confirmUser} title="Tukar status akaun?" message={`Akaun ${confirmUser?.nama_penuh || ''} akan ditukar status.`} confirmLabel="Sahkan" danger={confirmUser?.status_akaun === 'Aktif'} onCancel={() => setConfirmUser(null)} onConfirm={async () => { await update(confirmUser.id_pengguna, { status_akaun: confirmUser.status_akaun === 'Aktif' ? 'Tidak Aktif' : 'Aktif' }); setConfirmUser(null); }} /></div>;
}

function PostsPage() {
  const [posts, setPosts] = useState([]);
  const [form, setForm] = useState({ status_pos: 'Aktif' });
  const load = useCallback(() => api.get('/posts').then((res) => setPosts(res.data)), []);
  useEffect(() => { load(); }, [load]);
  const create = async (e) => { e.preventDefault(); try { await api.post('/posts', form); setForm({ status_pos: 'Aktif' }); notifySuccess('Pos kawalan disimpan'); load(); } catch (error) { notifyError(error, 'Pos kawalan gagal disimpan'); } };
  const update = async (id, patch) => { try { await api.patch(`/posts/${id}`, patch); notifySuccess('Pos kawalan dikemas kini'); load(); } catch (error) { notifyError(error, 'Pos kawalan gagal dikemas kini'); } };
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
        <Route path="/semakan" element={<Protected auth={auth} roles={[ROLE.admin, ROLE.chief]}><ReviewReports auth={auth} /></Protected>} />
        <Route path="/tindakan" element={<Protected auth={auth} roles={[ROLE.admin, ROLE.chief]}><FollowUp auth={auth} /></Protected>} />
        <Route path="/nlp" element={<Protected auth={auth} roles={[ROLE.admin]}><NlpTrainingPage /></Protected>} />
        <Route path="/audit" element={<Protected auth={auth} roles={[ROLE.admin]}><AuditTrail /></Protected>} />
        <Route path="/pengguna" element={<Protected auth={auth} roles={[ROLE.admin]}><UsersPage auth={auth} /></Protected>} />
        <Route path="/pos" element={<Protected auth={auth} roles={[ROLE.admin]}><PostsPage /></Protected>} />
        <Route path="/notifikasi" element={<Protected auth={auth} roles={[ROLE.admin, ROLE.chief, ROLE.guard]}><NotificationsPage /></Protected>} />
        <Route path="/kata-laluan" element={<Protected auth={auth} roles={[ROLE.admin, ROLE.chief, ROLE.guard]}><ChangePasswordPage /></Protected>} />
        <Route path="*" element={<Navigate to={auth.user ? defaultPath : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
