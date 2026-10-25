import { Badge, AttachmentLinks, EvidencePreview } from './ui';
import { ReportLifecycle } from './ReportLifecycle';
import { statusTone } from '../utils/helpers';
import { NlpReviewPanel } from './NlpReviewPanel';

export function ReportDetailContent({ detail, canGiveNlpFeedback = false, reportRoute }) {
  if (!detail) return null;

  const renderHighlightedContent = (text, keywords = []) => {
    if (!text || !keywords || !keywords.length) return text;
    const regex = new RegExp(`(${keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      keywords.some(k => k.toLowerCase() === part.toLowerCase()) ? (
        <mark key={i} className="rounded bg-amber-100 px-1 py-0.5 font-semibold text-amber-900 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700">
          {part}
        </mark>
      ) : part
    );
  };


  return (
    <div className="report-document space-y-5 text-sm">
      <div className="border-b pb-4">
        <p className="label-caps">Dokumen Laporan Harian</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[var(--color-brand-navy)]">{detail.report.tajuk_laporan}</h2>
            <p className="text-data">No. Laporan: {detail.report.id_laporan}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={statusTone(detail.report.status_laporan)}>{detail.report.status_laporan}</Badge>
            <Badge tone={detail.report.tahap_risiko}>{detail.report.tahap_risiko}</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="document-field"><span>Pengawal</span><strong>{detail.report.nama_penuh || '-'}</strong></div>
        <div className="document-field"><span>Pos Kawalan</span><strong>{detail.report.nama_pos || '-'}</strong></div>
        <div className="document-field"><span>Syif</span><strong>{detail.report.syif || '-'}</strong></div>
        <div className="document-field"><span>Tarikh / Masa</span><strong>{detail.report.tarikh_laporan?.slice(0, 10) || '-'} {detail.report.masa_laporan || ''}</strong></div>
      </div>

      <section>
        <p className="document-section-title">Kandungan Laporan</p>
        <div className="document-box whitespace-pre-wrap">
          {renderHighlightedContent(detail.report.kandungan_laporan, detail.report.kata_kunci_dikesan)}
        </div>
        <AttachmentLinks value={detail.report.lampiran_fail} label="Buka lampiran bukti" />
      </section>

      <EvidencePreview value={detail.report.lampiran_fail} />

      <ReportLifecycle report={detail.report} actions={detail.actions} />

      <NlpReviewPanel
        key={detail.report.id_laporan}
        report={detail.report}
        analysis={detail.analysis}
        job={detail.analysisJob}
        canGiveFeedback={canGiveNlpFeedback}
        reportRoute={reportRoute}
      />

      <section>
        <p className="document-section-title">Checklist Pemeriksaan</p>
        {detail.checklist.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr><th className="py-2">Item</th><th>Jawapan</th><th>Catatan</th></tr></thead>
              <tbody>{detail.checklist.map((item) => <tr key={item.id_jawapan} className="app-divider border-b"><td className="py-2">{item.nama_checklist}</td><td>{item.jawapan}</td><td>{item.catatan || '-'}</td></tr>)}</tbody>
            </table>
          </div>
        ) : <p>Tiada checklist direkodkan.</p>}
      </section>

      <section>
        <p className="document-section-title">Sejarah Semakan</p>
        {detail.reviews.length ? detail.reviews.map((item) => <div key={item.id_pengesahan} className="document-box mb-2"><strong>{item.status_pengesahan}</strong><p>{item.catatan_pengesahan || '-'}</p><p className="text-data">{item.nama_penuh} - {new Date(item.tarikh_pengesahan).toLocaleString()}</p></div>) : <p>Belum disemak.</p>}
      </section>

      <section>
        <p className="document-section-title">Tindakan Susulan</p>
        {detail.actions.length ? detail.actions.map((item) => <div key={item.id_tindakan} className="document-box mb-2"><div className="flex flex-wrap gap-2"><Badge tone={item.tahap_keutamaan}>{item.tahap_keutamaan}</Badge><Badge tone={statusTone(item.status_tindakan)}>{item.status_tindakan}</Badge></div><p className="mt-2">{item.tindakan_diambil}</p><p className="text-data">{item.pegawai_bertanggungjawab}</p></div>) : <p>Tiada tindakan susulan.</p>}
      </section>
    </div>
  );
}
