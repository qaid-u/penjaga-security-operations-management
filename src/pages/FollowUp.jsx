import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, X } from 'lucide-react';
import api from '../api/axios';
import { ROLE, notifyAction, notifyError, notifySuccess, statusTone } from '../utils/helpers';
import { PageHeader, Card, AlertMessage, Field, Input, Select, Textarea, Button, Badge, FilterPanel, EmptyState, AttachmentLinks, Pagination, LoadingState } from '../components/ui';
import { ReportDetailContent } from '../components/ReportDetailContent';

export function FollowUp({ auth }) {
  const canManageFollowUp = auth.user?.nama_peranan === ROLE.admin;
  const [candidatePage, setCandidatePage] = useState(1);
  const [creating, setCreating] = useState(false);
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ status_tindakan: 'Baru', tahap_keutamaan: 'High' });
  const [filters, setFilters] = useState({ status: '', priority: '', search: '' });
  const [reportSearch, setReportSearch] = useState('');
  const [notes, setNotes] = useState({});
  const [progressNotes, setProgressNotes] = useState({});
  const [requestNotes, setRequestNotes] = useState({});
  const [progressFiles, setProgressFiles] = useState({});
  const [requestFiles, setRequestFiles] = useState({});
  const [reportDetail, setReportDetail] = useState(null);

  const actionsQuery = useQuery({ queryKey: ['actions'], queryFn: async ({ signal }) => (await api.get('/actions', { signal })).data });
  const candidatesQuery = useQuery({ queryKey: ['follow-up-reports', reportSearch, candidatePage], queryFn: async ({ signal }) => (await api.get('/reports', { signal, params: { follow_up: 'pending', search: reportSearch, page: candidatePage, limit: 50 } })).data, enabled: canManageFollowUp });
  const actions = actionsQuery.data || [];
  const filteredReportsForAction = candidatesQuery.data?.data || [];
  const candidateTotal = candidatesQuery.data?.meta?.total ?? filteredReportsForAction.length;
  const changeCandidatePage = page => { setCandidatePage(page); setForm(current => ({ ...current, id_laporan: '' })); };
  const load = () => Promise.all([queryClient.invalidateQueries({ queryKey: ['actions'] }), queryClient.invalidateQueries({ queryKey: ['follow-up-reports'] }), queryClient.invalidateQueries({ queryKey: ['dashboard'] })]);

  const loadReportDetail = async (id) => {
    try {
      const { data } = await api.get(`/reports/${id}`);
      setReportDetail(data);
      notifyAction('Laporan asal dibuka');
    } catch (error) {
      notifyError(error, 'Laporan asal gagal dibuka');
    }
  };

  const create = async (e) => {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      await api.post('/actions', { ...form, id_laporan: Number(form.id_laporan) });
      setForm({ status_tindakan: 'Baru', tahap_keutamaan: 'High' });
      setCandidatePage(1);
      notifySuccess('Tindakan susulan disimpan');
      load();
    } catch (error) {
      notifyError(error, 'Tindakan gagal disimpan');
    } finally { setCreating(false); }
  };

  const update = async (id, status_tindakan) => {
    try {
      await api.patch(`/actions/${id}`, { status_tindakan, catatan_tindakan: notes[id] || undefined });
      setNotes((prev) => ({ ...prev, [id]: '' }));
      notifySuccess(`Status tindakan: ${status_tindakan}`);
      load();
    } catch (error) {
      notifyError(error, 'Status tindakan gagal dikemas kini');
    }
  };

  const submitProgress = async (id) => {
    try {
      const body = new FormData();
      body.append('catatan_progress', progressNotes[id] || '');
      Array.from(progressFiles[id] || []).forEach((file) => body.append('lampiran_fail', file));
      await api.post(`/actions/${id}/progress`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
      setProgressNotes((prev) => ({ ...prev, [id]: '' }));
      setProgressFiles((prev) => ({ ...prev, [id]: [] }));
      notifySuccess('Progress dihantar kepada Admin untuk semakan');
      load();
    } catch (error) {
      notifyError(error, 'Progress gagal dihantar');
    }
  };

  const requestChiefUpdate = async (id) => {
    try {
      const body = new FormData();
      body.append('catatan_progress', requestNotes[id] || '');
      Array.from(requestFiles[id] || []).forEach((file) => body.append('lampiran_fail', file));
      await api.post(`/actions/${id}/request-update`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
      setRequestNotes((prev) => ({ ...prev, [id]: '' }));
      setRequestFiles((prev) => ({ ...prev, [id]: [] }));
      notifySuccess('Permintaan kemaskini dihantar kepada Ketua');
      load();
    } catch (error) {
      notifyError(error, 'Permintaan kemaskini gagal dihantar');
    }
  };

  const filteredActions = actions.filter((action) => {
    const search = filters.search.toLowerCase();
    const matchesSearch = !search || [action.tajuk_laporan, action.pegawai_bertanggungjawab, action.nama_pos, action.nama_penuh, action.tindakan_diambil].some((value) => String(value || '').toLowerCase().includes(search));
    const matchesStatus = !filters.status || action.status_tindakan === filters.status;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="desktop-ops space-y-5">
      <PageHeader
        title="Tindakan Susulan"
        description={canManageFollowUp ? 'Admin mengurus, mengemas kini dan menutup tindakan untuk insiden berisiko.' : 'Ketua boleh memantau tindakan susulan selepas laporan diluluskan.'}
      />
      {candidateTotal > 0 && (
        <AlertMessage>{candidateTotal} laporan telah diluluskan tetapi belum ada tindakan susulan. Admin perlu cipta dan kemas kini tindakan.</AlertMessage>
      )}
      <div className="space-y-5">
        {canManageFollowUp && <details className="workspace-disclosure"><summary>Tambah tindakan baharu <small>{candidateTotal} laporan menunggu tindakan</small></summary><div className="max-w-3xl">
          <form onSubmit={create} className="space-y-3">
            <Field label="Cari laporan">
              <Input placeholder="Cari tajuk, pengawal atau pos" value={reportSearch} onChange={e => { setReportSearch(e.target.value); changeCandidatePage(1); }} />
            </Field>
            {candidatesQuery.isError && <AlertMessage>Pilihan laporan belum dapat dimuatkan. <button type="button" className="underline" onClick={() => candidatesQuery.refetch()}>Cuba lagi</button></AlertMessage>}
            {candidatesQuery.isLoading && <p role="status">Memuatkan pilihan laporan...</p>}
            <Field label="Laporan">
              <Select required value={form.id_laporan || ''} onChange={(e) => setForm({ ...form, id_laporan: e.target.value })}>
                <option value="">Pilih laporan diluluskan</option>
                {filteredReportsForAction.map((r) => <option key={r.id_laporan} value={r.id_laporan}>{r.tajuk_laporan} - {r.nama_pos} - {r.tahap_risiko}</option>)}
              </Select>
            </Field>
            {!candidatesQuery.isPending && !candidatesQuery.isError && !filteredReportsForAction.length && <AlertMessage type="success">Tiada laporan diluluskan yang sepadan dan memerlukan tindakan susulan.</AlertMessage>}
            <Pagination page={candidatePage} totalPages={candidatesQuery.data?.meta?.totalPages || 1} onPageChange={changeCandidatePage} />
            <Field label="Pegawai bertanggungjawab"><Input required value={form.pegawai_bertanggungjawab || ''} onChange={(e) => setForm({ ...form, pegawai_bertanggungjawab: e.target.value })} /></Field>
            <Field label="Tindakan diambil"><Textarea required rows={4} value={form.tindakan_diambil || ''} onChange={(e) => setForm({ ...form, tindakan_diambil: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Keutamaan"><Select value={form.tahap_keutamaan} onChange={(e) => setForm({ ...form, tahap_keutamaan: e.target.value })}><option>Medium</option><option>High</option><option>Critical</option></Select></Field>
              <Field label="Tarikh mula"><Input type="date" value={form.tarikh_mula || ''} onChange={(e) => setForm({ ...form, tarikh_mula: e.target.value })} /></Field>
            </div>
            <Field label="Catatan awal"><Textarea rows={3} value={form.catatan_tindakan || ''} onChange={(e) => setForm({ ...form, catatan_tindakan: e.target.value })} /></Field>
            <Button className="w-full sm:w-auto" disabled={creating || candidatesQuery.isPending || candidatesQuery.isError}>{creating ? 'Menyimpan...' : 'Simpan tindakan'}</Button>
          </form>
        </div></details>}
        <div className="space-y-5">
          <FilterPanel>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_220px]">
              <Input aria-label="Cari tindakan" placeholder="Cari laporan, pegawai, pos" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
              <Select aria-label="Status tindakan" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">Semua status</option><option>Baru</option><option>Dalam Tindakan</option><option>Selesai</option></Select>
            </div>
          </FilterPanel>
          <Card title="Senarai Tindakan">
            <p className="mb-3 text-sm text-secondary-token">{filteredActions.length} daripada {actions.length} tindakan dipaparkan.</p>
            {actionsQuery.isError && <AlertMessage>Tindakan belum dapat dimuatkan. <button type="button" className="underline" onClick={() => actionsQuery.refetch()}>Cuba lagi</button></AlertMessage>}
            {actionsQuery.isPending ? <LoadingState message="Memuatkan tindakan..." /> : actionsQuery.isError ? null : filteredActions.length ? filteredActions.map((a) => (
              <div key={a.id_tindakan} className={`desktop-record mb-3 rounded-md border p-4 text-sm ${a.tahap_keutamaan === 'Critical' && a.status_tindakan !== 'Selesai' ? 'app-row-alert' : 'app-row'}`}>
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <span className="font-medium text-primary-token">{a.tajuk_laporan}</span>
                    <p className="text-data">{a.nama_penuh || '-'} - {a.nama_pos || '-'} - {a.tarikh_laporan?.slice(0, 10)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={a.tahap_keutamaan}>{a.tahap_keutamaan}</Badge>
                    <Badge tone={statusTone(a.status_tindakan)}>{a.status_tindakan}</Badge>
                  </div>
                </div>
                <p className="mt-2">{a.tindakan_diambil}</p>
                <p className="mt-1">Pegawai: {a.pegawai_bertanggungjawab}</p>
                <Button className="mt-3 w-full justify-center sm:w-auto" variant="ghost" onClick={() => loadReportDetail(a.id_laporan)}><Eye size={16} /> Lihat laporan asal</Button>
                {a.progress_notes?.some(progress => progress.perlu_respon_ketua) && <p className="mt-3"><Badge tone="Medium">Perlu respon Ketua</Badge></p>}
                <details className="workspace-disclosure mt-4"><summary>Kemas kini & sejarah <small>{a.progress_notes?.length || 0} catatan</small></summary>
                {a.catatan_tindakan && <p className="mt-1">Catatan: {a.catatan_tindakan}</p>}
                {a.progress_notes?.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="label-caps">Komunikasi Admin dan Ketua</p>
                    {a.progress_notes.map((progress) => (
                      <div key={progress.id_progress} className={`rounded-lg border bg-white p-3 ${progress.perlu_respon_ketua ? 'border-amber-300' : ''}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Badge tone={progress.jenis_progress === 'Permintaan Admin' ? 'High' : 'Low'}>{progress.jenis_progress || 'Kemaskini'}</Badge>
                          {progress.perlu_respon_ketua && <Badge tone="Medium">Perlu respon Ketua</Badge>}
                        </div>
                        <p className="mt-2">{progress.catatan_progress}</p>
                        <AttachmentLinks value={progress.lampiran_fail} label="Bukti" />
                        <p className="text-data">{progress.nama_penuh} - {progress.nama_peranan} - {new Date(progress.tarikh_progress).toLocaleString()} - {progress.dilihat_admin ? 'Dilihat Admin' : 'Belum dilihat Admin'}</p>
                      </div>
                    ))}
                  </div>
                )}
                {canManageFollowUp ? <div className="mt-3 grid gap-2">
                  <Textarea rows={2} placeholder="Catatan kemas kini" value={notes[a.id_tindakan] || ''} onChange={(e) => setNotes({ ...notes, [a.id_tindakan]: e.target.value })} />
                  <div className="rounded-lg border bg-white p-3">
                    <p className="font-medium text-primary-token">Minta kemaskini daripada Ketua</p>
                    <p className="mb-2 text-sm text-secondary-token">Gunakan ini jika Admin perlukan maklumat lapangan, gambar tambahan, atau pengesahan keadaan semasa.</p>
                    <Textarea rows={2} placeholder="Contoh: Sila kemaskini keadaan pintu dan lampirkan gambar terkini." value={requestNotes[a.id_tindakan] || ''} onChange={(e) => setRequestNotes({ ...requestNotes, [a.id_tindakan]: e.target.value })} />
                    <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                      <Input type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(e) => setRequestFiles({ ...requestFiles, [a.id_tindakan]: Array.from(e.target.files || []) })} />
                      <Button type="button" variant="ghost" onClick={() => requestChiefUpdate(a.id_tindakan)}>Minta kemaskini</Button>
                    </div>
                    {(requestFiles[a.id_tindakan] || []).length > 0 && <p className="text-data">{requestFiles[a.id_tindakan].length} lampiran dipilih.</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" onClick={() => update(a.id_tindakan, 'Baru')}>Baru</Button>
                    <Button variant="ghost" onClick={() => update(a.id_tindakan, 'Dalam Tindakan')}>Dalam Tindakan</Button>
                    <Button onClick={() => update(a.id_tindakan, 'Selesai')}>Selesai</Button>
                  </div>
                </div> : <div className="mt-3 grid gap-2"><AlertMessage type="success">Status rasmi hanya boleh dikemaskini oleh Pentadbir Sistem. Jika Admin meminta kemaskini, balas di sini bersama bukti jika perlu.</AlertMessage><Textarea rows={2} placeholder="Catatan / progress untuk Admin" value={progressNotes[a.id_tindakan] || ''} onChange={(e) => setProgressNotes({ ...progressNotes, [a.id_tindakan]: e.target.value })} /><Input type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(e) => setProgressFiles({ ...progressFiles, [a.id_tindakan]: Array.from(e.target.files || []) })} />{(progressFiles[a.id_tindakan] || []).length > 0 && <p className="text-data">{progressFiles[a.id_tindakan].length} lampiran bukti dipilih.</p>}<Button onClick={() => submitProgress(a.id_tindakan)}>Hantar progress kepada Admin</Button></div>}
                </details>
              </div>
            )) : <EmptyState title="Tiada tindakan" description="Tiada tindakan susulan sepadan dengan tapisan semasa." />}
          </Card>
        </div>
      </div>
      {reportDetail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(0,0,0,0.55)] p-0 sm:items-center sm:p-4">
          <div className="app-elevated motion-sheet max-h-[94vh] w-full overflow-y-auto rounded-t-lg border p-4 shadow-xl sm:max-w-5xl sm:rounded-lg lg:p-6">
            <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-4 flex items-start justify-between gap-3 border-b bg-white px-4 py-4 lg:-mx-6 lg:-mt-6 lg:px-6">
              <div>
                <h2>Laporan Asal #{reportDetail.report.id_laporan}</h2>
                <p className="text-sm">Rujukan penuh laporan yang menjadi asas tindakan susulan.</p>
              </div>
              <Button variant="ghost" onClick={() => setReportDetail(null)}><X size={16} /> Tutup</Button>
            </div>
            <ReportDetailContent detail={reportDetail} />
          </div>
        </div>
      )}
    </div>
  );
}
