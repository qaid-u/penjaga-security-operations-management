import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { readStoredUser } from '../utils/sessionStorage';
import { ACTIVITY_KEY, isIdle, startIdleWatch } from '../utils/idleSession';

const AuthContext = createContext();

// Revokes the token on the server, then forgets it locally. Signing out never waits for the network.
function endSession() {
  const token = localStorage.getItem('token');
  if (token) {
    api.post('/auth/logout', {}, { headers: { Authorization: `Bearer ${token}` } })
      .catch(() => { /* The local session is cleared even if the server cannot be reached. */ });
  }
  localStorage.removeItem('token');
  localStorage.removeItem('penjaga_user');
  localStorage.removeItem(ACTIVITY_KEY);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    if (!isIdle(localStorage)) return readStoredUser();
    endSession();
    return null;
  });
  const [loading, setLoading] = useState(false);

  const login = async (username, password) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { username, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('penjaga_user', JSON.stringify(data.user));
      localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
      setUser(data.user);
      return { ok: true, role: data.user.nama_peranan };
    } catch (error) {
      return { ok: false, message: error.response?.data?.message || 'Login gagal' };
    } finally {
      setLoading(false);
    }
  };

  const logout = useCallback(() => {
    endSession();
    setUser(null);
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    return startIdleWatch(() => {
      logout();
      toast('Sesi ditamatkan kerana tiada aktiviti selama 30 minit.', { id: 'idle-logout', duration: 10_000 });
    });
  }, [user, logout]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
