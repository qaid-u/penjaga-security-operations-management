import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/axios';
import { use3DMapping } from './use3DOperations';
import { apiMessage } from './operationalIndicators';
import { Button, Select } from '../ui';
import { buildingHotspots, matchingOfficialPost } from './buildingHotspots';
function MappingRow({ location, posts }) {
  const [post, setPost] = useState(location.id_pos ? String(location.id_pos) : '');
  const mutation = use3DMapping();
  const eligible = posts.filter((post) => matchingOfficialPost(post, location.hotspot_id));
  return <div className="rounded-lg border p-3 space-y-2"><p className="font-medium">{location.nama_paparan}</p>
    <div className="flex flex-col gap-2 sm:flex-row"><Select aria-label={`Pautan ${location.nama_paparan}`} value={post} onChange={(e) => setPost(e.target.value)}><option value="">Tiada pautan</option>{eligible.map((p) => <option key={p.id_pos} value={p.id_pos} disabled={p.status_pos !== 'Aktif'}>{p.nama_pos} ({p.status_pos})</option>)}</Select><Button disabled={mutation.isPending} onClick={() => mutation.mutate({ id: location.id_lokasi, post: post ? Number(post) : null })}>{mutation.isPending ? 'Menyimpan...' : 'Simpan pautan'}</Button></div>
    {!eligible.length && <p className="text-xs">Rekod pos sepadan belum tersedia. Semak migrasi pos rasmi atau rekod bangunan.</p>}
    {mutation.isError && <p role="alert">{apiMessage(mutation.error)}</p>}{mutation.isSuccess && <p role="status">Pautan disimpan dan direkodkan dalam audit.</p>}
  </div>;
}
export function LocationMappingPanel({ locations, userId }) {
  const [open, setOpen] = useState(false);
  const posts = useQuery({ queryKey: ['threeD', userId, 'mapping-posts'], enabled: open, queryFn: ({ signal }) => api.get('/posts', { signal }).then((r) => r.data), staleTime: 30000 });
  return <details className="app-surface rounded-xl border p-4" onToggle={(e) => setOpen(e.currentTarget.open)}><summary className="cursor-pointer font-medium">Pemetaan lokasi — Pentadbir Sistem</summary><p className="my-3 text-sm">Pautan rekod operasi kepada tujuh pos rasmi bangunan ini. Pilihan dihadkan kepada nama pos dan bangunan yang sepadan. Pautan rekod tidak mengesahkan kedudukan 3D.</p>
    {posts.isPending && open && <p role="status">Memuatkan pos...</p>}{posts.isError && <><p role="alert">{apiMessage(posts.error)}</p><Button onClick={() => posts.refetch()}>Cuba semula senarai pos</Button></>}
    {posts.data && <div className="grid gap-3 lg:grid-cols-2">{buildingHotspots.map((hotspot) => { const location = locations?.find((l) => l.hotspot_id === hotspot.id); return location ? <MappingRow key={`${location.id_lokasi}-${location.id_pos}`} location={location} posts={posts.data} /> : <p key={hotspot.id}>{hotspot.name}: konfigurasi belum tersedia. Semak migrasi / sambungan.</p>; })}</div>}
  </details>;
}
