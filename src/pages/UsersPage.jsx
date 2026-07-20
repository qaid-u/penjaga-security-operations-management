import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';
import { notifyError, notifySuccess } from '../utils/helpers';
import { Card, Button, AlertMessage, Field, Input, Select, EmptyState, PasswordInput, ConfirmModal } from '../components/ui';

export function UsersPage({ auth }) {
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
  
  const update = async (id, patch) => { 
    try { 
      await api.patch(`/users/${id}`, patch); 
      notifySuccess('Pengguna dikemas kini'); 
      load(); 
    } catch (error) { 
      notifyError(error, 'Pengguna gagal dikemas kini'); 
    } 
  };
  
  const query = search.trim().toLowerCase();
  const filteredUsers = users.filter((user) => !query || [user.nama_penuh, user.nama_pengguna, user.emel, user.nama_peranan].some((value) => String(value || '').toLowerCase().includes(query)));
  
  return (
    <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
      <Card title="Tambah Pengguna">
        <form onSubmit={create} className="space-y-3">
          <Field label="Peranan">
            <Select required value={form.id_peranan || ''} onChange={(e) => setForm({ ...form, id_peranan: Number(e.target.value) })}>
              <option value="">Pilih peranan</option>
              {meta.roles.map((r) => <option key={r.id_peranan} value={r.id_peranan}>{r.nama_peranan}</option>)}
            </Select>
          </Field>
          <Field label="Nama penuh"><Input required value={form.nama_penuh || ''} onChange={(e) => setForm({ ...form, nama_penuh: e.target.value })} /></Field>
          <Field label="Nama pengguna"><Input required value={form.nama_pengguna || ''} onChange={(e) => setForm({ ...form, nama_pengguna: e.target.value })} /></Field>
          <Field label="Emel"><Input type="email" required value={form.emel || ''} onChange={(e) => setForm({ ...form, emel: e.target.value })} /></Field>
          <Field label="No telefon"><Input value={form.no_telefon || ''} onChange={(e) => setForm({ ...form, no_telefon: e.target.value })} /></Field>
          <Field label="Kata laluan sementara"><PasswordInput required value={form.kata_laluan || ''} onChange={(e) => setForm({ ...form, kata_laluan: e.target.value })} /></Field>
          {error && <AlertMessage>{error}</AlertMessage>}
          <Button className="w-full sm:w-auto">Tambah pengguna</Button>
        </form>
      </Card>
      
      <Card title="Senarai Pengguna" action={<Input placeholder="Cari nama / username" value={search} onChange={(e) => setSearch(e.target.value)} className="min-w-64" />}>
        {filteredUsers.length ? filteredUsers.map((u) => { 
          const isSelf = Number(u.id_pengguna) === Number(auth.user?.id_pengguna); 
          return (
            <div key={u.id_pengguna} className="app-row mb-2 grid gap-2 rounded-md border p-3 text-sm md:grid-cols-[1fr_220px_auto]">
              <span>
                <span className="font-medium text-primary-token">{u.nama_penuh}</span>
                {isSelf && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Akaun saya</span>}<br />
                {u.nama_pengguna} - {u.emel}
              </span>
              <div>
                <Select value={u.id_peranan} disabled={isSelf} onChange={(e) => update(u.id_pengguna, { id_peranan: Number(e.target.value) })}>
                  {meta.roles.map((r) => <option key={r.id_peranan} value={r.id_peranan}>{r.nama_peranan}</option>)}
                </Select>
                {isSelf && <p className="mt-1 text-xs text-secondary-token">Peranan dan status akaun sendiri tidak boleh ditukar.</p>}
              </div>
              <Button variant="ghost" disabled={isSelf} onClick={() => setConfirmUser(u)}>{u.status_akaun}</Button>
            </div>
          ); 
        }) : <EmptyState title="Tiada pengguna" description="Tiada pengguna sepadan dengan carian semasa." />}
      </Card>
      
      <ConfirmModal 
        open={!!confirmUser} 
        title="Tukar status akaun?" 
        message={`Akaun ${confirmUser?.nama_penuh || ''} akan ditukar status.`} 
        confirmLabel="Sahkan" 
        danger={confirmUser?.status_akaun === 'Aktif'} 
        onCancel={() => setConfirmUser(null)} 
        onConfirm={async () => { 
          await update(confirmUser.id_pengguna, { status_akaun: confirmUser.status_akaun === 'Aktif' ? 'Tidak Aktif' : 'Aktif' }); 
          setConfirmUser(null); 
        }} 
      />
    </div>
  );
}
