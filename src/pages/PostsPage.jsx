import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';
import { notifyError, notifySuccess } from '../utils/helpers';
import { Card, Button, Field, Input } from '../components/ui';

export function PostsPage() {
  const [posts, setPosts] = useState([]);
  const [form, setForm] = useState({ status_pos: 'Aktif' });
  
  const load = useCallback(() => api.get('/posts').then((res) => setPosts(res.data)), []);
  useEffect(() => { load(); }, [load]);
  
  const create = async (e) => { 
    e.preventDefault(); 
    try { 
      await api.post('/posts', form); 
      setForm({ status_pos: 'Aktif' }); 
      notifySuccess('Pos kawalan disimpan'); 
      load(); 
    } catch (error) { 
      notifyError(error, 'Pos kawalan gagal disimpan'); 
    } 
  };
  
  const update = async (id, patch) => { 
    try { 
      await api.patch(`/posts/${id}`, patch); 
      notifySuccess('Pos kawalan dikemas kini'); 
      load(); 
    } catch (error) { 
      notifyError(error, 'Pos kawalan gagal dikemas kini'); 
    } 
  };
  
  return (
    <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
      <Card title="Tambah Pos Kawalan">
        <form onSubmit={create} className="space-y-3">
          <Field label="Nama pos"><Input required value={form.nama_pos || ''} onChange={(e) => setForm({ ...form, nama_pos: e.target.value })} /></Field>
          <Field label="Bangunan"><Input value={form.nama_bangunan || ''} onChange={(e) => setForm({ ...form, nama_bangunan: e.target.value })} /></Field>
          <Field label="Lokasi"><Input value={form.lokasi || ''} onChange={(e) => setForm({ ...form, lokasi: e.target.value })} /></Field>
          <Field label="Waktu operasi"><Input value={form.waktu_operasi || ''} onChange={(e) => setForm({ ...form, waktu_operasi: e.target.value })} /></Field>
          <Button>Simpan pos</Button>
        </form>
      </Card>
      <Card title="Senarai Pos">
        {posts.map((p) => (
          <div key={p.id_pos} className="app-row mb-2 grid gap-2 rounded-md border p-3 text-sm md:grid-cols-[1fr_auto]">
            <span>
              <span className="font-medium text-primary-token">{p.nama_pos}</span>
              <p>{p.nama_bangunan} - {p.lokasi} - {p.waktu_operasi}</p>
            </span>
            <Button variant="ghost" onClick={() => update(p.id_pos, { status_pos: p.status_pos === 'Aktif' ? 'Tidak Aktif' : 'Aktif' })}>{p.status_pos}</Button>
          </div>
        ))}
      </Card>
    </div>
  );
}
