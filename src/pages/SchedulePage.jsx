import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Upload, X, MapPin, Search, ChevronDown, CalendarDays, Users } from 'lucide-react';
import api from '../api/axios';
import { ROLE, notifyError, notifySuccess, shiftTimes, shiftTimeLabel, statusTone } from '../utils/helpers';
import { PageHeader, Card, AlertMessage, Button, Field, Select, Input, Badge, Textarea, EmptyState, LoadingState, ConfirmModal, Pagination } from '../components/ui';

export function SchedulePage({ auth }) {
  const canManage = [ROLE.admin, ROLE.chief].includes(auth.user?.nama_peranan);
  const isAdmin = auth.user?.nama_peranan === ROLE.admin;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [postSearch, setPostSearch] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('');
  const [postPage, setPostPage] = useState(1);
  const [scheduleView, setScheduleView] = useState('assignments');
  const [weekSelection, setSelectedWeekId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [requirementForm, setRequirementForm] = useState({ id_pos: '', syif: 'Pagi', bilangan_diperlukan: 1, status_aktif: true });
  const [dateSelection, setQuickDate] = useState('');
  const [assignmentFilters, setAssignmentFilters] = useState({ post: '', shift: '', status: 'need' });
  const [assignmentForm, setAssignmentForm] = useState(null);
  const [conflict, setConflict] = useState(null);
  const [importFile, setImportFile] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const metaQuery = useQuery({ queryKey: ['meta'], queryFn: async ({ signal }) => (await api.get('/meta', { signal })).data, enabled: canManage });
  const weeksQuery = useQuery({ queryKey: ['schedule-weeks'], queryFn: async ({ signal }) => (await api.get('/jadual/mingguan', { signal })).data, enabled: canManage });
  const weeks = weeksQuery.data || [];
  const currentWeek = weeks.find(week => week.tarikh_mula?.slice(0,10) <= today && week.tarikh_tamat?.slice(0,10) >= today) || weeks[0];
  const selectedWeekId = weekSelection || String(currentWeek?.id_jadual_mingguan || '');
  const weekQuery = useQuery({ queryKey: ['schedule-week', selectedWeekId], queryFn: async ({ signal }) => (await api.get('/jadual/mingguan/' + selectedWeekId, { signal })).data, enabled: canManage && Boolean(selectedWeekId) });
  const selectedWeek = weekQuery.data || weeks.find(week => String(week.id_jadual_mingguan) === selectedWeekId);
  const start = selectedWeek?.tarikh_mula?.slice(0,10), end = selectedWeek?.tarikh_tamat?.slice(0,10);
  const preferredDate = dateSelection || today;
  const quickDate = start && end ? (preferredDate >= start && preferredDate <= end ? preferredDate : start) : today;
  const coverageQuery = useQuery({ queryKey: ['schedule-coverage', selectedWeekId, quickDate], queryFn: async ({ signal }) => (await api.get('/jadual/mingguan/' + selectedWeekId + '/coverage-summary', { signal, params: { date: quickDate } })).data, enabled: canManage && Boolean(start && end) });
  const requirementsQuery = useQuery({ queryKey: ['schedule-requirements'], queryFn: async ({ signal }) => (await api.get('/jadual/keperluan-pos', { signal })).data, enabled: canManage });
  const myScheduleQuery = useQuery({ queryKey: ['my-schedule'], queryFn: async ({ signal }) => (await api.get('/jadual/my-schedule', { signal })).data, enabled: !canManage });
  const meta = metaQuery.data || { posts: [], guards: [] };
  const coverage = coverageQuery.isError ? null : coverageQuery.data;
  const requirements = requirementsQuery.data || [];
  const mySchedule = myScheduleQuery.data || [];
  const queries = canManage ? [metaQuery, weeksQuery, requirementsQuery, ...(selectedWeekId ? [weekQuery, coverageQuery] : [])] : [myScheduleQuery];
  const hasError = queries.some(query => query.isError);
  const retry = () => Promise.all(queries.filter(query => query.isError).map(query => query.refetch()));
  const loadWeeks = () => weeksQuery.refetch();
  const loadWeekData = () => Promise.all([weekQuery.refetch(), coverageQuery.refetch()]);
  const loadRequirements = () => requirementsQuery.refetch();
  const loadMySchedule = () => myScheduleQuery.refetch();
  const loading = queries.some(query => query.isLoading);
  const errorNotice = hasError && <AlertMessage>Data jadual belum dapat dimuatkan. <button type="button" className="underline" onClick={retry}>Cuba lagi</button></AlertMessage>;

  const assignmentRows = useMemo(() => {
    const rows = coverage?.coverageByPost || [];
    return rows.filter((row) => {
      const shortage = Math.max(0, Number(row.required) - Number(row.assigned));
      const matchesPost = !assignmentFilters.post || String(row.id_pos) === String(assignmentFilters.post);
      const matchesShift = !assignmentFilters.shift || row.syif === assignmentFilters.shift;
      const matchesStatus = assignmentFilters.status === 'all' || (assignmentFilters.status === 'need' ? shortage > 0 : shortage === 0);
      const post = meta.posts.find(p => p.id_pos === row.id_pos);
      const matchesBuilding = !buildingFilter || post?.nama_bangunan === buildingFilter;
      const matchesSearch = !postSearch || [row.nama_pos,post?.nama_bangunan].join(' ').toLowerCase().includes(postSearch.toLowerCase());
      return matchesPost && matchesShift && matchesStatus && matchesBuilding && matchesSearch;
    });
  }, [assignmentFilters, coverage, meta.posts, buildingFilter, postSearch]);
  const postPages = Math.max(1, Math.ceil(assignmentRows.length/6));
  const visiblePostPage = Math.min(postPage,postPages);
  const visiblePostRows = assignmentRows.slice((visiblePostPage-1)*6,visiblePostPage*6);

  const openAssignment = (assignment = null) => {
    const baseDate = selectedWeek?.tarikh_mula?.slice(0, 10) || today;
    setConflict(null);
    setAssignmentForm(assignment ? {
      id_jadual: assignment.id_jadual,
      tarikh_tugas: assignment.tarikh_tugas?.slice(0, 10),
      syif: assignment.syif,
      masa_mula: assignment.masa_mula?.slice(0, 5),
      masa_tamat: assignment.masa_tamat?.slice(0, 5),
      id_pos: assignment.id_pos,
      id_pengguna: assignment.id_pengguna,
      catatan: assignment.catatan || '',
    } : {
      tarikh_tugas: baseDate,
      syif: 'Pagi',
      masa_mula: '07:00',
      masa_tamat: '16:00',
      id_pos: '',
      id_pengguna: '',
      catatan: '',
    });
  };

  const openAssignmentForRequirement = (requirement) => {
    const times = shiftTimes[requirement.syif] || shiftTimes.Pagi;
    setConflict(null);
    setAssignmentForm({
      tarikh_tugas: quickDate || selectedWeek?.tarikh_mula?.slice(0, 10) || today,
      syif: requirement.syif,
      masa_mula: times.start,
      masa_tamat: times.end,
      id_pos: requirement.id_pos,
      id_pengguna: '',
      catatan: '',
    });
  };

  const checkConflict = async (form = assignmentForm) => {
    if (!form?.id_pengguna || !form?.id_pos || !selectedWeekId) return null;
    const { data } = await api.post('/jadual/check-conflict', { ...form, id_jadual_mingguan: Number(selectedWeekId) });
    setConflict(data);
    return data;
  };

  const saveAssignment = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const result = await checkConflict();
      if (result && !result.ok) return notifyError({ message: result.critical.join('. ') }, 'Konflik jadual dikesan');
      if (assignmentForm.id_jadual) await api.put(`/jadual/assignments/${assignmentForm.id_jadual}`, assignmentForm);
      else await api.post(`/jadual/mingguan/${selectedWeekId}/assignments`, assignmentForm);
      notifySuccess('Tugasan jadual disimpan');
      setAssignmentForm(null);
      await loadWeekData();
    } catch (error) {
      notifyError(error, 'Tugasan jadual gagal disimpan');
    } finally {
      setSaving(false);
    }
  };

  const deleteAssignment = async (id) => {
    if (saving) return;
    setSaving(true);
    try {
      await api.delete(`/jadual/assignments/${id}`);
      setDeleteTarget(null);
      notifySuccess('Tugasan jadual dipadam');
      await loadWeekData();
    } catch (error) {
      notifyError(error, 'Tugasan jadual gagal dipadam');
    } finally { setSaving(false); }
  };

  const saveRequirement = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post('/jadual/keperluan-pos', {
        ...requirementForm,
        id_pos: Number(requirementForm.id_pos),
        bilangan_diperlukan: Number(requirementForm.bilangan_diperlukan),
      });
      notifySuccess('Keperluan pos dikemas kini');
      setRequirementForm({ id_pos: '', syif: 'Pagi', bilangan_diperlukan: 1, status_aktif: true });
      await loadRequirements();
      if (selectedWeekId) await loadWeekData();
    } catch (error) {
      notifyError(error, 'Keperluan pos gagal dikemas kini');
    } finally {
      setSaving(false);
    }
  };

  const updateWeekStatus = async (action) => {
    try {
      await api.post(`/jadual/mingguan/${selectedWeekId}/${action}`);
      notifySuccess(action === 'confirm' ? 'Jadual disahkan' : action === 'lock' ? 'Jadual dikunci' : 'Jadual dibuka kunci');
      await loadWeeks();
      await loadWeekData();
    } catch (error) {
      notifyError(error, 'Status jadual gagal dikemas kini');
    }
  };

  const uploadScheduleFile = async (event, type) => {
    event.preventDefault();
    const file = type === 'csv' ? importFile : pdfFile;
    if (!file) return notifyError({ message: 'Pilih fail dahulu' });
    const body = new FormData();
    body.append('jadual_fail', file);
    setSaving(true);
    try {
      const endpoint = type === 'csv' ? 'import-csv' : 'upload-pdf';
      const { data } = await api.post(`/jadual/mingguan/${selectedWeekId}/${endpoint}`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
      notifySuccess(type === 'csv' ? `Import CSV selesai: ${data.imported} tugasan` : 'PDF rujukan dimuat naik');
      setImportFile(null);
      setPdfFile(null);
      event.target.reset();
      await loadWeekData();
    } catch (error) {
      notifyError(error, type === 'csv' ? 'Import CSV gagal' : 'Muat naik PDF gagal');
    } finally {
      setSaving(false);
    }
  };

  const guardCheck = async (id, action) => {
    try {
      await api.post(`/jadual/assignments/${id}/${action}`);
      notifySuccess(action === 'check-in' ? 'Check-in berjaya' : 'Check-out berjaya');
      await loadMySchedule();
    } catch (error) {
      notifyError(error, 'Status kehadiran gagal dikemas kini');
    }
  };

  if (!canManage) {
    return (
      <div className="space-y-5">
        <PageHeader title="Jadual Bertugas Saya" description="Lihat tugasan pos, syif, masa dan status kehadiran anda." />
        <Card title="Tugasan Saya">
          {errorNotice}
          {loading ? <LoadingState message="Memuatkan tugasan..." /> : hasError ? null : mySchedule.length ? mySchedule.map((item) => {
            const dutyDate = item.tarikh_tugas?.slice(0, 10);
            const canCheckIn = item.can_check_in;
            const canCheckOut = item.can_check_out;
            return (
              <div key={item.id_jadual} className="app-row mb-3 rounded-md border p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-primary-token">{item.nama_pos}</p>
                    <p>{item.nama_bangunan || item.lokasi || '-'}</p>
                    <p className="text-data">{dutyDate} - {item.syif} - {item.masa_mula?.slice(0, 5)} hingga {item.masa_tamat?.slice(0, 5)}</p>
                  </div>
                  <Badge tone={statusTone(item.status_bertugas)}>{item.status_kehadiran || item.status_bertugas}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {canCheckIn && <Button onClick={() => guardCheck(item.id_jadual, 'check-in')}>Check-in</Button>}
                  {canCheckOut && <Button onClick={() => guardCheck(item.id_jadual, 'check-out')}>Check-out</Button>}
                </div>
              </div>
            );
          }) : <EmptyState title="Tiada jadual" description="Jadual anda akan dipaparkan selepas Ketua/Admin membuat tugasan." />}
        </Card>
      </div>
    );
  }

  const lockedForChief = auth.user?.nama_peranan === ROLE.chief && selectedWeek?.status_jadual === 'Dikunci';

  return (
    <div className="desktop-ops space-y-5">
      <PageHeader title="Jadual bertugas" description="Semak liputan pos dan tugaskan pengawal mengikut minggu." />
      {errorNotice}
      {loading && <LoadingState message="Memuatkan jadual..." />}
      {!weeksQuery.isPending && !weeksQuery.isError && !weeks.length && <EmptyState title="Tiada minggu jadual" description="Minggu jadual belum disediakan dalam sistem." />}
      <div className="max-w-md"><Field label="Minggu jadual"><Select value={selectedWeekId} onChange={event => {
        const week = weeks.find(item => String(item.id_jadual_mingguan) === event.target.value);
        setSelectedWeekId(event.target.value);
        if (week?.tarikh_mula) setQuickDate(week.tarikh_mula.slice(0, 10));
      }}><option value="" disabled>Pilih minggu</option>{weeks.map(week => <option key={week.id_jadual_mingguan} value={week.id_jadual_mingguan}>{week.tarikh_mula?.slice(0, 10)} hingga {week.tarikh_tamat?.slice(0, 10)} · {week.status_jadual}</option>)}</Select></Field></div>
      <div className="workspace-tabs" aria-label="Paparan jadual"><button aria-pressed={scheduleView === 'assignments'} onClick={() => setScheduleView('assignments')}>Tugasan & liputan</button><button aria-pressed={scheduleView === 'settings'} onClick={() => setScheduleView('settings')}>Tetapan & import</button></div>
      <div className="space-y-5">
        <div className="space-y-5">
          {selectedWeek && scheduleView === 'settings' && <Card>
            <div className="flex flex-wrap items-center gap-4 text-sm"><strong>Status jadual</strong>
              <Badge tone={statusTone(selectedWeek.status_jadual)}>{selectedWeek.status_jadual}</Badge>
              <p>{selectedWeek.tarikh_mula?.slice(0, 10)} hingga {selectedWeek.tarikh_tamat?.slice(0, 10)}</p>
              {selectedWeek.catatan && <p>{selectedWeek.catatan}</p>}
              <div className="flex flex-wrap gap-2">
                {isAdmin && scheduleView === 'settings' && <Button variant="ghost" onClick={() => updateWeekStatus('confirm')}>Sahkan</Button>}
                {isAdmin && scheduleView === 'settings' && <Button variant="ghost" onClick={() => updateWeekStatus('lock')}>Kunci</Button>}
                {isAdmin && <Button variant="ghost" onClick={() => updateWeekStatus('unlock')}>Buka Kunci</Button>}
              </div>
              {lockedForChief && <AlertMessage>Jadual dikunci. Ketua tidak boleh mengubah tugasan sehingga Admin membuka kunci.</AlertMessage>}
            </div>
          </Card>}

          {scheduleView === 'settings' && <div className="grid gap-5 xl:grid-cols-2"><Card title="Tetapan Keperluan Pos">
            <form onSubmit={saveRequirement} className="space-y-3">
              <Field label="Pos kawalan"><Select required value={requirementForm.id_pos} onChange={(e) => setRequirementForm({ ...requirementForm, id_pos: e.target.value })}><option value="">Pilih pos</option>{meta.posts.map((post) => <option key={post.id_pos} value={post.id_pos}>{post.nama_pos}</option>)}</Select></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Syif"><Select value={requirementForm.syif} onChange={(e) => setRequirementForm({ ...requirementForm, syif: e.target.value })}><option value="Pagi">Pagi ({shiftTimeLabel('Pagi')})</option><option value="Petang">Petang ({shiftTimeLabel('Petang')})</option><option value="Malam">Malam ({shiftTimeLabel('Malam')})</option><option value="Office Hour">Office Hour ({shiftTimeLabel('Office Hour')})</option></Select></Field>
                <Field label="Bilangan pengawal"><Input type="number" min="0" value={requirementForm.bilangan_diperlukan} onChange={(e) => setRequirementForm({ ...requirementForm, bilangan_diperlukan: e.target.value })} /></Field>
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={requirementForm.status_aktif} onChange={(e) => setRequirementForm({ ...requirementForm, status_aktif: e.target.checked })} /> Aktif untuk liputan</label>
              <Button disabled={saving}>Simpan keperluan</Button>
            </form>
            <p className="mt-3 text-sm">Keperluan ini menentukan berapa orang perlu dijadualkan untuk setiap pos dan syif. Aktif sekarang: {requirements.filter((item) => item.status_aktif).length} tetapan.</p>
          </Card>

          {isAdmin && selectedWeekId && <Card title="Import / Rujukan">
            <form onSubmit={(e) => uploadScheduleFile(e, 'csv')} className="mb-4 space-y-2">
              <Field label="CSV jadual"><Input type="file" accept=".csv,text/csv" onChange={(e) => setImportFile(e.target.files?.[0] || null)} /></Field>
              <Button disabled={saving}><Upload size={16} /> Import CSV</Button>
            </form>
            <form onSubmit={(e) => uploadScheduleFile(e, 'pdf')} className="space-y-2">
              <Field label="PDF rujukan"><Input type="file" accept=".pdf,application/pdf" onChange={(e) => setPdfFile(e.target.files?.[0] || null)} /></Field>
              <Button variant="ghost" disabled={saving}><Upload size={16} /> Muat naik PDF</Button>
            </form>
          </Card>}
          </div>}
        </div>

        {scheduleView === 'assignments' && <div className="space-y-5">
          {coverage && <details className="workspace-disclosure ops-coverage-disclosure"><summary><Users size={16} className="inline mr-2"/>Ringkasan liputan · {coverage.shortage} kekurangan</summary><Card title="Ringkasan Liputan"><p className="mb-4 workspace-note">Tarikh: {quickDate} · Keperluan dan kehadiran untuk hari dipilih.</p>
            <dl className="workspace-coverage-stats">{[['Keperluan',coverage.totalRequired],['Ditugaskan',coverage.totalAssigned],['Kekurangan',coverage.shortage],['Sedang hadir',coverage.activeDutyCount],['Tidak hadir',coverage.absentGuardCount]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
            {coverage.uncoveredPosts?.length > 0 && <AlertMessage>{coverage.uncoveredPosts.length} kombinasi pos/syif belum mempunyai pengawal.</AlertMessage>}
          </Card></details>}

          {coverage && <Card title="Keperluan Pos & Tugasan Pengawal">
            <div className="ops-search-row mb-4"><Search size={18}/><Input aria-label="Cari pos atau bangunan" placeholder="Cari pos atau bangunan..." value={postSearch} onChange={e=>{setPostSearch(e.target.value);setPostPage(1);}}/></div>
            <Field label="Bangunan"><Select value={buildingFilter} onChange={e=>{setBuildingFilter(e.target.value);setPostPage(1);}}><option value="">Semua bangunan</option>{[...new Set(meta.posts.map(p=>p.nama_bangunan).filter(Boolean))].sort().map(b=><option key={b}>{b}</option>)}</Select></Field>
            <p className="mb-4 workspace-note">Pilih tarikh, kemudian tugaskan pengawal pada pos yang bertanda “Perlu tambah”.</p>
            <div className="my-3 max-w-xs">              <Field label="Tarikh tugasan"><Input type="date" min={start} max={end} value={quickDate} onChange={(e) => setQuickDate(e.target.value)} /></Field></div>
            <details className="workspace-disclosure mb-4"><summary><Search size={14} className="inline mr-2"/>Penapis pos, syif & liputan</summary><div className="grid gap-3 sm:grid-cols-3">
              <Field label="Cari ikut pos"><Select value={assignmentFilters.post} onChange={(e) => setAssignmentFilters({ ...assignmentFilters, post: e.target.value })}><option value="">Semua pos</option>{meta.posts.map((post) => <option key={post.id_pos} value={post.id_pos}>{post.nama_pos}</option>)}</Select></Field>
              <Field label="Syif dan masa"><Select value={assignmentFilters.shift} onChange={(e) => setAssignmentFilters({ ...assignmentFilters, shift: e.target.value })}><option value="">Semua syif</option><option value="Pagi">Pagi ({shiftTimeLabel('Pagi')})</option><option value="Petang">Petang ({shiftTimeLabel('Petang')})</option><option value="Malam">Malam ({shiftTimeLabel('Malam')})</option><option value="Office Hour">Office Hour ({shiftTimeLabel('Office Hour')})</option></Select></Field>
              <Field label="Paparan"><Select value={assignmentFilters.status} onChange={(e) => setAssignmentFilters({ ...assignmentFilters, status: e.target.value })}><option value="need">Perlu tambah</option><option value="complete">Cukup lengkap</option><option value="all">Semua</option></Select></Field>
            </div></details>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <p className="text-secondary-token">{assignmentRows.length} pos/syif dipaparkan. Fokus utama ialah pos yang belum cukup pengawal.</p>
              <Button variant="ghost" onClick={() => {setAssignmentFilters({ post: '', shift: '', status: 'need' });setPostSearch('');setBuildingFilter('');setPostPage(1);}}>Reset penapis</Button>
            </div>
            <div className="space-y-3 ops-post-list">
              {assignmentRows.length ? visiblePostRows.map((row) => {
                const shortage = Math.max(0, Number(row.required) - Number(row.assigned));
                const isCovered = shortage === 0;
                return (
                  <details key={row.id_pos+'-'+row.syif} className="ops-post-record">
                    <summary><MapPin size={19}/><span className="ops-record-heading"><strong>{row.nama_pos}</strong><small><CalendarDays size={12}/>{row.syif} · {shiftTimeLabel(row.syif)}</small></span><span className="ops-post-count"><Users size={14}/>{row.assigned}/{row.required}<small>{isCovered?'Cukup':shortage+' lagi'}</small></span><ChevronDown size={17} className="ops-chevron"/></summary>
                    <div className="ops-record-body">
                    <p className="mt-4"><strong>{row.assigned} / {row.required}</strong> pengawal ditugaskan{shortage > 0 && <span className="text-amber-800"> · Perlu {shortage} lagi</span>}</p>
                    {row.assignments?.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        <p className="label-caps">Pengawal ditugaskan</p>
                        {row.assignments.map((guard) => (
                          <div key={guard.id_jadual} className="rounded-md border bg-white p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="font-medium text-primary-token">{guard.nama_penuh}</p>
                                <p className="text-data">{guard.tarikh_tugas?.slice(0, 10)} - {guard.masa_mula?.slice(0, 5)} hingga {guard.masa_tamat?.slice(0, 5)}</p>
                              </div>
                              <Badge tone={statusTone(guard.status_bertugas)}>{guard.status_bertugas}</Badge>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Button variant="ghost" onClick={() => openAssignment({ ...guard, id_pos: row.id_pos, syif: row.syif })} disabled={lockedForChief}>Edit</Button>
                              <Button variant="danger" onClick={() => setDeleteTarget(guard)} disabled={lockedForChief}>Padam</Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <p className="mt-3 rounded-md border border-dashed bg-white p-3 text-secondary-token">Belum ada pengawal ditugaskan untuk pos dan syif ini.</p>}
                    <Button className="mt-3 w-full justify-center sm:w-auto" variant={shortage ? 'primary' : 'ghost'} onClick={() => openAssignmentForRequirement(row)} disabled={!selectedWeekId || lockedForChief}>{shortage ? 'Tugaskan pengawal sekarang' : 'Tambah pengawal lain'}</Button>
                    </div>
                  </details>
                );
              }) : <EmptyState title="Tiada pos untuk paparan ini" description="Cuba pilih Semua atau tukar penapis pos/syif." />}
            </div>
            <Pagination page={visiblePostPage} totalPages={postPages} onPageChange={setPostPage} />
          </Card>}
        </div>}
      </div>

      <ConfirmModal open={Boolean(deleteTarget)} title="Padam tugasan?" message={deleteTarget ? 'Padam tugasan ' + deleteTarget.nama_penuh + ' pada ' + deleteTarget.tarikh_tugas?.slice(0,10) + '?' : ''} confirmLabel="Padam tugasan" danger pending={saving} onCancel={() => setDeleteTarget(null)} onConfirm={() => deleteAssignment(deleteTarget.id_jadual)} />
      {assignmentForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(0,0,0,0.55)] p-0 sm:items-center sm:p-4">
          <div className="app-elevated motion-sheet max-h-[92vh] w-full overflow-y-auto rounded-t-lg border p-4 shadow-xl sm:max-w-2xl sm:rounded-lg">
            <div className="mb-4 flex justify-between gap-3">
              <div><h2>{assignmentForm.id_jadual ? 'Edit Tugasan' : 'Tambah Tugasan'}</h2><p className="text-sm">Semak konflik sebelum simpan tugasan.</p></div>
              <Button variant="ghost" onClick={() => setAssignmentForm(null)}><X size={16} /> Tutup</Button>
            </div>
            <form onSubmit={saveAssignment} onChangeCapture={() => setConflict(null)} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Tarikh"><Input type="date" required min={start} max={end} value={assignmentForm.tarikh_tugas} onChange={(e) => setAssignmentForm({ ...assignmentForm, tarikh_tugas: e.target.value })} /></Field>
                <Field label="Syif"><Select value={assignmentForm.syif} onChange={(e) => {
                  const times = shiftTimes[e.target.value] || shiftTimes.Pagi;
                  setAssignmentForm({ ...assignmentForm, syif: e.target.value, masa_mula: times.start, masa_tamat: times.end });
                }}><option value="Pagi">Pagi ({shiftTimeLabel('Pagi')})</option><option value="Petang">Petang ({shiftTimeLabel('Petang')})</option><option value="Malam">Malam ({shiftTimeLabel('Malam')})</option><option value="Office Hour">Office Hour ({shiftTimeLabel('Office Hour')})</option></Select></Field>
                <Field label="Masa mula"><Input type="time" required value={assignmentForm.masa_mula} onChange={(e) => setAssignmentForm({ ...assignmentForm, masa_mula: e.target.value })} /></Field>
                <Field label="Masa tamat"><Input type="time" required value={assignmentForm.masa_tamat} onChange={(e) => setAssignmentForm({ ...assignmentForm, masa_tamat: e.target.value })} /></Field>
              </div>
              <Field label="Pos kawalan"><Select required value={assignmentForm.id_pos} onChange={(e) => setAssignmentForm({ ...assignmentForm, id_pos: e.target.value })}><option value="">Pilih pos</option>{meta.posts.map((post) => <option key={post.id_pos} value={post.id_pos}>{post.nama_pos}</option>)}</Select></Field>
              <Field label="Pengawal"><Select required value={assignmentForm.id_pengguna} onChange={(e) => setAssignmentForm({ ...assignmentForm, id_pengguna: e.target.value })}><option value="">Pilih pengawal</option>{meta.guards.map((guard) => <option key={guard.id_pengguna} value={guard.id_pengguna}>{guard.nama_penuh}</option>)}</Select></Field>
              <Field label="Catatan"><Textarea rows={3} value={assignmentForm.catatan} onChange={(e) => setAssignmentForm({ ...assignmentForm, catatan: e.target.value })} /></Field>
              {conflict?.critical?.length > 0 && <AlertMessage>{conflict.critical.join('. ')}</AlertMessage>}
              {conflict?.ok && <AlertMessage type="success">Tiada konflik kritikal dikesan.</AlertMessage>}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="ghost" disabled={saving} onClick={() => checkConflict().catch(error => notifyError(error, 'Semakan konflik gagal'))}>Semak konflik</Button>
                <Button disabled={saving || conflict?.critical?.length}>{saving ? 'Menyimpan...' : 'Simpan tugasan'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
