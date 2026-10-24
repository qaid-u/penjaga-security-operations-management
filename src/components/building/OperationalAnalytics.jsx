export function OperationalAnalytics({ query, mode, onMetric }) {
  const totals = query.data?.totals;
  const cards = mode === 'incidents' ? [['reports','Laporan dalam julat'],['high_critical','Laporan High / Critical'],['unmapped_reports','Laporan tanpa pautan 3D'],['open_actions','Tindakan terbuka']]
    : mode === 'followup' ? [['open_actions','Tindakan terbuka'],['completed_actions','Tindakan selesai'],['reports','Laporan berkaitan']]
    : [['linked_posts','Pos dipautkan'],['assignments','Tugasan dijadualkan'],['checked_in','Daftar masuk direkodkan'],['reports','Laporan dalam julat'],['high_critical','Laporan High / Critical'],['open_actions','Tindakan terbuka']];
  return <section aria-label="Analitik operasi" className="space-y-2">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{cards.map(([key,label]) => <button type="button" key={key} disabled={!totals || query.isError} onClick={() => onMetric(key)} className="app-surface rounded-xl border p-4 text-left disabled:opacity-60 hover:border-amber-500"><span className="text-xs">{label}</span><strong className="block text-2xl">{totals?.[key] ?? '—'}</strong><span className="text-xs text-secondary-token">{query.isError ? 'Snapshot mungkin lapuk' : 'Buka paparan berkaitan →'}</span></button>)}</div>
    <p className="text-xs">Setiap pos dikira sekali walaupun dipautkan ke beberapa zon. Semua pos boleh merangkumi rekod tanpa kedudukan 3D. Laporan belum semestinya diluluskan; klasifikasi NLP ialah rekod tersimpan.</p>
  </section>;
}
