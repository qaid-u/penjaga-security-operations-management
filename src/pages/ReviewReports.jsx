import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Eye, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';
import { ROLE, downloadCsv, notifyAction, notifyError, notifySuccess, statusTone } from '../utils/helpers';
import { Card, Button, AlertMessage, Select, Input, Badge, EmptyState, AttachmentLinks, ConfirmModal, Pagination, LoadingState } from '../components/ui';
import { ReportDetailContent } from '../components/ReportDetailContent';

export function ReviewReports({ auth }) {
  const canReviewReports = auth.user?.nama_peranan === ROLE.chief;
  const [comments, setComments] = useState({});
  const [followUpFlags, setFollowUpFlags] = useState({});
  const [pinnedReports, setPinnedReports] = useState([]);
  const [detail, setDetail] = useState(null);
  const [confirmReview, setConfirmReview] = useState(null);
  const [reviewFilters, setReviewFilters] = useState({ status: 'Dihantar', search: '', post: '', shift: '', risk: '', date: '' });
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['reports', { page }],
    queryFn: async () => {
      const res = await api.get('/reports', { params: { page, limit: 50 } });
      return res.data;
    },
    placeholderData: (prev) => prev,
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, comment, requiresFollowUp }) => {
      return api.patch(`/reports/${id}/review`, { status, comment, requiresFollowUp });
    },
    onSuccess: (res, variables) => {
      setComments((prev) => ({ ...prev, [variables.id]: '' }));
      setFollowUpFlags((prev) => ({ ...prev, [variables.id]: false }));
      setConfirmReview(null);
      notifySuccess(variables.status === 'approved' ? 'Laporan diluluskan' : 'Laporan ditolak');
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      if (detail?.report?.id_laporan === variables.id) loadDetail(variables.id);
    },
    onError: (error) => notifyError(error, 'Semakan laporan gagal'),
  });

  const reports = data?.data || [];
  const totalPages = data?.meta?.totalPages || 1;

  const postOptions = [...new Set(reports.map((report) => report.nama_pos).filter(Boolean))].sort();

  const visibleReports = reports.filter((report) => {
    const search = reviewFilters.search.trim().toLowerCase();
    const matchesSearch = !search || [report.tajuk_laporan, report.nama_penuh, report.nama_pos, report.kandungan_laporan].some((value) => String(value || '').toLowerCase().includes(search));
    const matchesStatus = reviewFilters.status === 'Semua' || report.status_laporan === reviewFilters.status;
    const matchesPost = !reviewFilters.post || report.nama_pos === reviewFilters.post;
    const matchesShift = !reviewFilters.shift || report.syif === reviewFilters.shift;
    const matchesRisk = !reviewFilters.risk || report.tahap_risiko === reviewFilters.risk;
    const matchesDate = !reviewFilters.date || report.tarikh_laporan?.slice(0, 10) === reviewFilters.date;
    return matchesSearch && matchesStatus && matchesPost && matchesShift && matchesRisk && matchesDate;
  }).sort((a, b) => Number(pinnedReports.includes(b.id_laporan)) - Number(pinnedReports.includes(a.id_laporan)));

  const loadDetail = async (id) => {
    try {
      const { data } = await api.get(`/reports/${id}`);
      setDetail(data);
      notifyAction('Detail laporan dibuka');
    } catch (error) {
      notifyError(error, 'Detail laporan gagal dibuka');
    }
  };

  const review = (id, status) => {
    if (status === 'approved' && typeof followUpFlags[id] !== 'boolean') {
      notifyError({ message: 'Sila tentukan sama ada laporan ini memerlukan tindakan susulan atau tidak.' });
      return;
    }
    reviewMutation.mutate({ id, status, comment: comments[id] || '', requiresFollowUp: Boolean(followUpFlags[id]) });
  };

  return (
    <div className="desktop-ops">
      <Card title={canReviewReports ? 'Semakan Laporan' : 'Pemantauan Laporan'} action={<Button variant="ghost" onClick={() => downloadCsv('/reports/export.csv', 'laporan-harian.csv')}><Download size={16} /> CSV</Button>}>
        {!canReviewReports && <AlertMessage type="success">Admin boleh membaca dan memantau laporan, tetapi kelulusan atau penolakan laporan hanya dibuat oleh Ketua Pengawal.</AlertMessage>}
        <div className="mb-4 grid gap-2 sm:grid-cols-4 xl:max-w-3xl">
          {['Dihantar', 'Diluluskan', 'Ditolak', 'Semua'].map((status) => <Button key={status} variant={reviewFilters.status === status ? 'primary' : 'ghost'} onClick={() => setReviewFilters({ ...reviewFilters, status })}>{status}</Button>)}
        </div>
        <div className="mb-4 grid gap-2 md:grid-cols-3 xl:grid-cols-[minmax(260px,1fr)_220px_140px_150px_160px]">
          <Input placeholder="Cari tajuk, pengawal, pos" value={reviewFilters.search} onChange={(e) => setReviewFilters({ ...reviewFilters, search: e.target.value })} className="xl:col-span-1" />
          <Select value={reviewFilters.post} onChange={(e) => setReviewFilters({ ...reviewFilters, post: e.target.value })}><option value="">Semua pos</option>{postOptions.map((post) => <option key={post}>{post}</option>)}</Select>
          <Select value={reviewFilters.shift} onChange={(e) => setReviewFilters({ ...reviewFilters, shift: e.target.value })}><option value="">Semua syif</option><option>Pagi</option><option>Petang</option><option>Malam</option></Select>
          <Select value={reviewFilters.risk} onChange={(e) => setReviewFilters({ ...reviewFilters, risk: e.target.value })}><option value="">Semua risiko</option><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></Select>
          <Input type="date" value={reviewFilters.date} onChange={(e) => setReviewFilters({ ...reviewFilters, date: e.target.value })} />
        </div>
        
        {isLoading ? (
          <LoadingState message="Memuatkan laporan..." />
        ) : (
          <>
            <p className="mb-3 text-sm text-secondary-token">Menunjukkan muka surat {page} ({visibleReports.length} daripada {reports.length} rekod dijumpai).</p>
            {visibleReports.length ? visibleReports.map((r) => (
              <article key={r.id_laporan} className={`desktop-record mb-3 rounded-md border p-4 ${['High', 'Critical'].includes(r.tahap_risiko) ? 'app-row-alert' : 'app-row'}`}>
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <h3>{r.tajuk_laporan}</h3>
                    <p className="text-data">{r.nama_penuh} - {r.nama_pos} - {r.tarikh_laporan?.slice(0, 10)} {r.masa_laporan}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {pinnedReports.includes(r.id_laporan) && <Badge>Dipin</Badge>}
                    <Badge tone={statusTone(r.status_laporan)}>{r.status_laporan}</Badge>
                    <Badge tone={r.tahap_risiko}>{r.tahap_risiko}</Badge>
                  </div>
                </div>
                <p className="desktop-clamp mt-2 text-sm">{r.kandungan_laporan}</p>
                <p className="mt-2 text-sm"><span className="font-medium text-primary-token">Risiko ringkas:</span> <Badge tone={r.tahap_risiko}>{r.tahap_risiko}</Badge></p>
                {r.status_laporan === 'Diluluskan' && r.perlu_tindakan_susulan && !r.ada_tindakan_susulan && <AlertMessage>Laporan ini sudah diluluskan dan ditanda memerlukan tindakan susulan.</AlertMessage>}
                <AttachmentLinks value={r.lampiran_fail} label="Lampiran bukti" />
                <div className="mt-3 grid gap-2 sm:grid-cols-[auto_auto_1fr_auto_auto]">
                  <Button variant="ghost" onClick={() => setPinnedReports((current) => current.includes(r.id_laporan) ? current.filter((id) => id !== r.id_laporan) : [...current, r.id_laporan])}>{pinnedReports.includes(r.id_laporan) ? 'Nyahpin' : 'Pin'}</Button>
                  <Button variant="ghost" onClick={() => loadDetail(r.id_laporan)}><Eye size={16} /> Detail</Button>
                  {canReviewReports && <Input placeholder="Catatan semakan" value={comments[r.id_laporan] || ''} onChange={(e) => setComments({ ...comments, [r.id_laporan]: e.target.value })} />}
                  {canReviewReports && r.status_laporan === 'Dihantar' && <Button disabled={reviewMutation.isLoading} onClick={() => {
                    if (typeof followUpFlags[r.id_laporan] !== 'boolean') return notifyError({ message: 'Sila tentukan sama ada laporan ini memerlukan tindakan susulan atau tidak.' });
                    return setConfirmReview({ id: r.id_laporan, status: 'approved', title: r.tajuk_laporan });
                  }}>Lulus</Button>}
                  {canReviewReports && r.status_laporan === 'Dihantar' && <Button disabled={reviewMutation.isLoading} variant="danger" onClick={() => setConfirmReview({ id: r.id_laporan, status: 'rejected', title: r.tajuk_laporan })}>Tolak</Button>}
                  {r.status_laporan === 'Diluluskan' && r.perlu_tindakan_susulan && <Button onClick={() => navigate('/tindakan')}>Tindakan</Button>}
                </div>
                {canReviewReports && r.status_laporan === 'Dihantar' && (
                  <div className="mt-3 rounded-lg border bg-white p-3 text-sm">
                    <p className="font-medium text-primary-token">Keputusan Ketua untuk tindakan susulan</p>
                    <p className="mt-1 text-secondary-token">Pilih satu sebelum meluluskan laporan. Jika perlu tindakan susulan, laporan akan dihantar ke Admin.</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <Button type="button" variant={followUpFlags[r.id_laporan] === false ? 'primary' : 'ghost'} onClick={() => setFollowUpFlags({ ...followUpFlags, [r.id_laporan]: false })}>Tidak perlu tindakan susulan</Button>
                      <Button type="button" variant={followUpFlags[r.id_laporan] === true ? 'primary' : 'ghost'} onClick={() => setFollowUpFlags({ ...followUpFlags, [r.id_laporan]: true })}>Perlu tindakan susulan</Button>
                    </div>
                  </div>
                )}
              </article>
            )) : <EmptyState title="Tiada laporan" description="Tiada laporan untuk status yang dipilih." />}
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </Card>
      {detail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(0,0,0,0.55)] p-0 sm:items-center sm:p-4">
          <div className="app-elevated motion-sheet max-h-[94vh] w-full overflow-y-auto rounded-t-lg border p-4 shadow-xl sm:max-w-5xl sm:rounded-lg lg:p-6">
            <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-4 flex items-start justify-between gap-3 border-b bg-white px-4 py-4 lg:-mx-6 lg:-mt-6 lg:px-6">
              <div>
                <h2>Dokumen Laporan #{detail.report.id_laporan}</h2>
                <p className="text-sm">Paparan lengkap laporan harian untuk semakan Ketua dan pemantauan Admin.</p>
              </div>
              <Button variant="ghost" onClick={() => setDetail(null)}><X size={16} /> Tutup</Button>
            </div>
            <ReportDetailContent detail={detail} />
          </div>
        </div>
      )}
      <ConfirmModal
        open={!!confirmReview}
        title={confirmReview?.status === 'approved' ? 'Luluskan laporan?' : 'Tolak laporan?'}
        message={`Sahkan tindakan untuk laporan "${confirmReview?.title || ''}".`}
        confirmLabel={confirmReview?.status === 'approved' ? 'Luluskan' : 'Tolak'}
        danger={confirmReview?.status === 'rejected'}
        onCancel={() => setConfirmReview(null)}
        onConfirm={() => review(confirmReview.id, confirmReview.status)}
      />
    </div>
  );
}
