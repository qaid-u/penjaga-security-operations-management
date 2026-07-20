import { useState } from 'react';
import api from '../api/axios';
import { notifyError, notifySuccess } from '../utils/helpers';
import { Card, Button, AlertMessage, Field, PasswordInput } from '../components/ui';

export function ChangePasswordPage() {
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
