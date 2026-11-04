import { Check, Clock3, Minus, ArrowRight } from 'lucide-react';
import './report-summary.css';

export function ReportLifecycle({ report, actions = [] }) {
  const hasOpenAction = actions.some((item) => item.status_tindakan !== 'Selesai');
  const approved=report.status_laporan==='Diluluskan';
  const requiresAction = approved && (report.perlu_tindakan_susulan || actions.length>0);
  const steps = [
    { label: 'Dihantar', active: true },
    { label: report.status_laporan === 'Ditolak' ? 'Ditolak' : 'Diluluskan', active: ['Diluluskan', 'Ditolak'].includes(report.status_laporan) },
    { label: 'Tindakan Susulan', active: requiresAction && actions.length > 0, pending: requiresAction && actions.length === 0, notRequired:approved&&!requiresAction },
    { label: 'Selesai', active: approved && (!requiresAction || actions.length>0&&!hasOpenAction) },
  ];
  return (
    <section className="report-flow" aria-label="Aliran status laporan">
      <p className="report-flow-title">Aliran Status Laporan</p>
      <div className="grid report-flow-grid">
        {steps.map((step,index) => (
          <div key={step.label} className={`report-flow-step ${step.active ? 'status-success' : step.pending ? 'badge-medium' : 'badge-default'}`}>
            <span className="report-step-marker" aria-hidden="true">{step.active?<Check size={14}/>:step.pending?<Clock3 size={14}/>:step.notRequired?<Minus size={14}/>:index+1}</span><div><p className="report-step-title">{step.label}</p>
            <p className="report-step-state">{step.active ? 'Selesai' : step.pending ? 'Perlu tindakan' : step.notRequired ? 'Tidak diperlukan' : 'Belum'}</p></div>
          </div>
        ))}
      </div>
      <div className="report-next-step"><ArrowRight size={16}/><div><strong>Langkah seterusnya</strong>
      {report.status_laporan==='Dihantar'?<p>Menunggu semakan Ketua Pengawal. Laporan asal telah disimpan.</p>:report.status_laporan==='Ditolak'?<p>Laporan ditolak. Pengawal perlu semak catatan dan hantar laporan baharu jika pembetulan diperlukan.</p>:requiresAction&&actions.length===0?<p>Ketua Pengawal menetapkan tindakan susulan diperlukan. Admin perlu cipta tindakan susulan.</p>:hasOpenAction?<p>Tindakan sedang diurus. Ketua Pengawal boleh merekodkan kemajuan untuk semakan Admin.</p>:approved?<p>{requiresAction?'Semua tindakan telah selesai. Rekod disimpan untuk rujukan.':'Semakan selesai. Tiada tindakan susulan diperlukan.'}</p>:<p>Semak kandungan laporan dan status terkini.</p>}
      </div></div>
    </section>
  );
}
