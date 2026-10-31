import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, ClipboardCheck, Eye } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { ROLE, notifyError, notifySuccess } from '../utils/helpers';
import { PageHeader, Card, Button, Badge, EmptyState, LoadingState, AlertMessage } from '../components/ui';
import { useUnreadNotifications } from '../hooks/useUnreadNotifications';

export function NotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const { user } = useAuth();
  const client = useQueryClient();
  const count = useUnreadNotifications();
  const query = useQuery({ queryKey: ['notifications', 'list', unreadOnly, page], queryFn: async ({ signal }) => (await api.get('/notifications', { signal, params: { page, unread: String(unreadOnly) } })).data, refetchInterval: 30000, refetchOnWindowFocus: true });
  const rows = Array.isArray(query.data) ? query.data : [];
  const refresh = () => Promise.all([client.invalidateQueries({ queryKey: ['notifications'] }), client.invalidateQueries({ queryKey: ['dashboard'] })]);
  const mutation = useMutation({
    mutationFn: async ({ item, all, target }) => {
      if (all) await api.patch('/notifications/read-all');
      else if (item.status_bacaan !== 'Dibaca') await api.patch(`/notifications/${item.id_notifikasi}/read`);
      return { all, target };
    },
    onSuccess: ({ all, target }) => {
      if (all) { setPage(1); notifySuccess('Semua notifikasi ditanda dibaca'); }
      refresh();
      if (target) navigate(target);
    },
    onError: error => notifyError(error, 'Notifikasi gagal dikemas kini'),
  });
  const reportPath = id => `${user?.nama_peranan === ROLE.guard ? '/laporan' : '/semakan'}?report=${id}`;
  return <div className="desktop-ops space-y-5">
    <PageHeader title="Notifikasi" description="Makluman laporan dan tindakan yang memerlukan perhatian anda. Dikemas kini secara automatik setiap 30 saat." action={<Button variant="ghost" disabled={mutation.isPending || !count.data?.unread} onClick={() => mutation.mutate({ all: true })}><CheckCheck size={17} />Tanda semua dibaca</Button>} />
    <Card>
      <div className="workspace-tabs" aria-label="Paparan notifikasi"><button aria-pressed={!unreadOnly} onClick={() => {setUnreadOnly(false);setPage(1);}}>Semua</button><button aria-pressed={unreadOnly} onClick={() => {setUnreadOnly(true);setPage(1);}}>Belum dibaca{count.data?.unread > 0 ? ` (${count.data.unread})` : ''}</button></div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="workspace-note">Halaman {page} · {rows.length} makluman</p><Button variant="ghost" disabled={query.isFetching} onClick={() => { query.refetch();count.refetch(); }}>Muat semula</Button></div>
      {query.isPending ? <LoadingState message="Memuatkan notifikasi..." /> : query.isError ? <AlertMessage>Notifikasi belum dapat dimuatkan. <button className="underline" onClick={() => query.refetch()}>Cuba lagi</button></AlertMessage> : rows.length ? rows.map(n => <article key={n.id_notifikasi} className={`workspace-record ${n.status_bacaan !== 'Dibaca' ? 'workspace-notification-unread' : ''}`}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><h3 className="flex items-center gap-2">{n.status_bacaan !== 'Dibaca' && <Bell size={15} aria-label="Belum dibaca" />}{n.tajuk_notifikasi}</h3><p className="mt-2 text-sm">{n.mesej_notifikasi}</p><p className="text-data mt-2">{new Date(n.tarikh_hantar).toLocaleString('ms-MY', {timeZone:'Asia/Kuala_Lumpur'})} · {n.status_bacaan}</p></div><Badge tone={n.tahap_keutamaan}>{n.tahap_keutamaan}</Badge></div>
        <div className="mt-4 flex flex-wrap gap-2">
          {n.id_laporan && <Button variant="ghost" disabled={mutation.isPending} onClick={() => mutation.mutate({item:n,target:reportPath(n.id_laporan)})}><Eye size={16} />Buka laporan</Button>}
          {n.id_tindakan && user?.nama_peranan !== ROLE.guard && <Button variant="ghost" disabled={mutation.isPending} onClick={() => mutation.mutate({item:n,target:'/tindakan'})}><ClipboardCheck size={16} />Buka tindakan</Button>}
          {n.status_bacaan !== 'Dibaca' && <Button variant="ghost" disabled={mutation.isPending} onClick={() => mutation.mutate({item:n})}>Tanda dibaca</Button>}
        </div>
      </article>) : <EmptyState title={unreadOnly ? 'Semua telah dibaca' : 'Tiada notifikasi'} description={unreadOnly ? 'Tiada notifikasi belum dibaca pada halaman ini.' : 'Makluman baharu akan dipaparkan di sini.'} />}
      <div className="mt-5 flex justify-between gap-3"><Button variant="ghost" disabled={page === 1 || query.isFetching} onClick={() => setPage(page-1)}>Sebelumnya</Button><Button variant="ghost" disabled={rows.length < 50 || query.isFetching || query.isError} onClick={() => setPage(page+1)}>Seterusnya</Button></div>
    </Card>
  </div>;
}
