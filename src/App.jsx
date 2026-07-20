import { useMemo } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useAuth } from './context/AuthContext';
import { ROLE } from './utils/helpers';
import { Protected } from './layouts/Shell';

import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { GuardDashboard } from './pages/GuardDashboard';
import { SchedulePage } from './pages/SchedulePage';
import { DailyReport } from './pages/DailyReport';
import { ReviewReports } from './pages/ReviewReports';
import { FollowUp } from './pages/FollowUp';
import { NlpTrainingPage } from './pages/NlpTrainingPage';
import { AuditTrail } from './pages/AuditTrail';
import { UsersPage } from './pages/UsersPage';
import { PostsPage } from './pages/PostsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const auth = useAuth();
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
        <Route path="/login" element={auth.user ? <Navigate to={defaultPath} replace /> : <Login auth={auth} />} />
        <Route path="/dashboard" element={<Protected auth={auth} roles={[ROLE.admin, ROLE.chief]}><Dashboard auth={auth} /></Protected>} />
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
    </QueryClientProvider>
  );
}

export default App;
