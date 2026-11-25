import { lazy, useEffect, useMemo } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useAuth } from './context/AuthContext';
import { ROLE } from './utils/helpers';
import { Protected } from './layouts/Shell';

import { Login } from './pages/Login';

// Each page is its own chunk so a phone only downloads the screens it opens.
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const GuardDashboard = lazy(() => import('./pages/GuardDashboard').then((m) => ({ default: m.GuardDashboard })));
const SchedulePage = lazy(() => import('./pages/SchedulePage').then((m) => ({ default: m.SchedulePage })));
const DailyReport = lazy(() => import('./pages/DailyReport').then((m) => ({ default: m.DailyReport })));
const ReviewReports = lazy(() => import('./pages/ReviewReports').then((m) => ({ default: m.ReviewReports })));
const FollowUp = lazy(() => import('./pages/FollowUp').then((m) => ({ default: m.FollowUp })));
const AuditTrail = lazy(() => import('./pages/AuditTrail').then((m) => ({ default: m.AuditTrail })));
const UsersPage = lazy(() => import('./pages/UsersPage').then((m) => ({ default: m.UsersPage })));
const PostsPage = lazy(() => import('./pages/PostsPage').then((m) => ({ default: m.PostsPage })));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage').then((m) => ({ default: m.ChangePasswordPage })));
const ThreeDCommandCentre = lazy(() => import('./pages/ThreeDCommandCentre'));

function App() {
  const auth = useAuth();
  const identity = `${auth.user?.id_pengguna ?? ''}:${auth.user?.nama_peranan ?? ''}`;
  const queryClient = useMemo(() => {
    // Each signed-in identity owns its cache, including legacy queries without user keys.
    return new QueryClient({ defaultOptions: { queries: { retry:1,refetchOnWindowFocus:false } }, meta: { identity } });
  }, [identity]);
  useEffect(() => () => { queryClient.cancelQueries();queryClient.clear(); }, [queryClient]);
  const defaultPath = useMemo(() => auth.user?.nama_peranan === ROLE.guard ? '/pengawal' : '/dashboard', [auth.user]);

  return (
    <QueryClientProvider client={queryClient}>
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
        <Route path="/3d-command-centre" element={<Protected auth={auth} roles={[ROLE.admin, ROLE.chief]}><ThreeDCommandCentre /></Protected>} />
        <Route path="/login" element={auth.user ? <Navigate to={defaultPath} replace /> : <Login auth={auth} />} />
        <Route path="/dashboard" element={<Protected auth={auth} roles={[ROLE.admin, ROLE.chief]}><Dashboard auth={auth} /></Protected>} />
        <Route path="/pengawal" element={<Protected auth={auth} roles={[ROLE.guard]}><GuardDashboard /></Protected>} />
        <Route path="/jadual" element={<Protected auth={auth} roles={[ROLE.admin, ROLE.chief, ROLE.guard]}><SchedulePage auth={auth} /></Protected>} />
        <Route path="/laporan" element={<Protected auth={auth} roles={[ROLE.guard]}><DailyReport /></Protected>} />
        <Route path="/semakan" element={<Protected auth={auth} roles={[ROLE.admin, ROLE.chief]}><ReviewReports auth={auth} /></Protected>} />
        <Route path="/tindakan" element={<Protected auth={auth} roles={[ROLE.admin, ROLE.chief]}><FollowUp auth={auth} /></Protected>} />
        <Route path="/nlp" element={<Protected auth={auth} roles={[ROLE.admin]}><Navigate to="/semakan" replace /></Protected>} />
        <Route path="/audit" element={<Protected auth={auth} roles={[ROLE.admin]}><AuditTrail /></Protected>} />
        <Route path="/pengguna" element={<Protected auth={auth} roles={[ROLE.admin]}><UsersPage auth={auth} /></Protected>} />
        <Route path="/pos" element={<Protected auth={auth} roles={[ROLE.admin]}><PostsPage /></Protected>} />
        <Route path="/notifikasi" element={<Protected auth={auth} roles={[ROLE.admin, ROLE.chief, ROLE.guard]}><NotificationsPage /></Protected>} />
        <Route path="/kata-laluan" element={<Protected auth={auth} roles={[ROLE.admin, ROLE.chief, ROLE.guard]}><ChangePasswordPage /></Protected>} />
        <Route path="*" element={<Navigate to={auth.user ? defaultPath : '/login'} replace />} />
      </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
