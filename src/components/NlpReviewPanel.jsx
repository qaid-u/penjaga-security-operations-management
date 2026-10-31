import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Clock3, ExternalLink, FileSearch, RefreshCw, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { Badge, Button } from './ui';
import { NlpEventList } from './NlpEventList';
import './nlp.css';

const eventLabels = { reported: 'Kejadian dilaporkan', suspected: 'Kejadian disyaki', negated: 'Kejadian dinafikan dalam teks', drill: 'Latihan / simulasi', unclear: 'Konteks belum jelas' };
const readMetadata = (value) => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return {}; }
};
const textOf = (value) => typeof value === 'string' ? value : value?.text || value?.quote || value?.value || value?.name || value?.label || '';
const reviewState = (status) => status === 'consistent' ? { title: 'Tiada percanggahan dikesan', Icon: CheckCircle2, tone: 'clear' }
  : status === 'needs_review' ? { title: 'Perlu semakan', Icon: AlertCircle, tone: 'attention' }
    : ['pending', 'processing'].includes(status) ? { title: 'Semakan AI sedang diproses', Icon: Clock3, tone: 'neutral' }
    : { title: 'Semakan AI belum tersedia', Icon: Clock3, tone: 'neutral' };

export function NlpReviewPanel({ report = {}, analysis: initialAnalysis, job: initialJob, review: initialReview, autoRefresh = true, showRelated = true, reportRoute = '/semakan', canGiveFeedback = false }) {
  const reportId = report.id_laporan || initialAnalysis?.id_laporan;
  const pollingStarted = useRef(0);
  const publishedAnalysis = useRef('');
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState(null);
  const [feedbackComment, setFeedbackComment] = useState('');
  useEffect(() => { pollingStarted.current = Date.now(); }, [reportId]);
  const analysisQuery = useQuery({
    queryKey: ['reportAnalysis', reportId],
    queryFn: async () => (await api.get(`/reports/${reportId}/analysis`)).data,
    enabled: Boolean(reportId) && autoRefresh,
    retry: false,
    refetchInterval: (query) => (['pending', 'processing'].includes(query.state.data?.job?.status) || ['pending', 'processing'].includes(query.state.data?.analysis?.metadata?.review?.status)) && Date.now() - pollingStarted.current < 90000 ? 2500 : false,
  });
  const relatedQuery = useQuery({
    queryKey: ['relatedReports', reportId],
    queryFn: async () => (await api.get(`/reports/${reportId}/similar`)).data,
    enabled: Boolean(reportId) && showRelated,
    retry: false,
    staleTime: 30000,
  });
  const analysis = analysisQuery.data?.analysis || initialAnalysis || (report.kategori_dikesan ? report : null);
  const feedbackMutation = useMutation({
    mutationFn: async ({ id, decision, comment }) => (await api.post(`/reports/${reportId}/analysis-feedback`, { id_nlp: id, decision, ...(comment ? { comment } : {}) })).data,
    onSuccess: (_data, variables) => setFeedback({ id: variables.id, decision: variables.decision, saved: true }),
  });
  const job = analysisQuery.data?.job || initialJob;
  const analysisId = analysis?.id_nlp;
  const jobStatus = job?.status;
  useEffect(() => {
    const identity = `${reportId}:${analysisId}`;
    if (!analysisId || ['pending', 'processing'].includes(jobStatus) || publishedAnalysis.current === identity) return;
    publishedAnalysis.current = identity;
    queryClient.invalidateQueries({ queryKey: ['myReports'] });
    queryClient.invalidateQueries({ queryKey: ['reports'] });
  }, [analysisId, jobStatus, reportId, queryClient]);
  const metadata = readMetadata(analysis?.metadata || report.nlp_metadata);
  const review = initialReview || metadata.review || {};
  const sourceChecks = metadata.sourceChecks || {};
  const state = reviewState(review.status);
  const category = analysis?.kategori_dikesan || analysis?.topCategory;
  const risk = analysis?.tahap_risiko || analysis?.riskLevel;
  const score = analysis?.skor_risiko ?? analysis?.riskScore;
  const summary = metadata.summary || analysis?.ringkasan_automatik || analysis?.summary;
  const event = metadata.eventStatus || analysis?.eventStatus;
  const extraction = metadata.extraction || {};
  const findings = Array.isArray(review.findings) ? review.findings : [];
  const pending = ['pending', 'processing'].includes(job?.status);
  const sourceText = report.kandungan_laporan || analysis?.kandungan_laporan || '';
  const quoteInSource = (quote) => typeof quote === 'string' && quote.length > 0 && sourceText.includes(quote);
  const facts = [
    { label: 'Masa dalam laporan', items: extraction.times },
    { label: 'Lokasi dalam laporan', items: extraction.locations },
    { label: 'Aset disebut', items: extraction.assets },
    { label: 'Tindakan dilaporkan', items: extraction.actions },
  ].map(({ label, items }) => ({ label, values: (items || []).map(textOf).filter(Boolean) })).filter((item) => item.values.length);
  const related = Array.isArray(relatedQuery.data?.items) ? relatedQuery.data.items : [];

  return <section className="nlp-review-panel" aria-label="Ringkasan dan semakan automatik">
    <header className="nlp-review-heading">
      <div><p className="label-caps">Pembantu operasi</p><h3>Ringkasan & semakan automatik</h3></div>
      {risk && <Badge tone={risk}>{risk}</Badge>}
    </header>
    {pending && <div className="nlp-processing" role="status"><Clock3 size={18} aria-hidden="true" /><div><strong>Sedang dianalisis</strong><p>Laporan telah disimpan. Maklumat akan dikemas kini secara automatik.</p></div></div>}
    {job?.status === 'failed' && <div className="nlp-processing nlp-processing-warning" role="status"><AlertCircle size={18} aria-hidden="true" /><div><strong>Analisis belum selesai</strong><p>Laporan asal kekal disimpan. Cuba muat semula atau maklumkan pentadbir.</p></div></div>}
    {analysis ? <>
      {summary && <p className="nlp-summary">{summary}</p>}
      <NlpEventList events={metadata.dialogue?.events || metadata.events || analysis.dialogue?.events || analysis.events} dialogue={metadata.dialogue || analysis.dialogue} sourceText={sourceText} reportId={reportId} />
      {(metadata.eventsTruncated || analysis.eventsTruncated) && <p className="nlp-helper-hint" role="status">Sebahagian kejadian sahaja dianalisis. Semak keseluruhan laporan asal.</p>}
      <dl className="nlp-analysis-facts">
        <div><dt>Cadangan jenis laporan</dt><dd>{category || 'Belum dikenal pasti'}</dd></div>
        <div><dt>Konteks laporan</dt><dd>{eventLabels[event] || 'Belum dinyatakan'}</dd></div>
        <div><dt>Skor keutamaan</dt><dd>{risk === 'Unknown' ? 'Belum dipastikan' : Number.isFinite(Number(score)) && score !== null && score !== undefined ? `${Number(score)} / 100` : 'Belum tersedia'}<small>Petunjuk untuk semakan, bukan kebarangkalian kejadian.</small></dd></div>
      </dl>
      {!!facts.length && <details className="nlp-disclosure"><summary>Butiran yang dikenal pasti dalam teks</summary><dl className="nlp-extracted-list">{facts.map(({ label, values }) => <div key={label}><dt>{label}</dt><dd>{values.join(' · ')}</dd></div>)}</dl><p className="nlp-helper-hint">Lokasi yang disebut ialah maklumat laporan. Pemetaan pos dan kedudukan sebenar tidak berubah.</p></details>}
      <div className={`nlp-agent-review nlp-agent-${state.tone}`}>
        <div className="nlp-agent-title"><state.Icon size={21} aria-hidden="true" /><div><h4>{state.title}</h4><p>Semakan AI terhadap kandungan dan hasil analisis</p></div></div>
        {review.status === 'consistent' && <p>Semakan tidak menemui percanggahan dalam maklumat yang dinilai. Fakta dan keputusan laporan masih perlu disemak oleh pegawai berkenaan.</p>}
        {review.status === 'needs_review' && !findings.length && <p>Terdapat maklumat yang memerlukan perhatian pegawai. Baca laporan asal sebelum membuat keputusan.</p>}
        {!['consistent', 'needs_review'].includes(review.status) && <p>Laporan boleh disemak seperti biasa. Status ini tidak bermaksud analisis telah disahkan oleh AI.</p>}
        {!!findings.length && <ul className="nlp-findings">{findings.map((finding, index) => <li key={`${finding.code || 'finding'}-${index}`}><p>{finding.message || 'Semak semula maklumat dalam laporan.'}</p>{quoteInSource(finding.quote) && <blockquote><span>Petikan laporan</span>“{finding.quote}”</blockquote>}</li>)}</ul>}
      </div>
      {canGiveFeedback && analysis.id_nlp && <div className="nlp-feedback">
        {feedback?.id === analysis.id_nlp && feedback.saved ? <p role="status">Maklum balas direkodkan untuk semakan penambahbaikan. Keputusan laporan tidak berubah.</p> : <>
          <p className="font-medium text-primary-token">Adakah cadangan ini membantu semakan anda?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" variant="ghost" disabled={feedbackMutation.isPending} onClick={() => feedbackMutation.mutate({ id: analysis.id_nlp, decision: 'helpful' })}>Membantu</Button>
            <Button type="button" variant="ghost" disabled={feedbackMutation.isPending} onClick={() => setFeedback({ id: analysis.id_nlp, decision: 'needs_correction' })}>Perlu pembetulan</Button>
          </div>
          {feedback?.id === analysis.id_nlp && feedback.decision === 'needs_correction' && <div className="mt-3 space-y-2"><label className="block text-sm font-medium text-secondary-token">Catatan pembetulan (pilihan)<textarea className="app-input mt-1 w-full rounded-lg border p-3" maxLength={1000} rows={3} value={feedbackComment} onChange={(event) => setFeedbackComment(event.target.value)} placeholder="Nyatakan cadangan yang kurang tepat berdasarkan laporan asal." /></label><Button type="button" disabled={feedbackMutation.isPending} onClick={() => feedbackMutation.mutate({ id: analysis.id_nlp, decision: 'needs_correction', comment: feedbackComment.trim() })}>{feedbackMutation.isPending ? 'Menyimpan...' : 'Hantar maklum balas'}</Button></div>}
          {feedbackMutation.isError && <p className="text-sm text-red-700" role="status">Maklum balas belum dapat disimpan. Cuba sekali lagi.</p>}
        </>}
      </div>}
      {sourceChecks.status === 'needs_review' && <details className="nlp-disclosure" open><summary>Perhatian daripada semakan teks tempatan</summary><ul className="nlp-findings">{(sourceChecks.findings || []).map((finding, index) => <li key={`${finding.code || 'source'}-${index}`}><p>{textOf(finding.message || finding)}</p>{quoteInSource(finding.quote) && <blockquote>“{finding.quote}”</blockquote>}</li>)}</ul><p className="nlp-helper-hint">Ini semakan konsistensi berasaskan teks, berasingan daripada semakan Gemini.</p></details>}
      <details className="nlp-disclosure"><summary>Asas analisis & sumber</summary>
        <p className="nlp-helper-hint">Kategori dan skor ialah cadangan automatik. Semakan AI tidak meluluskan laporan atau menutup tindakan.</p>
        {(metadata.evidence || []).filter((item) => quoteInSource(textOf(item))).slice(0, 6).map((item, index) => <blockquote className="nlp-source-quote" key={`${item.start ?? index}-${index}`}>“{textOf(item)}”</blockquote>)}
        <dl className="nlp-technical-facts"><div><dt>Kaedah analisis</dt><dd>{metadata.model?.type || 'Analisis terdahulu'}</dd></div>{metadata.model?.version && <div><dt>Versi</dt><dd>{metadata.model.version}</dd></div>}<div><dt>Semakan AI</dt><dd>{review.provider === 'gemini' && ['consistent', 'needs_review'].includes(review.status) ? `Gemini${review.model ? ` · ${review.model}` : ''}` : 'Belum tersedia'}</dd></div></dl>
      </details>
    </> : !pending && <p className="nlp-helper-hint">Belum ada analisis lengkap untuk laporan ini. Laporan asal masih tersedia untuk semakan.</p>}
    {autoRefresh && reportId && (analysisQuery.isError || pending || job?.status === 'failed') && <Button type="button" variant="ghost" disabled={analysisQuery.isFetching} onClick={() => { pollingStarted.current = Date.now(); analysisQuery.refetch(); }}><RefreshCw size={15} /> {analysisQuery.isFetching ? 'Memuatkan...' : 'Muat semula analisis'}</Button>}
    {showRelated && reportId && <div className="nlp-related"><div className="flex items-center gap-2"><FileSearch size={18} aria-hidden="true" /><h4>Laporan berkaitan</h4></div>
      {relatedQuery.isPending ? <p className="nlp-helper-hint">Mencari laporan berkaitan…</p> : relatedQuery.isError ? <p className="nlp-helper-hint">Carian berkaitan belum tersedia. Anda masih boleh membaca laporan asal.</p> : related.length ? <ul>{related.slice(0, 5).map((item) => <li key={item.id_laporan}><div><Link className="font-medium text-primary-token underline decoration-slate-300 underline-offset-4" to={`${reportRoute}?report=${item.id_laporan}`}>{item.tajuk_laporan}</Link><p className="text-data">#{item.id_laporan} · {item.nama_pos || 'Pos tidak dinyatakan'} · {item.tarikh_laporan?.slice(0, 10)}</p></div>{item.tahap_risiko && <Badge tone={item.tahap_risiko}>{item.tahap_risiko}</Badge>}</li>)}</ul> : <p className="nlp-helper-hint">Tiada laporan berkaitan ditemui dalam rekod yang boleh anda akses.</p>}
      {related.length > 0 && <><p className="nlp-helper-hint">Padanan menunjukkan persamaan teks dan tidak mengesahkan kejadian yang sama.</p><Link className="nlp-related-link" to={reportRoute}>Buka senarai laporan <ExternalLink size={14} aria-hidden="true" /></Link></>}
    </div>}
    <footer className="nlp-review-footer"><ShieldCheck size={16} aria-hidden="true" /><p>Keputusan rasmi kekal dengan Ketua Pengawal dan Pentadbir Sistem mengikut peranan masing-masing.</p></footer>
  </section>;
}
