import { Link } from 'react-router-dom';
import { Card, Button } from '../ui';
import { apiMessage, klTimestamp } from './operationalIndicators';
const missing = 'Maklumat tidak tersedia';
const attendance = { 'Checked In': 'Daftar masuk direkodkan', 'Checked Out': 'Daftar keluar direkodkan', 'No Check-In Recorded': 'Tiada daftar masuk direkodkan', Unknown: 'Tidak diketahui' };

export function LocationInformationPanel({ location, operations }) {
  const q = operations.summary; const data = q.data;
  return <Card title="Maklumat Lokasi" className="h-fit min-w-0">
    {!location ? <div className="space-y-3 py-5"><h3>Pilih lokasi bangunan</h3><p>Pilih penanda atau senarai lokasi untuk melihat snapshot rekod operasi.</p></div> : <div className="space-y-4">
      <h3 className="text-lg">{location.name}</h3><p>{location.description}</p>
      {!operations.location && <p>{operations.overview.isPending ? 'Memuatkan konfigurasi lokasi...' : operations.overview.isError ? 'Konfigurasi lokasi tidak tersedia. Model masih boleh digunakan.' : 'Hotspot ini belum dikonfigurasi dalam pangkalan data.'}</p>}
      {operations.location && q.isPending && <p role="status">Memuatkan ringkasan lokasi...</p>}
      {q.isError && <div role="alert"><p>{apiMessage(q.error)} {data && 'Data di bawah ialah snapshot terdahulu dan mungkin lapuk.'}</p><Button variant="ghost" onClick={() => q.refetch()}>Cuba semula lokasi</Button></div>}
      {data && <>
        <p className="text-xs">Snapshot: {klTimestamp(data.refreshed_at)} (MYT)<br />Tugas {data.period.date}; laporan {data.period.from} hingga {data.period.to}.</p>
        <p>{data.location.nama_paparan} · {data.location.kawasan}<br />Aras: {data.location.label_aras || missing}</p>
        {!data.linked ? <p className="rounded-lg bg-slate-100 p-3">{data.reason}. Tiada rekod operasi dipautkan; ini tidak menandakan insiden.</p> : data.in_scope === false ? <p>Pos ini di luar penapis semasa. Tetapkan semula penapis untuk melihat rekodnya.</p> : <>
          <section className="rounded-lg border p-3"><h3>{data.post.nama_pos}</h3><p>{data.post.nama_bangunan || missing}<br />{data.post.lokasi || missing}<br />Waktu operasi: {data.post.waktu_operasi || missing}<br />Status pos: {data.post.status_pos || missing}</p></section>
          <details open><summary className="cursor-pointer font-semibold">Jadual & rekod kehadiran</summary>
            <p className="my-2 text-xs">{data.metrics.schedule.confirmed} disahkan / dikunci · {data.metrics.schedule.draft} belum disahkan. Kehadiran bukan lokasi fizikal atau GPS.</p>
            {!data.assignments.length && <p>Tiada tugasan direkodkan bagi tempoh ini.</p>}
            <div className="max-h-72 overflow-auto space-y-3">{data.assignments.map((a) => <div key={a.id_jadual} className="border-b pb-3 text-sm"><strong>{a.nama_penuh}</strong><p>{a.syif} · {a.status_jadual}<br />{klTimestamp(a.starts_at)} — {klTimestamp(a.ends_at)}<br />Status tugasan: {a.status_bertugas}<br />{attendance[a.attendance_state] || missing}<br />Masuk: {klTimestamp(a.masa_check_in)}<br />Keluar: {klTimestamp(a.masa_check_out)}</p></div>)}</div>
            {data.metrics.schedule.assignments > data.assignments.length && <p className="text-xs">Memaparkan {data.assignments.length} daripada {data.metrics.schedule.assignments} tugasan. Lihat modul jadual untuk selebihnya.</p>}
          </details>
          <details open><summary className="cursor-pointer font-semibold">Laporan & klasifikasi tersimpan ({data.metrics.incidents.total})</summary>
            <p className="my-2 text-xs">Metadata NLP prototaip; bukan ramalan insiden atau penilaian keselamatan bangunan.</p>
            <p className="text-sm">{['Low','Medium','High','Critical','Unknown'].map((level) => `${level}: ${data.metrics.incidents[level]}`).join(' · ')}</p>
            {!data.reports.length && <p>Tiada laporan dalam julat ini.</p>}
            <ul className="mt-3 max-h-64 overflow-auto space-y-2">{data.reports.map((r) => <li key={r.id_laporan} className="border-b pb-2"><strong>{r.tajuk_laporan}</strong><p className="text-xs">{r.tarikh_laporan} · {r.status_laporan}<br />{r.tahap_risiko} · {r.kategori_dikesan || 'Kategori belum tersedia'}</p></li>)}</ul>
            <p className="text-xs">Sehingga 10 laporan terkini. Naratif dan bukti hanya melalui modul laporan yang dibenarkan.</p>
          </details>
          <details open><summary className="cursor-pointer font-semibold">Tindakan susulan</summary>
            <p className="my-2 text-sm">Jumlah {data.metrics.follow_up.total} · Terbuka {data.metrics.follow_up.open} · Dalam tindakan {data.metrics.follow_up.in_progress} · Selesai {data.metrics.follow_up.completed}</p>
            <p className="text-xs">Berkaitan laporan dalam julat dipilih. Dalam tindakan termasuk dalam kiraan terbuka.</p>
            <ul className="max-h-60 overflow-auto space-y-2">{data.actions.map((a) => <li key={a.id_tindakan} className="border-b py-2 text-sm">Tindakan #{a.id_tindakan} · {a.status_tindakan} · {a.tahap_keutamaan}<p className="text-xs">Kemajuan terakhir: {a.jenis_progress || missing}<br />{klTimestamp(a.tarikh_progress)}{a.perlu_respon_ketua && ' · Respons Ketua diminta'}</p></li>)}</ul>
            {!data.actions.length && <p>Tiada tindakan berkaitan dalam julat ini.</p>}
          </details>
          <nav className="grid gap-2" aria-label="Modul operasi">{[['/jadual','Lihat Jadual'],['/semakan','Lihat Laporan'],['/tindakan','Lihat Tindakan Susulan']].map(([to,label]) => <Link key={to} to={to} className="app-button-ghost rounded-lg border p-3 text-center">{label}</Link>)}</nav>
          <p className="text-xs">Pautan membuka modul umum. Gunakan penapis pos di modul berkenaan; tiada laluan butiran lokasi khusus tersedia.</p>
        </>}
      </>}
    </div>}
  </Card>;
}
