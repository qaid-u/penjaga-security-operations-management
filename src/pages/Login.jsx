import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { Card, Field, Input, PasswordInput, Button } from '../components/ui';
import { ROLE, notifyError, notifySuccess } from '../utils/helpers';

export function Login({ auth }) {
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
