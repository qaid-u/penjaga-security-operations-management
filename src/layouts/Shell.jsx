import { useState } from 'react';
import { NavLink, Navigate, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, FileText, FileCheck, ClipboardCheck, Brain, History, Users, MapPin, Bell, KeyRound, Shield, X, Menu, LogOut, Box } from 'lucide-react';
import { ROLE } from '../utils/helpers';
import { Badge, Button, Card } from '../components/ui';
import '../components/building/model-showcase.css';

export function Shell({ auth, children }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const nav = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: [ROLE.admin, ROLE.chief] },
    { to: '/3d-command-centre', label: 'Pusat Kawalan 3D', icon: Box, roles: [ROLE.admin, ROLE.chief] },
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
          <button className="lg:hidden min-h-11 min-w-11 flex items-center justify-center" aria-label="Tutup menu" onClick={() => setOpen(false)}><X size={20} /></button>
        </div>
        <nav className="space-y-1 p-3">
          {nav.map((item) => {
            const Icon = item.icon;
            const spatial = item.to === '/3d-command-centre';
            return (
              <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${spatial ? 'app-spatial-nav' : ''} ${isActive ? 'app-nav-active' : 'app-nav'}`}>
                <Icon size={18} aria-hidden="true" /> <span>{item.label}</span>{spatial && <span className="app-spatial-nav__tag" aria-hidden="true">3D</span>}
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

export function Protected({ auth, roles, children }) {
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
