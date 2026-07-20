import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, Eye, X } from 'lucide-react';
import api from '../api/axios';
import { notifyAction, notifyError, notifySuccess } from '../utils/helpers';
import { Card, Button, Badge, EmptyState } from '../components/ui';
import { ReportDetailContent } from '../components/ReportDetailContent';

export function NotificationsPage() {
  const [rows, setRows] = useState([]);
  const [detail, setDetail] = useState(null);
  const navigate = useNavigate();

  const load = useCallback(() => api.get('/notifications').then((res) => setRows(res.data)), []);
  useEffect(() => { load(); }, [load]);

  const markRead = async (id) => { 
    try { 
      await api.patch(`/notifications/${id}/read`); 
      notifySuccess('Notifikasi ditanda dibaca'); 
      load(); 
    } catch (error) { 
      notifyError(error, 'Notifikasi gagal dikemas kini'); 
    } 
  };

  const openReport = async (notification) => {
    try {
      if (notification.status_bacaan !== 'Dibaca') await api.patch(`/notifications/${notification.id_notifikasi}/read`);
      const { data } = await api.get(`/reports/${notification.id_laporan}`);
      setDetail(data);
      notifyAction('Laporan notifikasi dibuka');
      load();
    } catch (error) {
      notifyError(error, 'Laporan notifikasi gagal dibuka');
    }
  };

  const openAction = async (notification) => {
    try {
      if (notification.status_bacaan !== 'Dibaca') await api.patch(`/notifications/${notification.id_notifikasi}/read`);
      navigate('/tindakan');
      load();
    } catch (error) {
      notifyError(error, 'Notifikasi gagal dibuka');
    }
  };

  return (
    <div className="space-y-5">
      <Card title="Notifikasi">
        {rows.length ? rows.map((n) => (
          <div key={n.id_notifikasi} className="app-row mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border p-4 text-sm">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-primary-token">{n.tajuk_notifikasi}</span>
                <Badge tone={n.tahap_keutamaan}>{n.tahap_keutamaan}</Badge>
              </div>
              <p className="mt-1">{n.mesej_notifikasi}</p>
              <p className="text-data">{new Date(n.tarikh_hantar).toLocaleString()} - {n.status_bacaan}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {n.id_laporan && <Button variant="ghost" onClick={() => openReport(n)}><Eye size={16} /> Buka laporan</Button>}
              {n.id_tindakan && <Button variant="ghost" onClick={() => openAction(n)}><ClipboardCheck size={16} /> Buka tindakan</Button>}
              {n.status_bacaan !== 'Dibaca' && <Button variant="ghost" onClick={() => markRead(n.id_notifikasi)}>Tanda dibaca</Button>}
            </div>
          </div>
        )) : <EmptyState title="Tiada notifikasi" description="Notifikasi baharu akan dipaparkan di sini." />}
      </Card>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(0,0,0,0.55)] p-0 sm:items-center sm:p-4">
          <div className="app-elevated motion-sheet max-h-[94vh] w-full overflow-y-auto rounded-t-lg border p-4 shadow-xl sm:max-w-5xl sm:rounded-lg lg:p-6">
            <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-4 flex items-start justify-between gap-3 border-b bg-white px-4 py-4 lg:-mx-6 lg:-mt-6 lg:px-6">
              <div>
                <h2>Laporan Notifikasi #{detail.report.id_laporan}</h2>
                <p className="text-sm">Dibuka terus daripada notifikasi.</p>
              </div>
              <Button variant="ghost" onClick={() => setDetail(null)}><X size={16} /> Tutup</Button>
            </div>
            <ReportDetailContent detail={detail} />
          </div>
        </div>
      )}
    </div>
  );
}
