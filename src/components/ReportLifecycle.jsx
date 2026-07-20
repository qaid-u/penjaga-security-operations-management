export function ReportLifecycle({ report, actions = [] }) {
  const hasOpenAction = actions.some((item) => item.status_tindakan !== 'Selesai');
  const requiresAction = report.status_laporan === 'Diluluskan' && ['High', 'Critical'].includes(report.tahap_risiko);
  const steps = [
    { label: 'Dihantar', active: true },
    { label: report.status_laporan === 'Ditolak' ? 'Ditolak' : 'Diluluskan', active: ['Diluluskan', 'Ditolak'].includes(report.status_laporan) },
    { label: 'Tindakan Susulan', active: requiresAction && actions.length > 0, pending: requiresAction && actions.length === 0 },
    { label: 'Selesai', active: actions.length > 0 && !hasOpenAction },
  ];
  return (
    <div className="app-row rounded-md border p-3">
      <p className="mb-3 font-medium text-primary-token">Aliran Status Laporan</p>
      <div className="grid gap-2 sm:grid-cols-4">
        {steps.map((step) => (
          <div key={step.label} className={`rounded-md border p-3 ${step.active ? 'status-success' : step.pending ? 'badge-medium' : 'badge-default'}`}>
            <p className="font-medium">{step.label}</p>
            <p className="text-[var(--fs-small)]">{step.active ? 'Selesai' : step.pending ? 'Perlu tindakan' : 'Belum'}</p>
          </div>
        ))}
      </div>
      {report.status_laporan === 'Ditolak' && <p className="mt-3">Laporan ditolak. Pengawal perlu semak catatan dan hantar laporan baharu jika pembetulan diperlukan.</p>}
      {requiresAction && actions.length === 0 && <p className="mt-3">Laporan risiko tinggi telah diluluskan. Admin perlu cipta tindakan susulan.</p>}
    </div>
  );
}
