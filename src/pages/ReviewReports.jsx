import { ExportButton } from '../components/ExportButton';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, X, Pin, RefreshCw, Filter } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';
import { ROLE, notifyAction, notifyError, notifySuccess, statusTone } from '../utils/helpers';
import { PageHeader, Field, Card, Button, AlertMessage, Select, Input, Badge, EmptyState, ConfirmModal, Pagination, LoadingState } from '../components/ui';
import { ReportDetailContent } from '../components/ReportDetailContent';

export function ReviewReports({ auth }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const canReviewReports = auth.user?.nama_peranan === ROLE.chief;
  const [comments, setComments] = useState({});
  const [followUpFlags, setFollowUpFlags] = useState({});
  const [pinnedReports, setPinnedReports] = useState([]);
  const [detail, setDetail] = useState(null);
  const [confirmReview, setConfirmReview] = useState(null);
  const [reviewFilters, setReviewFilters] = useState(()=>({ status: searchParams.get('status') || (searchParams.get('post') ? 'Semua' : 'Dihantar'), search: '', post: /^[1-9]\d*$/.test(searchParams.get('post')||'')?searchParams.get('post'):'', shift: '', risk: searchParams.get('risk')||'', date: '', from: searchParams.get('from')||'', to: searchParams.get('to')||'' }));
  const [page, setPage] = useState(1);
  const requestedReport = searchParams.get('report');
  const [attentionOnly, setAttentionOnly] = useState(false);
  const detailSequence = useRef(0);
  const detailDialog = useRef(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const filterParams = { ...reviewFilters, attention: String(attentionOnly) };
  const changeFilters = (next) => { setReviewFilters(next); setPage(1); };

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['reports', { page, ...filterParams }],
    queryFn: async () => {
      const res = await api.get('/reports', { params: { page, limit: 8, ...filterParams } });
      return res.data;
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, comment, requiresFollowUp }) => {
      return api.patch(`/reports/${id}/review`, { status, comment, requiresFollowUp });
    },
    onSuccess: (res, variables) => {
      setComments((prev) => ({ ...prev, [variables.id]: '' }));
      setFollowUpFlags((prev) => ({ ...prev, [variables.id]: false }));
      setConfirmReview(null);
      setPage(1);
      notifySuccess(variables.status === 'approved' ? 'Laporan diluluskan' : 'Laporan ditolak');
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      if (detail?.report?.id_laporan === variables.id) loadDetail(variables.id);
    },
    onError: (error) => notifyError(error, 'Semakan laporan gagal'),
  });

  const reports = data?.data || [];
  const totalPages = data?.meta?.totalPages || 1;

  const postOptions = data?.filters?.posts || [];
  const visibleReports = [...reports].sort((a, b) => Number(pinnedReports.includes(b.id_laporan)) - Number(pinnedReports.includes(a.id_laporan)));

  const loadDetail = useCallback(async (id) => {
    const sequence = ++detailSequence.current;
    try {
      const { data } = await api.get(`/reports/${id}`);
      if (sequence !== detailSequence.current) return;
      setDetail(data);
      notifyAction('Detail laporan dibuka');
    } catch (error) {
      if (sequence === detailSequence.current) notifyError(error, 'Detail laporan gagal dibuka');
    }
  }, []);

  const closeDetail = useCallback(() => { detailSequence.current += 1; setDetail(null); setSearchParams((current) => { const next = new URLSearchParams(current); next.delete('report'); return next; }); }, [setSearchParams]);
  useEffect(() => {
    if (/^[1-9]\d*$/.test(requestedReport || '')) loadDetail(Number(requestedReport));
  }, [requestedReport, loadDetail]);

  const detailOpen = Boolean(detail);
  useEffect(() => {
    if (!detailOpen) return undefined;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    detailDialog.current?.querySelector('button')?.focus();
    const onKey = event => {
      if ([...document.querySelectorAll('[role="dialog"]')].at(-1) !== detailDialog.current) return;
      if (event.key === 'Escape') closeDetail();
      if (event.key !== 'Tab') return;
      const nodes = [...detailDialog.current.querySelectorAll('a[href],button:not(:disabled),input:not(:disabled),select,textarea,summary')].filter(node => node.getClientRects().length);
      const first = nodes[0], last = nodes.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; previous?.focus?.(); };
  }, [detailOpen, closeDetail]);

  const review = (id, status) => {
    if (status === 'approved' && typeof followUpFlags[id] !== 'boolean') {
      notifyError({ message: 'Sila tentukan sama ada laporan ini memerlukan tindakan susulan atau tidak.' });
      return;
    }
    reviewMutation.mutate({ id, status, comment: comments[id] || '', requiresFollowUp: Boolean(followUpFlags[id]) });
  };

  return (
    <div className="desktop-ops">
      <PageHeader title={canReviewReports ? 'Semakan laporan' : 'Pemantauan laporan'} description={canReviewReports ? 'Pilih laporan untuk membaca butiran dan membuat keputusan.' : 'Pantau laporan dan analisis risiko. Kelulusan dibuat oleh Ketua Pengawal.'} action={<ExportButton endpoint="/reports/export.csv" filename="laporan-harian.csv" filters={filterParams}/>} />
      <Card>
        {isError && <AlertMessage>Senarai laporan belum dapat dimuatkan. <button type="button" className="underline" onClick={() => refetch()}>Cuba sekali lagi</button></AlertMessage>}
        <div className="workspace-tabs" aria-label="Status laporan">
          {['Dihantar', 'Diluluskan', 'Ditolak', 'Semua'].map((status) => <button key={status} aria-pressed={reviewFilters.status === status} onClick={() => changeFilters({ ...reviewFilters, status })}>{status === 'Dihantar' ? 'Menunggu' : status}</button>)}
        </div>
        {reviewFilters.from && <p className="workspace-note mb-3">Tempoh analisis: {reviewFilters.from} hingga {reviewFilters.to} <button className="underline ml-2" onClick={()=>changeFilters({...reviewFilters,from:'',to:''})}>Kosongkan tempoh</button></p>}
        <div className="workspace-filter-search">
          <Input aria-label="Cari laporan" placeholder="Cari tajuk, pengawal, pos" value={reviewFilters.search} onChange={(e) => changeFilters({ ...reviewFilters, search: e.target.value })} />
          <Button type="button" variant="ghost" disabled={isFetching} onClick={() => refetch()}><RefreshCw size={16} className={isFetching?'ops-spin':''}/><span className="ops-refresh-label">{isFetching ? 'Memuatkan...' : 'Muat semula'}</span></Button>
        </div>
        <details className="workspace-disclosure mb-5">
          <summary><Filter size={15} className="inline mr-2"/>Penapis tambahan <span className="workspace-filter-count">{[reviewFilters.post,reviewFilters.shift,reviewFilters.risk,reviewFilters.date,attentionOnly].filter(Boolean).length || 'Tiada'} aktif</span></summary>
          <div className="workspace-filter-options">
            <Field label="Pos kawalan"><Select value={reviewFilters.post} onChange={(e) => changeFilters({ ...reviewFilters, post: e.target.value })}><option value="">Semua pos</option>{postOptions.map((post) => <option key={post.id_pos} value={post.id_pos}>{post.nama_pos}</option>)}</Select></Field>
            <Field label="Syif"><Select value={reviewFilters.shift} onChange={(e) => changeFilters({ ...reviewFilters, shift: e.target.value })}><option value="">Semua syif</option><option>Pagi</option><option>Petang</option><option>Malam</option><option>Office Hour</option></Select></Field>
            <Field label="Tahap risiko"><Select value={reviewFilters.risk} onChange={(e) => changeFilters({ ...reviewFilters, risk: e.target.value })}><option value="">Semua risiko</option><option>Low</option><option>Medium</option><option>High</option><option>Critical</option><option value="HighCritical">High / Critical</option></Select></Field>
            <Field label="Tarikh laporan"><Input type="date" value={reviewFilters.date} onChange={(e) => changeFilters({ ...reviewFilters, date: e.target.value,from:'',to:'' })} /></Field>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-primary-token"><input type="checkbox" checked={attentionOnly} onChange={(event) => { setAttentionOnly(event.target.checked); setPage(1); }} className="h-4 w-4 accent-[var(--color-brand-navy)]" /> Perlu perhatian analisis sahaja</label>
          <Button variant="ghost" onClick={() => { changeFilters({ ...reviewFilters, post: '', shift: '', risk: '', date: '' }); setAttentionOnly(false); }}>Kosongkan penapis tambahan</Button>
          </div>
        </details>
        {isLoading ? (
          <LoadingState message="Memuatkan laporan..." />
        ) : (
          <>
            <p className="mb-3 text-sm text-secondary-token">{data?.meta?.total ?? reports.length} laporan · Halaman {page} daripada {totalPages}</p>
            {visibleReports.length ? visibleReports.map((r) => (
              <article key={r.id_laporan} className="workspace-record">
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
                <div className="mt-3 flex flex-wrap gap-2">
                  {['pending', 'processing'].includes(r.analysis_status) && <Badge>Sedang dianalisis</Badge>}
                  {r.analysis_status === 'failed' && <Badge>Analisis belum selesai</Badge>}
                  {r.nlp_review_status === 'needs_review' && <Badge tone="Medium">Perlu semakan AI</Badge>}
                  {r.nlp_metadata?.sourceChecks?.status === 'needs_review' && <Badge tone="Medium">Perhatian semakan teks</Badge>}
                </div>
                {r.status_laporan === 'Diluluskan' && r.perlu_tindakan_susulan && !r.ada_tindakan_susulan && <p className="mt-3 workspace-note">Memerlukan tindakan susulan Admin.</p>}
                <div className="workspace-record-actions">
                  <Button variant="ghost" onClick={() => setSearchParams(current=>{const next=new URLSearchParams(current);next.set('report',r.id_laporan);return next;})}><Eye size={16} /> Detail</Button>
                  <button className="workspace-text-link min-h-11 px-3" onClick={() => setPinnedReports(current => current.includes(r.id_laporan) ? current.filter(id => id !== r.id_laporan) : [...current, r.id_laporan])}><Pin size={15} className="inline mr-1"/>{pinnedReports.includes(r.id_laporan) ? 'Nyahpin' : 'Pin'}</button>
                  {r.status_laporan === 'Diluluskan' && r.perlu_tindakan_susulan && <Button variant="ghost" onClick={() => navigate('/tindakan')}>Tindakan</Button>}
                </div>
              </article>
            )) : <EmptyState title="Tiada laporan" description="Tiada laporan untuk status yang dipilih." />}
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </Card>
      {detail && (
        <div ref={detailDialog} role="dialog" aria-modal="true" aria-labelledby="report-review-title" className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(0,0,0,0.55)] p-0 sm:items-center sm:p-4">
          <div className="app-elevated motion-sheet max-h-[94vh] w-full overflow-y-auto rounded-t-lg border p-4 shadow-xl sm:max-w-5xl sm:rounded-lg lg:p-6">
            <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-4 flex items-start justify-between gap-3 border-b bg-white px-4 py-4 lg:-mx-6 lg:-mt-6 lg:px-6">
              <div>
                <h2 id="report-review-title">Dokumen Laporan #{detail.report.id_laporan}</h2>
                <p className="text-sm">Paparan lengkap laporan harian untuk semakan Ketua dan pemantauan Admin.</p>
              </div>
              <Button variant="ghost" onClick={closeDetail}><X size={16} /> Tutup</Button>
            </div>
            <ReportDetailContent detail={detail} canGiveNlpFeedback />
            {canReviewReports && detail.report.status_laporan === 'Dihantar' && <section className="workspace-review-decision" aria-label="Keputusan semakan">
              <h3>Keputusan Ketua Pengawal</h3>
              <Field label="Catatan semakan"><Input value={comments[detail.report.id_laporan] || ''} onChange={e => setComments({ ...comments, [detail.report.id_laporan]: e.target.value })} /></Field>
              <fieldset className="mt-4"><legend className="text-sm font-medium">Adakah tindakan susulan diperlukan?</legend>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">{[[false, 'Tidak perlu tindakan susulan'], [true, 'Perlu tindakan susulan']].map(([value, label]) => <label key={String(value)} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"><input type="radio" name="follow-up-decision" checked={followUpFlags[detail.report.id_laporan] === value} onChange={() => setFollowUpFlags({ ...followUpFlags, [detail.report.id_laporan]: value })} />{label}</label>)}</div>
              </fieldset>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button disabled={reviewMutation.isPending} onClick={() => {
                  if (typeof followUpFlags[detail.report.id_laporan] !== 'boolean') return notifyError({ message: 'Sila tentukan sama ada laporan ini memerlukan tindakan susulan atau tidak.' });
                  setConfirmReview({ id: detail.report.id_laporan, status: 'approved', title: detail.report.tajuk_laporan });
                }}>Lulus</Button>
                <Button variant="danger" disabled={reviewMutation.isPending} onClick={() => setConfirmReview({ id: detail.report.id_laporan, status: 'rejected', title: detail.report.tajuk_laporan })}>Tolak</Button>
              </div>
            </section>}
          </div>
        </div>
      )}
      <ConfirmModal
        open={!!confirmReview}
        pending={reviewMutation.isPending}
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
