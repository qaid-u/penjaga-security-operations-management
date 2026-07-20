import { useCallback, useEffect, useMemo, useState } from 'react';
import { Upload, X } from 'lucide-react';
import api from '../api/axios';
import { ROLE, notifyError, notifySuccess, shiftTimes, shiftTimeLabel, statusTone } from '../utils/helpers';
import { PageHeader, Card, AlertMessage, Button, StatCard, Field, Select, Input, Badge, Textarea, EmptyState } from '../components/ui';

export function SchedulePage({ auth }) {
  const canManage = [ROLE.admin, ROLE.chief].includes(auth.user?.nama_peranan);
  const isAdmin = auth.user?.nama_peranan === ROLE.admin;
  const today = new Date().toISOString().slice(0, 10);
  const [meta, setMeta] = useState({ posts: [], guards: [] });
  const [selectedWeekId, setSelectedWeekId] = useState('');
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [coverage, setCoverage] = useState(null);
  const [requirements, setRequirements] = useState([]);
  const [mySchedule, setMySchedule] = useState([]);
  const [requirementForm, setRequirementForm] = useState({ id_pos: '', syif: 'Pagi', bilangan_diperlukan: 1, status_aktif: true });
  const [quickDate, setQuickDate] = useState(today);
  const [assignmentFilters, setAssignmentFilters] = useState({ post: '', shift: '', status: 'need' });
  const [assignmentForm, setAssignmentForm] = useState(null);
  const [conflict, setConflict] = useState(null);
  const [importFile, setImportFile] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadMeta = useCallback(() => api.get('/meta').then((res) => setMeta(res.data)), []);
  const loadWeeks = useCallback(() => api.get('/jadual/mingguan').then((res) => {
    setSelectedWeekId((current) => current || String(res.data[0]?.id_jadual_mingguan || ''));
  }), []);
  const loadWeekData = useCallback(async () => {
    if (!selectedWeekId) return;
    const [week, summary] = await Promise.all([
      api.get(`/jadual/mingguan/${selectedWeekId}`),
      api.get(`/jadual/mingguan/${selectedWeekId}/coverage-summary`),
    ]);
    setSelectedWeek(week.data);
    setCoverage(summary.data);
  }, [selectedWeekId]);
  const loadMySchedule = useCallback(() => api.get('/jadual/my-schedule').then((res) => setMySchedule(res.data)), []);
  const loadRequirements = useCallback(() => api.get('/jadual/keperluan-pos').then((res) => setRequirements(res.data)), []);

  useEffect(() => { loadMeta(); }, [loadMeta]);
  useEffect(() => { if (canManage) loadRequirements(); }, [canManage, loadRequirements]);
  useEffect(() => { canManage ? loadWeeks() : loadMySchedule(); }, [canManage, loadWeeks, loadMySchedule]);
  useEffect(() => {
    if (!canManage || !selectedWeekId) return;
    Promise.all([
      api.get(`/jadual/mingguan/${selectedWeekId}`),
      api.get(`/jadual/mingguan/${selectedWeekId}/coverage-summary`),
    ]).then(([week, summary]) => {
      setSelectedWeek(week.data);
      setCoverage(summary.data);
    });
  }, [canManage, selectedWeekId]);

  const assignmentRows = useMemo(() => {
    const rows = coverage?.coverageByPost || [];
    return rows.filter((row) => {
      const shortage = Math.max(0, Number(row.required) - Number(row.assigned));
      const matchesPost = !assignmentFilters.post || String(row.id_pos) === String(assignmentFilters.post);
      const matchesShift = !assignmentFilters.shift || row.syif === assignmentFilters.shift;
      const matchesStatus = assignmentFilters.status === 'all' || (assignmentFilters.status === 'need' ? shortage > 0 : shortage === 0);
      return matchesPost && matchesShift && matchesStatus;
    });
  }, [assignmentFilters, coverage]);

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
    const result = await checkConflict();
    if (result && !result.ok) return notifyError({ message: result.critical.join('. ') }, 'Konflik jadual dikesan');
    setSaving(true);
    try {
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
    try {
      await api.delete(`/jadual/assignments/${id}`);
      notifySuccess('Tugasan jadual dipadam');
      await loadWeekData();
    } catch (error) {
      notifyError(error, 'Tugasan jadual gagal dipadam');
    }
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
          {mySchedule.length ? mySchedule.map((item) => {
            const dutyDate = item.tarikh_tugas?.slice(0, 10);
            const canCheckIn = dutyDate === today && !item.masa_check_in;
            const canCheckOut = dutyDate === today && item.masa_check_in && !item.masa_check_out;
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
      <PageHeader title="Pengurusan Jadual Bertugas Berasaskan Templat Mingguan" description="Rancang jadual mingguan mengikut tarikh, syif, pos dan pengawal tanpa algoritma automatik." />
      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-5">
          {selectedWeek && <Card title="Status Jadual Semasa">
            <div className="space-y-2 text-sm">
              <Badge tone={statusTone(selectedWeek.status_jadual)}>{selectedWeek.status_jadual}</Badge>
              <p>{selectedWeek.tarikh_mula?.slice(0, 10)} hingga {selectedWeek.tarikh_tamat?.slice(0, 10)}</p>
              {selectedWeek.catatan && <p>{selectedWeek.catatan}</p>}
              <div className="flex flex-wrap gap-2">
                {isAdmin && <Button variant="ghost" onClick={() => updateWeekStatus('confirm')}>Sahkan</Button>}
                {isAdmin && <Button variant="ghost" onClick={() => updateWeekStatus('lock')}>Kunci</Button>}
                {isAdmin && <Button variant="ghost" onClick={() => updateWeekStatus('unlock')}>Buka Kunci</Button>}
              </div>
              {lockedForChief && <AlertMessage>Jadual dikunci. Ketua tidak boleh mengubah tugasan sehingga Admin membuka kunci.</AlertMessage>}
            </div>
          </Card>}

          <Card title="Tetapan Keperluan Pos">
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
        </div>

        <div className="space-y-5">
          {coverage && <Card title="Ringkasan Liputan">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <StatCard label="Keperluan" value={coverage.totalRequired} />
              <StatCard label="Ditugaskan" value={coverage.totalAssigned} />
              <StatCard label="Kekurangan" value={coverage.shortage} />
              <StatCard label="Sedang Hadir" value={coverage.activeDutyCount} />
              <StatCard label="Tidak Hadir" value={coverage.absentGuardCount} />
            </div>
            {coverage.uncoveredPosts?.length > 0 && <AlertMessage>{coverage.uncoveredPosts.length} kombinasi pos/syif belum mempunyai pengawal.</AlertMessage>}
          </Card>}

          {coverage && <Card title="Keperluan Pos & Tugasan Pengawal">
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">Cara guna ringkas</p>
              <p>1. Pilih tarikh tugasan. 2. Semak pos yang bertanda Perlu tambah. 3. Klik Tugaskan pengawal dan pilih nama pengawal.</p>
            </div>
            <div className="mb-4 grid gap-3 rounded-lg border bg-white p-3 md:grid-cols-[180px_1fr_160px_170px]">
              <Field label="Tarikh tugasan"><Input type="date" value={quickDate} onChange={(e) => setQuickDate(e.target.value)} /></Field>
              <Field label="Cari ikut pos"><Select value={assignmentFilters.post} onChange={(e) => setAssignmentFilters({ ...assignmentFilters, post: e.target.value })}><option value="">Semua pos</option>{meta.posts.map((post) => <option key={post.id_pos} value={post.id_pos}>{post.nama_pos}</option>)}</Select></Field>
              <Field label="Syif dan masa"><Select value={assignmentFilters.shift} onChange={(e) => setAssignmentFilters({ ...assignmentFilters, shift: e.target.value })}><option value="">Semua syif</option><option value="Pagi">Pagi ({shiftTimeLabel('Pagi')})</option><option value="Petang">Petang ({shiftTimeLabel('Petang')})</option><option value="Malam">Malam ({shiftTimeLabel('Malam')})</option><option value="Office Hour">Office Hour ({shiftTimeLabel('Office Hour')})</option></Select></Field>
              <Field label="Paparan"><Select value={assignmentFilters.status} onChange={(e) => setAssignmentFilters({ ...assignmentFilters, status: e.target.value })}><option value="need">Perlu tambah</option><option value="complete">Cukup lengkap</option><option value="all">Semua</option></Select></Field>
            </div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <p className="text-secondary-token">{assignmentRows.length} pos/syif dipaparkan. Fokus utama ialah pos yang belum cukup pengawal.</p>
              <Button variant="ghost" onClick={() => setAssignmentFilters({ post: '', shift: '', status: 'need' })}>Reset penapis</Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {assignmentRows.length ? assignmentRows.map((row) => {
                const shortage = Math.max(0, Number(row.required) - Number(row.assigned));
                const isCovered = shortage === 0;
                return (
                  <div key={`${row.id_pos}-${row.syif}`} className={`rounded-lg border p-4 text-sm shadow-sm ${isCovered ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-base font-semibold text-primary-token">{row.nama_pos}</p>
                        <p className="text-secondary-token">Syif {row.syif}</p>
                        <p className="mt-1 inline-flex rounded-md bg-white px-2 py-1 text-xs font-semibold text-primary-token">Masa {shiftTimeLabel(row.syif)}</p>
                      </div>
                      <Badge tone={isCovered ? 'Low' : 'Medium'}>{isCovered ? 'Cukup' : 'Perlu tambah'}</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-md bg-white p-2"><p className="text-lg font-bold text-primary-token">{row.required}</p><p className="text-xs text-secondary-token">Perlu</p></div>
                      <div className="rounded-md bg-white p-2"><p className="text-lg font-bold text-primary-token">{row.assigned}</p><p className="text-xs text-secondary-token">Ada</p></div>
                      <div className="rounded-md bg-white p-2"><p className={`text-lg font-bold ${shortage ? 'text-amber-700' : 'text-green-700'}`}>{shortage}</p><p className="text-xs text-secondary-token">Kurang</p></div>
                    </div>
                    {shortage > 0 && <AlertMessage>Tambah {shortage} pengawal untuk lengkapkan pos ini.</AlertMessage>}
                    {row.assigned_guards?.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        <p className="label-caps">Pengawal ditugaskan</p>
                        {row.assigned_guards.map((guard) => (
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
                              <Button variant="danger" onClick={() => deleteAssignment(guard.id_jadual)} disabled={lockedForChief}>Padam</Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <p className="mt-3 rounded-md border border-dashed bg-white p-3 text-secondary-token">Belum ada pengawal ditugaskan untuk pos dan syif ini.</p>}
                    <Button className="mt-3 w-full justify-center sm:w-auto" variant={shortage ? 'primary' : 'ghost'} onClick={() => openAssignmentForRequirement(row)} disabled={!selectedWeekId || lockedForChief}>{shortage ? 'Tugaskan pengawal sekarang' : 'Tambah pengawal lain'}</Button>
                  </div>
                );
              }) : <EmptyState title="Tiada pos untuk paparan ini" description="Cuba pilih Semua atau tukar penapis pos/syif." />}
            </div>
          </Card>}
        </div>
      </div>

      {assignmentForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(0,0,0,0.55)] p-0 sm:items-center sm:p-4">
          <div className="app-elevated motion-sheet max-h-[92vh] w-full overflow-y-auto rounded-t-lg border p-4 shadow-xl sm:max-w-2xl sm:rounded-lg">
            <div className="mb-4 flex justify-between gap-3">
              <div><h2>{assignmentForm.id_jadual ? 'Edit Tugasan' : 'Tambah Tugasan'}</h2><p className="text-sm">Semak konflik sebelum simpan tugasan.</p></div>
              <Button variant="ghost" onClick={() => setAssignmentForm(null)}><X size={16} /> Tutup</Button>
            </div>
            <form onSubmit={saveAssignment} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Tarikh"><Input type="date" required value={assignmentForm.tarikh_tugas} onChange={(e) => setAssignmentForm({ ...assignmentForm, tarikh_tugas: e.target.value })} /></Field>
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
                <Button type="button" variant="ghost" onClick={() => checkConflict()}>Semak konflik</Button>
                <Button disabled={saving || conflict?.critical?.length}>{saving ? 'Menyimpan...' : 'Simpan tugasan'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
