import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Upload, MapPin, Search, ChevronDown, CalendarDays, Users, SlidersHorizontal, Plus, CheckCircle2, CircleAlert, Clock3, LockKeyhole, Sun, Sunset, Moon, BriefcaseBusiness, Pencil, Trash2, History } from 'lucide-react';
import api from '../api/axios';
import { ROLE, notifyError, notifySuccess, shiftTimes, shiftTimeLabel, statusTone } from '../utils/helpers';
import { PageHeader, Card, AlertMessage, Button, Field, Select, Input, Badge, EmptyState, LoadingState, ConfirmModal, Pagination } from '../components/ui';
import ScheduleAssignmentDialog from '../components/ScheduleAssignmentDialog';
import ScheduleCopyDialog from '../components/ScheduleCopyDialog';
import ScheduleDailyAssignments from '../components/ScheduleDailyAssignments';
import './schedule.css';

const shiftIcons = { Pagi: Sun, Petang: Sunset, Malam: Moon, 'Office Hour': BriefcaseBusiness };
const dateLabel = (value, options = { day: 'numeric', month: 'long', year: 'numeric' }) => value ? new Intl.DateTimeFormat('ms-MY', { ...options, timeZone: 'Asia/Kuala_Lumpur' }).format(new Date(value.slice(0, 10) + 'T12:00:00+08:00')) : '';
const shiftOrder = ['Pagi', 'Petang', 'Malam', 'Office Hour'];
const assignmentChanges = {
  CREATE_ASSIGNMENT: { label: 'Ditambah', tone: 'Low', Icon: Plus },
  UPDATE_ASSIGNMENT: { label: 'Disunting', tone: 'Medium', Icon: Pencil },
  DELETE_ASSIGNMENT: { label: 'Dipadam', tone: 'High', Icon: Trash2 },
};
const changeTime = new Intl.DateTimeFormat('ms-MY', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kuala_Lumpur' });

function AssignmentChangeLabel({ action, actor }) {
  const entry = assignmentChanges[action];
  if (!entry || !actor?.role) return null;
  const { label, tone, Icon } = entry;
  return <Badge tone={tone}><span className="inline-flex items-center gap-1"><Icon size={12} aria-hidden="true" />{label} oleh {actor.role}</span></Badge>;
}

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
  const [assignmentFilters, setAssignmentFilters] = useState({ shift: '', status: 'all' });
  const [assignmentForm, setAssignmentForm] = useState(null);
  const [conflict, setConflict] = useState(null);
  const [importFile, setImportFile] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [dailyOpen, setDailyOpen] = useState(false);

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
  const weekOverview = useQuery({
    queryKey: ['schedule-week-overview', selectedWeekId],
    queryFn: async ({ signal }) => (await api.get('/jadual/mingguan/' + selectedWeekId + '/coverage-summary', { signal, params: { overview: 'week' } })).data,
    enabled: canManage && Boolean(selectedWeekId),
  });
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
  const loadWeekData = () => Promise.all([weekQuery.refetch(), coverageQuery.refetch(), weekOverview.refetch()]);
  const loadRequirements = () => requirementsQuery.refetch();
  const loadMySchedule = () => myScheduleQuery.refetch();
  const loading = queries.some(query => query.isLoading);
  const errorNotice = hasError && <AlertMessage>Data jadual belum dapat dimuatkan. <button type="button" className="underline" onClick={retry}>Cuba lagi</button></AlertMessage>;

  const postGroups = useMemo(() => {
    const rows = [...(coverage?.coverageByPost || [])];
    // Assignments without a minimum requirement must remain visible after saving.
    const configured = new Set(rows.map(row => row.id_pos + ':' + row.syif));
    const extraRows = new Map();
    for (const assignment of coverage?.coverage || coverage?.details || []) {
      const key = assignment.id_pos + ':' + assignment.syif;
      if (configured.has(key)) continue;
      const row = extraRows.get(key) || { id_pos: assignment.id_pos, nama_pos: assignment.nama_pos || meta.posts.find(post => String(post.id_pos) === String(assignment.id_pos))?.nama_pos, syif: assignment.syif, required: 0, assigned: 0, assignments: [] };
      row.assignments.push(assignment);
      row.assigned++;
      extraRows.set(key,row);
    }
    rows.push(...extraRows.values());
    const groups = new Map();
    rows.forEach((row) => {
      const matchesShift = !assignmentFilters.shift || row.syif === assignmentFilters.shift;
      const post = meta.posts.find(p => String(p.id_pos) === String(row.id_pos));
      const matchesBuilding = !buildingFilter || post?.nama_bangunan === buildingFilter;
      const matchesSearch = !postSearch.trim() || [row.nama_pos,post?.nama_bangunan].join(' ').toLowerCase().includes(postSearch.trim().toLowerCase());
      if (!matchesShift || !matchesBuilding || !matchesSearch) return;
      const group = groups.get(String(row.id_pos)) || { id_pos: row.id_pos, name: row.nama_pos, building: post?.nama_bangunan, rows: [], shortage: 0, assigned: 0, required: 0 };
      group.rows.push(row);
      group.shortage += Math.max(0, Number(row.required) - Number(row.assigned));
      group.assigned += Number(row.assigned);
      group.required += Number(row.required);
      groups.set(String(row.id_pos), group);
    });
    return [...groups.values()].filter(group => assignmentFilters.status === 'all' || (assignmentFilters.status === 'need' ? group.shortage > 0 : group.shortage === 0)).map(group => ({ ...group, rows: group.rows.sort((a,b) => shiftOrder.indexOf(a.syif) - shiftOrder.indexOf(b.syif)) }));
  }, [assignmentFilters, coverage, meta.posts, buildingFilter, postSearch]);
  const postPages = Math.max(1, Math.ceil(postGroups.length/6));
  const visiblePostPage = Math.min(postPage,postPages);
  const visiblePosts = postGroups.slice((visiblePostPage-1)*6,visiblePostPage*6);
  const weekDays = [];
  if (start && end) {
    for (let value = new Date(start + 'T12:00:00Z'); value.toISOString().slice(0,10) <= end && weekDays.length < 7; value.setUTCDate(value.getUTCDate()+1)) weekDays.push(value.toISOString().slice(0,10));
  }
  const resetFilters = () => { setAssignmentFilters({ shift: '', status: 'all' }); setPostSearch(''); setBuildingFilter(''); setPostPage(1); };

  const openAssignment = (assignment = null) => {
    const baseDate = quickDate;
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
      if (result && !result.ok) return;
      if (assignmentForm.id_jadual) await api.put(`/jadual/assignments/${assignmentForm.id_jadual}`, assignmentForm);
      else await api.post(`/jadual/mingguan/${selectedWeekId}/assignments`, assignmentForm);
      notifySuccess('Tugasan jadual disimpan');
      setAssignmentForm(null);
      await loadWeekData();
    } catch (error) {
      setConflict({
        error: error.response?.data?.message || 'Tugasan belum dapat disimpan. Cuba lagi sebentar lagi.',
        conflict: error.response?.data?.conflict,
      });
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
    const next = mySchedule.find(item => item.can_check_out) ||
      mySchedule.find(item => item.upcoming !== false && !item.masa_check_out);
    const duties = next ? [next, ...mySchedule.filter(item => item !== next)] : mySchedule;
    return (
      <div className="schedule-page schedule-own space-y-5">
        <PageHeader title="Jadual Bertugas Saya" description="Semak bila dan di mana anda bertugas. Daftar kehadiran apabila syif bermula." />
        <Card title="Tugasan Saya">
          {errorNotice}
          {loading ? <LoadingState message="Memuatkan tugasan..." /> : hasError ? null : duties.length ? duties.map((item) => {
            const dutyDate = item.tarikh_tugas?.slice(0, 10);
            const canCheckIn = item.can_check_in;
            const canCheckOut = item.can_check_out;
            return (
              <div key={item.id_jadual} className={'schedule-own-duty app-row mb-3 rounded-xl border p-4 text-sm' + (canCheckIn || canCheckOut ? ' schedule-own-current' : '')}>
                {item === next && <p className="mb-2 font-semibold text-primary-token">{canCheckOut ? 'Sedang bertugas' : 'Tugasan seterusnya'}</p>}
                <p className="schedule-own-date"><CalendarDays size={15} aria-hidden="true"/>{dateLabel(dutyDate, {weekday:'long',day:'numeric',month:'long'})}{dutyDate === today && <span>Hari ini</span>}</p>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="schedule-own-post"><MapPin size={17} aria-hidden="true"/>{item.nama_pos}</p>
                    <p>{item.nama_bangunan || item.lokasi || '-'}</p>
                    <p className="schedule-own-time"><Clock3 size={14} aria-hidden="true"/>{item.syif} · {item.masa_mula?.slice(0, 5)} – {item.masa_tamat?.slice(0, 5)}{item.masa_tamat < item.masa_mula && ' (esok)'}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {item.status_jadual === 'Draf' && <Badge tone="Medium">Draf</Badge>}
                    <Badge tone={statusTone(item.status_bertugas)}>{item.status_kehadiran || item.status_bertugas}</Badge>
                    <AssignmentChangeLabel action={item.change_action} actor={{ role: item.changed_by_role }} />
                  </div>
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
    <div className="desktop-ops schedule-page space-y-5">
      <PageHeader title="Jadual bertugas" description="Pilih hari, buka pos, kemudian tugaskan pengawal." />
      {errorNotice}
      {loading && <LoadingState message="Memuatkan jadual..." />}
      {!weeksQuery.isPending && !weeksQuery.isError && !weeks.length && <EmptyState title="Tiada minggu jadual" description="Minggu jadual belum disediakan dalam sistem." />}
      <div className="schedule-week-picker"><CalendarDays size={22} aria-hidden="true"/><Field label="Minggu jadual"><Select value={selectedWeekId} onChange={event => {
        const week = weeks.find(item => String(item.id_jadual_mingguan) === event.target.value);
        setSelectedWeekId(event.target.value);
        if (week?.tarikh_mula) setQuickDate(week.tarikh_mula.slice(0, 10));
        setPostPage(1);
      }}><option value="" disabled>Pilih minggu</option>{weeks.map(week => <option key={week.id_jadual_mingguan} value={week.id_jadual_mingguan}>{dateLabel(week.tarikh_mula, {day:'numeric',month:'short'})} – {dateLabel(week.tarikh_tamat)} · {week.status_jadual}</option>)}</Select></Field>{selectedWeek && <Badge tone={statusTone(selectedWeek.status_jadual)}>{selectedWeek.status_jadual}</Badge>}</div>
      <div className="workspace-tabs schedule-tabs" aria-label="Paparan jadual"><button aria-pressed={scheduleView === 'assignments'} onClick={() => setScheduleView('assignments')}><CalendarDays size={16} aria-hidden="true"/> Tugasan & liputan</button><button aria-pressed={scheduleView === 'settings'} onClick={() => setScheduleView('settings')}><SlidersHorizontal size={16} aria-hidden="true"/> Tetapan & import</button></div>
      {lockedForChief && <div className="schedule-lock"><LockKeyhole size={18} aria-hidden="true"/><p>Jadual dikunci. Anda boleh menyemak tugasan. Hubungi Admin untuk membuat perubahan.</p></div>}
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

        {scheduleView === 'assignments' && selectedWeek && <div className="space-y-4">
          <section className="schedule-calendar" aria-label="Hari bertugas">
            <div className="schedule-date-heading"><div><span className="schedule-caption">Jadual harian</span><h2>{dateLabel(quickDate, {weekday:'long', day:'numeric', month:'long'})}</h2></div><Field label="Tarikh tugasan"><Input type="date" min={start} max={end} value={quickDate} onChange={e => {setQuickDate(e.target.value);setPostPage(1);}} /></Field></div>
            <div className="schedule-day-strip">
              {weekDays.map(day => {
                const shortage = weekOverview.data?.hasRequirements ? weekOverview.data.days?.find(item => item.date === day)?.shortage : undefined;
                return (
                  <button key={day} type="button" aria-pressed={quickDate === day}
                    aria-label={dateLabel(day, { weekday: 'long', day: 'numeric', month: 'long' })}
                    aria-describedby={shortage !== undefined ? 'gap-' + day : undefined}
                    onClick={() => {
                      setQuickDate(day);
                      resetFilters();
                      if (shortage > 0) setAssignmentFilters({ shift: '', status: 'need' });
                    }}>
                    <span>{dateLabel(day, { weekday: 'short' })}</span>
                    <strong>{Number(day.slice(8,10))}</strong>
                    <span>{day === today ? 'Hari ini' : dateLabel(day, { month: 'short' })}</span>
                    {shortage !== undefined && <span id={'gap-' + day} className="schedule-day-gap">{shortage > 0 ? shortage + ' kosong' : 'Lengkap'}</span>}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <small className="text-secondary-token">
                {weekOverview.data?.hasRequirements ? 'Pilih hari untuk melihat pos yang masih memerlukan pengawal.' : ''}
                {weekOverview.isError && <button type="button" className="underline" onClick={() => weekOverview.refetch()}>Muat semula ringkasan minggu</button>}
              </small>
              <Button type="button" variant="ghost" onClick={() => setCopyOpen(true)}>Salin ke minggu depan</Button>
            </div>
          </section>
          <details className="workspace-disclosure schedule-week-activity">
            <summary><History size={17} aria-hidden="true" /> Sejarah perubahan jadual <ChevronDown size={16} className="ml-auto" aria-hidden="true" /></summary>
            <p className="workspace-note mb-3">Sehingga 20 perubahan terkini untuk minggu dipilih.</p>
            {weekQuery.isLoading ? <p role="status">Memuatkan perubahan…</p>
              : weekQuery.isError ? <AlertMessage>Sejarah perubahan belum dapat dimuatkan.</AlertMessage>
              : selectedWeek.activity?.length ? <ul className="space-y-2">
                {selectedWeek.activity.map(({ id_audit, action, changed_at, change }) => (
                  <li className="schedule-activity-row" key={id_audit}>
                    <AssignmentChangeLabel action={action} actor={change.actor} />
                    <strong>{change.guard} · {change.post}</strong>
                    <small>{dateLabel(change.date)} · {change.shift}</small>
                    <small>{change.actor.name} · <time dateTime={changed_at}>{changeTime.format(new Date(changed_at))}</time></small>
                  </li>
                ))}
              </ul> : <p>Tiada perubahan direkodkan untuk minggu ini.</p>}
          </details>
          {coverage && <>
            <dl className="schedule-overview" aria-label="Ringkasan harian">
              <div><Users size={19} aria-hidden="true"/><dt>Ditugaskan</dt><dd>{coverage.totalAssigned}<small>tugasan</small></dd></div>
              <div className={coverage.shortage > 0 ? 'schedule-shortage' : 'schedule-covered'}>{coverage.shortage > 0 ? <CircleAlert size={19} aria-hidden="true"/> : <CheckCircle2 size={19} aria-hidden="true"/>}<dt>Masih diperlukan</dt><dd>{coverage.shortage}<small>pengawal</small></dd></div>
              <div><CheckCircle2 size={19} aria-hidden="true"/><dt>Sedang hadir</dt><dd>{coverage.activeDutyCount}<small>pengawal</small></dd></div>
            </dl>
            {coverage.shortage > 0 && !lockedForChief && (
              <div className="schedule-quick-fill">
                <div><strong>{coverage.shortage} kekosongan pada tarikh ini</strong><p>Pilih pengawal untuk beberapa pos dan syif sekali gus.</p></div>
                <Button type="button" onClick={() => setDailyOpen(true)} disabled={!meta.guards.length}>
                  <Users size={17} aria-hidden="true" /> Isi kekosongan harian
                </Button>
              </div>
            )}
            <details className="workspace-disclosure ops-coverage-disclosure"><summary>Butiran liputan hari ini <ChevronDown size={15} aria-hidden="true"/></summary><Card title="Ringkasan Liputan"><p className="mb-3 workspace-note">Untuk {dateLabel(quickDate)} di semua pos dan syif.</p><dl className="workspace-coverage-stats">{[['Keperluan',coverage.totalRequired],['Ditugaskan',coverage.totalAssigned],['Kekurangan',coverage.shortage],['Sedang hadir',coverage.activeDutyCount],['Tidak hadir',coverage.absentGuardCount]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className="mt-3 text-sm">Kekurangan dikira bagi setiap pos dan syif. Lebihan pengawal di satu pos tidak menampung kekurangan di pos lain.</p></Card></details>
            <Card className="schedule-post-browser" title="Pos kawalan" action={<span className="schedule-caption">{postGroups.length} pos</span>}>
              <div className="schedule-find"><div className="ops-search-row"><Search size={18} aria-hidden="true"/><Input aria-label="Cari pos atau bangunan" placeholder="Cari pos atau bangunan" value={postSearch} onChange={e=>{setPostSearch(e.target.value);setPostPage(1);}}/>{postSearch && <button type="button" onClick={() => {setPostSearch('');setPostPage(1);}} aria-label="Kosongkan carian">×</button>}</div><details className="schedule-filters"><summary><SlidersHorizontal size={16} aria-hidden="true"/> Tapis{(buildingFilter || assignmentFilters.shift) && <span className="schedule-filter-dot"/>}<ChevronDown size={14} aria-hidden="true"/></summary><div className="schedule-filter-fields"><Field label="Bangunan"><Select value={buildingFilter} onChange={e=>{setBuildingFilter(e.target.value);setPostPage(1);}}><option value="">Semua bangunan</option>{[...new Set(meta.posts.map(p=>p.nama_bangunan).filter(Boolean))].sort().map(b=><option key={b}>{b}</option>)}</Select></Field><Field label="Syif dan masa"><Select value={assignmentFilters.shift} onChange={e=>{setAssignmentFilters({...assignmentFilters,shift:e.target.value});setPostPage(1);}}><option value="">Semua syif</option>{shiftOrder.map(shift => <option key={shift}>{shift}</option>)}</Select></Field><Button variant="ghost" onClick={resetFilters}>Reset penapis</Button></div></details></div>
              <div className="schedule-status-filter" aria-label="Tapis liputan">{[['all','Semua pos'],['need','Perlu pengawal'],['complete','Lengkap']].map(([value,label]) => <button type="button" key={value} aria-pressed={assignmentFilters.status === value} onClick={() => {setAssignmentFilters({...assignmentFilters,status:value});setPostPage(1);}}>{label}</button>)}</div>
              <p className="schedule-list-hint">Buka pos untuk melihat syif dan pengawal.</p>
              <div key={selectedWeekId+'-'+quickDate} className="ops-post-list schedule-post-list">
                {visiblePosts.map(post => <details key={post.id_pos} name="schedule-posts" className="ops-post-record schedule-post-record">
                  <summary><span className="schedule-post-icon"><MapPin size={20} aria-hidden="true"/></span><span className="ops-record-heading"><strong>{post.name}</strong><small>{post.building ? post.building + ' · ' : ''}{post.rows.length} syif</small></span><span className={'schedule-post-status ' + (post.shortage > 0 ? 'needs-guards' : 'is-covered')}>{post.shortage > 0 ? <CircleAlert size={13} aria-hidden="true"/> : <CheckCircle2 size={13} aria-hidden="true"/>}{post.shortage > 0 ? `Perlu ${post.shortage} lagi` : 'Lengkap'}</span><ChevronDown size={17} className="ops-chevron" aria-hidden="true"/></summary>
                  <div className="schedule-shifts">{post.rows.map(row => {
                    const shortage = Math.max(0,Number(row.required)-Number(row.assigned));
                    const ShiftIcon = shiftIcons[row.syif] || Clock3;
                    return <section className="schedule-shift" key={row.syif} aria-label={post.name+' · '+row.syif}>
                      <div className="schedule-shift-heading"><span className="schedule-shift-icon"><ShiftIcon size={19} aria-hidden="true"/></span><div><h3>{row.syif}</h3><p>{shiftTimeLabel(row.syif)}{row.syif === 'Malam' && ' · tamat esok'}</p></div><span className="schedule-shift-count"><strong>{row.assigned}{Number(row.required) > 0 && <>/{row.required}</>}</strong><small>ditugaskan</small></span></div>
                      {row.assignments?.length > 0 ? <div className="schedule-assigned">{row.assignments.map(guard => (
                        <div className="schedule-guard" key={guard.id_jadual}>
                          <span className="schedule-avatar" aria-hidden="true">{guard.nama_penuh?.trim().slice(0,1)}</span>
                          <div className="schedule-guard-name">
                            <strong>{guard.nama_penuh}</strong>
                            <small>{guard.masa_mula?.slice(0,5)} – {guard.masa_tamat?.slice(0,5)} · {guard.status_bertugas}</small>
                            {guard.changed_by && <div className="mt-1" title={guard.changed_by.name}>
                              <AssignmentChangeLabel action={guard.change_action} actor={guard.changed_by} />
                            </div>}
                          </div>
                          <div className="schedule-guard-actions">
                            <button type="button" title={'Edit '+guard.nama_penuh} aria-label={'Edit '+guard.nama_penuh} disabled={lockedForChief} onClick={() => openAssignment({...guard,id_pos:row.id_pos,syif:row.syif})}><Pencil size={16} aria-hidden="true"/></button>
                            <button type="button" title={'Padam '+guard.nama_penuh} aria-label={'Padam '+guard.nama_penuh} disabled={lockedForChief} onClick={() => setDeleteTarget(guard)}><Trash2 size={16} aria-hidden="true"/></button>
                          </div>
                        </div>
                      ))}</div> : <p className="schedule-no-guards">Belum ada pengawal ditugaskan.</p>}
                      <div className="schedule-shift-footer"><span className={shortage > 0 ? 'schedule-need-text' : 'schedule-complete-text'}>{shortage > 0 ? `Perlu ${shortage} pengawal lagi` : Number(row.required) > 0 ? 'Keperluan syif dipenuhi' : 'Tiada minimum ditetapkan'}</span><Button variant={shortage > 0 ? 'primary' : 'ghost'} disabled={lockedForChief} onClick={() => openAssignmentForRequirement(row)}><Plus size={16} aria-hidden="true"/>{shortage > 0 ? 'Tugaskan pengawal' : 'Tambah pengawal'}</Button></div>
                    </section>;
                  })}</div>
                </details>)}
                {!postGroups.length && <div className="schedule-empty"><Search size={26} aria-hidden="true"/><h3>{coverage.coverageByPost?.length ? 'Tiada pos sepadan' : 'Keperluan pos belum ditetapkan'}</h3><p>{coverage.coverageByPost?.length ? 'Cuba carian lain atau lihat semua pos.' : 'Tetapkan bilangan pengawal bagi pos dan syif untuk mula menyusun tugasan.'}</p><Button variant="ghost" onClick={coverage.coverageByPost?.length ? resetFilters : () => setScheduleView('settings')}>{coverage.coverageByPost?.length ? 'Lihat semua pos' : 'Tetapkan keperluan pos'}</Button></div>}
              </div>
              <Pagination page={visiblePostPage} totalPages={postPages} onPageChange={setPostPage} />
              <div className="schedule-manual-add"><span>Perlu tugasan di luar keperluan pos?</span><Button variant="ghost" disabled={lockedForChief} onClick={() => openAssignment()}><Plus size={15} aria-hidden="true"/>Tambah tugasan</Button></div>
            </Card>
          </>}
        </div>}
      </div>

      <ConfirmModal open={Boolean(deleteTarget)} title="Padam tugasan?" message={deleteTarget ? 'Padam tugasan ' + deleteTarget.nama_penuh + ' pada ' + deleteTarget.tarikh_tugas?.slice(0,10) + '?' : ''} confirmLabel="Padam tugasan" danger pending={saving} onCancel={() => setDeleteTarget(null)} onConfirm={() => deleteAssignment(deleteTarget.id_jadual)} />
      {assignmentForm && <ScheduleAssignmentDialog form={assignmentForm} setForm={setAssignmentForm} posts={meta.posts} guards={meta.guards} start={start} end={end} saving={saving} conflict={conflict} clearConflict={() => setConflict(null)} onSave={saveAssignment} onClose={() => setAssignmentForm(null)} />}
      {dailyOpen && <ScheduleDailyAssignments weekId={selectedWeekId} date={quickDate} dateLabel={dateLabel}
        rows={coverageQuery.data?.coverageByPost || []} guards={meta.guards} onClose={() => setDailyOpen(false)}
        reload={async () => (await coverageQuery.refetch({ throwOnError: true })).data.coverageByPost}
        onSaved={created => {
          setDailyOpen(false);
          notifySuccess(`${created} tugasan harian disimpan.`);
          loadWeekData();
        }} />}
      {copyOpen && <ScheduleCopyDialog weekId={selectedWeekId} dateLabel={dateLabel}
        onClose={() => setCopyOpen(false)}
        onSaved={({ id, start, copied }) => {
          setCopyOpen(false);
          setSelectedWeekId(String(id));
          setQuickDate(start);
          resetFilters();
          loadWeeks();
          notifySuccess(copied + ' tugasan disalin ke draf minggu depan.');
        }} />}
    </div>
  );
}
