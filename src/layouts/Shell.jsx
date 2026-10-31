import { useEffect, useRef, useState } from 'react';
import { NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, FileText, FileCheck, ClipboardCheck, Brain, History, Users, MapPin, Bell, KeyRound, Shield, X, Menu, LogOut, Box } from 'lucide-react';
import { NotificationCount } from '../components/NotificationCount';
import { useUnreadNotifications } from '../hooks/useUnreadNotifications';
import { ROLE } from '../utils/helpers';
import { Button, Card } from '../components/ui';
import '../components/building/model-showcase.css';
import '../components/workspace.css';

export function Shell({ auth, children }) {
  const unread = useUnreadNotifications();
  const [open, setOpen] = useState(false);
  const sidebar = useRef(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const role = auth.user?.nama_peranan;
  const guard = role === ROLE.guard;
  const nav = [
    { to: guard ? '/pengawal' : '/dashboard', label: 'Ringkasan', short: 'Utama', icon: LayoutDashboard, group: 'Kerja harian' },
    { to: '/jadual', label: guard ? 'Jadual saya' : 'Jadual bertugas', short: 'Jadual', icon: CalendarDays, group: 'Kerja harian' },
    ...(guard ? [{ to: '/laporan', label: 'Laporan harian', short: 'Laporan', icon: FileText, group: 'Kerja harian' }] : [
      { to: '/semakan', label: role === ROLE.admin ? 'Pemantauan laporan' : 'Semakan laporan', short: 'Laporan', icon: FileCheck, group: 'Kerja harian' },
      { to: '/tindakan', label: 'Tindakan susulan', short: 'Tindakan', icon: ClipboardCheck, group: 'Kerja harian' },
      { to: '/3d-command-centre', label: 'Pusat Kawalan 3D', icon: Box, group: 'Terokai' },
    ]),
    ...(role === ROLE.admin ? [
      { to: '/nlp', label: 'Analisis laporan', icon: Brain, group: 'Pengurusan' },
      { to: '/pengguna', label: 'Pengguna', icon: Users, group: 'Pengurusan' },
      { to: '/pos', label: 'Pos kawalan', icon: MapPin, group: 'Pengurusan' },
      { to: '/audit', label: 'Rekod aktiviti', icon: History, group: 'Pengurusan' },
    ] : []),
    { to: '/notifikasi', label: 'Notifikasi', short: 'Notifikasi', icon: Bell, group: 'Akaun' },
    { to: '/kata-laluan', label: 'Tukar kata laluan', icon: KeyRound, group: 'Akaun' },
  ];
  const current = nav.find(item => item.to === pathname);
  const mobileNav = guard ? nav.filter(item => ['/pengawal','/jadual','/laporan','/notifikasi'].includes(item.to)) : nav.filter(item => item.group === 'Kerja harian');
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Focus after the drawer becomes visible and the opening click finishes.
    const frame = requestAnimationFrame(() => sidebar.current?.querySelector('button')?.focus());
    const closeOnWide = () => { if (window.innerWidth >= 1024) setOpen(false); };
    window.addEventListener('resize', closeOnWide);
    return () => { cancelAnimationFrame(frame); document.body.style.overflow = overflow; window.removeEventListener('resize', closeOnWide); previous?.focus?.(); };
  }, [open]);
  const drawerKeys = event => {
    if (!open) return;
    if (event.key === 'Escape') { setOpen(false); return; }
    if (event.key !== 'Tab') return;
    const nodes = [...sidebar.current.querySelectorAll('a, button, summary')].filter(node => node.getClientRects().length);
    const first = nodes[0], last = nodes.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  const navItem = item => {
    const Icon = item.icon;
    return <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)} className={({isActive}) => `workspace-nav-link ${isActive ? 'is-active' : ''}`}><Icon size={18} aria-hidden="true" /><span>{item.label}</span>{item.to === '/notifikasi' && <NotificationCount count={unread.data?.unread} />}</NavLink>;
  };
  const logout = () => { auth.logout(); navigate('/login'); };
  return <div className="workspace-shell">
    <a href="#main-content" className="workspace-skip">Langkau ke kandungan</a>
    {open && <button className="workspace-backdrop" tabIndex={-1} aria-label="Tutup menu navigasi" onClick={() => setOpen(false)} />}
    <aside ref={sidebar} className={`workspace-sidebar ${open ? 'is-open' : ''}`} onKeyDown={drawerKeys} aria-label="Menu utama" role={open ? 'dialog' : undefined} aria-modal={open || undefined}>
      <div className="workspace-brand"><span className="workspace-brand-icon"><Shield size={22} /></span><div><strong>PENJAGA</strong><small>Operasi keselamatan</small></div><button className="workspace-close" onClick={() => setOpen(false)} aria-label="Tutup menu"><X size={20} /></button></div>
      <nav aria-label="Navigasi utama" className="workspace-navigation">
        <p className="workspace-nav-heading">Kerja harian</p>{nav.filter(item => item.group === 'Kerja harian').map(navItem)}
        {!guard && <><p className="workspace-nav-heading">Terokai</p>{nav.filter(item => item.group === 'Terokai').map(navItem)}</>}
        {role === ROLE.admin && <details key={current?.group === 'Pengurusan' ? 'management' : 'daily'} className="workspace-management" open={current?.group === 'Pengurusan' || undefined}><summary>Pengurusan</summary><div>{nav.filter(item => item.group === 'Pengurusan').map(navItem)}</div></details>}
        <p className="workspace-nav-heading">Akaun</p>{nav.filter(item => item.group === 'Akaun').map(navItem)}
      </nav>
      <div className="workspace-user"><span className="workspace-avatar">{auth.user?.nama_penuh?.charAt(0) || 'P'}</span><div><strong>{auth.user?.nama_penuh}</strong><small>{role}</small></div><button onClick={logout} aria-label="Logout" title="Log keluar"><LogOut size={18} /></button></div>
    </aside>
    <div className="workspace-body">
      <header className="workspace-topbar"><button className="workspace-menu-toggle" aria-label="Buka menu" aria-expanded={open} onClick={() => setOpen(true)}><Menu size={22} /></button><div className="workspace-breadcrumb"><span>PENJAGA</span><span aria-hidden="true">/</span><strong>{current?.label || 'Operasi'}</strong></div><div className="workspace-topbar-end"><span>{role}</span><NavLink to="/notifikasi" aria-label="Buka notifikasi" className="workspace-icon-button"><Bell size={19} /><NotificationCount count={unread.data?.unread} /></NavLink></div></header>
      <main id="main-content" tabIndex={-1} className="workspace-main">{children}</main>
      <footer className="workspace-footer">PENJAGA · Pengurusan operasi keselamatan</footer>
    </div>
    <nav aria-label="Navigasi mudah alih" className="workspace-mobile-nav">{mobileNav.map(item => { const Icon=item.icon; return <NavLink key={item.to} to={item.to} className={({isActive}) => isActive ? 'is-active' : ''}><Icon size={20} aria-hidden="true" /><span>{item.short}</span></NavLink>; })}<button onClick={() => setOpen(true)} aria-label="Buka menu penuh"><Menu size={20} /><span>Menu</span></button></nav>
  </div>;
}

export function Protected({ auth, roles, children }) {
  const navigate = useNavigate();
  if (!auth.user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(auth.user.nama_peranan)) return <Shell auth={auth}><Card title="Akses Tidak Dibenarkan"><p>Anda tidak mempunyai kebenaran untuk mengakses halaman ini.</p><Button className="mt-4" onClick={() => navigate(auth.user.nama_peranan === ROLE.guard ? '/pengawal' : '/dashboard')}>Kembali ke ringkasan</Button></Card></Shell>;
  return <Shell auth={auth}>{children}</Shell>;
}
