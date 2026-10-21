import { useCallback, useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import api from '../api/axios';
import { dateToWeekValue, monthLabel, weekLabel, notifyAction, notifyError, notifySuccess, statusTone } from '../utils/helpers';
import { PageHeader, Card, AlertMessage, Button, Field, Input, Select, Textarea, Badge, EmptyState, LoadingState, ConfirmModal } from '../components/ui';

export function NlpTrainingPage() {
  const [rules, setRules] = useState([]);
  const [reports, setReports] = useState([]);
  const [nlpFilters, setNlpFilters] = useState({ search: '', post: '', shift: '', risk: '', status: '', timeMode: 'all', month: '', week: '' });
  const [pinnedNlpReports, setPinnedNlpReports] = useState([]);
  const [selectedNlp, setSelectedNlp] = useState(null);
  const [edits, setEdits] = useState({});
  const [newRule, setNewRule] = useState({ nama_kategori: '', tahap_keutamaan: 'Low', penerangan_kategori: '', kata_kunci_rujukan: '', status_kategori: 'Aktif' });
  const [saving, setSaving] = useState(null);
  const [confirmDeleteRule, setConfirmDeleteRule] = useState(null);

  const load = useCallback(() => api.get('/nlp-training').then((res) => {
    setRules(res.data);
    setEdits(Object.fromEntries(res.data.map((item) => [item.id_kategori_insiden, {
      nama_kategori: item.nama_kategori,
      tahap_keutamaan: item.tahap_keutamaan,
      penerangan_kategori: item.penerangan_kategori || '',
      kata_kunci_rujukan: (item.kata_kunci_rujukan || []).join(', '),
      status_kategori: item.status_kategori,
    }])));
  }), []);

  const loadReports = useCallback(() => api.get('/reports', { params: { limit: 100 } }).then((res) => setReports(res.data.data)), []);
  useEffect(() => { load(); loadReports(); }, [load, loadReports]);

  const openNlp = async (reportId) => {
    try {
      const { data } = await api.get(`/nlp/${reportId}`);
      setSelectedNlp(data);
      notifyAction('Analisis NLP dibuka');
    } catch (error) {
      notifyError(error, 'Analisis NLP gagal dibuka');
    }
  };

  const updateEdit = (id, patch) => setEdits((current) => ({ ...current, [id]: { ...current[id], ...patch } }));

  const createRule = async (event) => {
    event.preventDefault();
    setSaving('new');
    try {
      await api.post('/nlp-training', newRule);
      setNewRule({ nama_kategori: '', tahap_keutamaan: 'Low', penerangan_kategori: '', kata_kunci_rujukan: '', status_kategori: 'Aktif' });
      notifySuccess('Kategori NLP baharu ditambah');
      load();
    } catch (error) {
      notifyError(error, 'Kategori NLP gagal ditambah');
    } finally {
      setSaving(null);
    }
  };

  const save = async (id) => {
    setSaving(id);
    try {
      const current = edits[id];
      await api.patch(`/nlp-training/${id}`, {
        nama_kategori: current.nama_kategori,
        tahap_keutamaan: current.tahap_keutamaan,
        penerangan_kategori: current.penerangan_kategori,
        kata_kunci_rujukan: current.kata_kunci_rujukan,
        status_kategori: current.status_kategori,
      });
      notifySuccess('Peraturan NLP dikemas kini');
      load();
    } catch (error) {
      notifyError(error, 'Peraturan NLP gagal dikemas kini');
    } finally {
      setSaving(null);
    }
  };

  const deleteRule = async () => {
    if (!confirmDeleteRule) return;
    setSaving(confirmDeleteRule.id_kategori_insiden);
    try {
      const { data } = await api.delete(`/nlp-training/${confirmDeleteRule.id_kategori_insiden}`);
      notifySuccess(data.deactivated ? 'Kategori NLP dinyahaktif kerana sudah digunakan dalam laporan' : 'Kategori NLP dipadam');
      setConfirmDeleteRule(null);
      load();
    } catch (error) {
      notifyError(error, 'Kategori NLP gagal dipadam');
    } finally {
      setSaving(null);
    }
  };

  const filteredNlpReports = reports.filter((report) => {
    const search = nlpFilters.search.trim().toLowerCase();
    const matchesSearch = !search || [report.tajuk_laporan, report.nama_penuh, report.nama_pos].some((value) => String(value || '').toLowerCase().includes(search));
    const matchesPost = !nlpFilters.post || report.nama_pos === nlpFilters.post;
    const matchesShift = !nlpFilters.shift || report.syif === nlpFilters.shift;
    const matchesRisk = !nlpFilters.risk || report.tahap_risiko === nlpFilters.risk;
    const matchesStatus = !nlpFilters.status || report.status_laporan === nlpFilters.status;
    const reportDate = report.tarikh_laporan?.slice(0, 10) || '';
    const reportMonth = reportDate.slice(0, 7);
    const matchesTime = nlpFilters.timeMode === 'all'
      || (nlpFilters.timeMode === 'month' && (!nlpFilters.month || reportMonth === nlpFilters.month))
      || (nlpFilters.timeMode === 'week' && (!nlpFilters.week || dateToWeekValue(reportDate) === nlpFilters.week));
    return matchesSearch && matchesPost && matchesShift && matchesRisk && matchesStatus && matchesTime;
  }).sort((a, b) => Number(pinnedNlpReports.includes(b.id_laporan)) - Number(pinnedNlpReports.includes(a.id_laporan)));

  const nlpPostOptions = [...new Set(reports.map((report) => report.nama_pos).filter(Boolean))].sort();
  const nlpMonthOptions = [...new Set(reports.map((report) => report.tarikh_laporan?.slice(0, 7)).filter(Boolean))].sort().reverse();
  const nlpWeekOptions = [...new Set(reports.map((report) => dateToWeekValue(report.tarikh_laporan?.slice(0, 10))).filter(Boolean))].sort().reverse();

  return (
    <div className="desktop-ops space-y-5">
      <PageHeader title="Analisis NLP" description="Pentadbir Sistem boleh melihat keputusan NLP penuh dan melatih kata kunci model operasi." />
      <AlertMessage type="success">Tujuan halaman ini: semak bagaimana sistem mengklasifikasikan laporan, lihat kata kunci/skor risiko, dan kemas kini kata kunci rujukan supaya laporan baharu lebih tepat. Halaman ini bukan tempat untuk meluluskan laporan atau menutup tindakan.</AlertMessage>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_460px] 2xl:grid-cols-[minmax(0,1fr)_520px]">
        <Card title="Senarai Laporan">
          <div className="mb-4 space-y-3 rounded-xl border bg-white p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(280px,1fr)_auto]">
              <Field label="Carian laporan">
                <Input placeholder="Cari laporan, pengawal atau pos" value={nlpFilters.search} onChange={(e) => setNlpFilters({ ...nlpFilters, search: e.target.value })} />
              </Field>
              <Button type="button" variant="ghost" className="self-end" onClick={() => setNlpFilters({ search: '', post: '', shift: '', risk: '', status: '', timeMode: 'all', month: '', week: '' })}>Reset tapisan</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Field label="Pos"><Select value={nlpFilters.post} onChange={(e) => setNlpFilters({ ...nlpFilters, post: e.target.value })}><option value="">Semua pos</option>{nlpPostOptions.map((post) => <option key={post}>{post}</option>)}</Select></Field>
              <Field label="Syif"><Select value={nlpFilters.shift} onChange={(e) => setNlpFilters({ ...nlpFilters, shift: e.target.value })}><option value="">Semua syif</option><option>Pagi</option><option>Petang</option><option>Malam</option></Select></Field>
              <Field label="Risiko"><Select value={nlpFilters.risk} onChange={(e) => setNlpFilters({ ...nlpFilters, risk: e.target.value })}><option value="">Semua risiko</option><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></Select></Field>
              <Field label="Status"><Select value={nlpFilters.status} onChange={(e) => setNlpFilters({ ...nlpFilters, status: e.target.value })}><option value="">Semua status</option><option>Dihantar</option><option>Diluluskan</option><option>Ditolak</option></Select></Field>
            </div>
            <div className="grid gap-3 border-t pt-3 sm:grid-cols-2 lg:grid-cols-[220px_minmax(260px,360px)]">
              <Field label="Tempoh laporan"><Select value={nlpFilters.timeMode} onChange={(e) => setNlpFilters({ ...nlpFilters, timeMode: e.target.value, month: '', week: '' })}><option value="all">Semua masa</option><option value="month">Ikut bulan</option><option value="week">Ikut minggu</option></Select></Field>
              {nlpFilters.timeMode === 'month' && <Field label="Pilih bulan"><Select value={nlpFilters.month} onChange={(e) => setNlpFilters({ ...nlpFilters, month: e.target.value })}><option value="">Semua bulan</option>{nlpMonthOptions.map((month) => <option key={month} value={month}>{monthLabel(month)}</option>)}</Select></Field>}
              {nlpFilters.timeMode === 'week' && <Field label="Pilih minggu"><Select value={nlpFilters.week} onChange={(e) => setNlpFilters({ ...nlpFilters, week: e.target.value })}><option value="">Semua minggu</option>{nlpWeekOptions.map((week) => <option key={week} value={week}>{weekLabel(week)}</option>)}</Select></Field>}
            </div>
          </div>
          <p className="mb-3 text-sm text-secondary-token">{filteredNlpReports.length} daripada {reports.length} laporan dipaparkan.</p>
          {filteredNlpReports.length ? filteredNlpReports.map((report) => (
            <div key={report.id_laporan} className="desktop-record app-row mb-2 grid gap-3 rounded-xl border p-3 text-sm md:grid-cols-[1fr_auto]">
              <div>
                <p className="font-medium text-primary-token">{report.tajuk_laporan}</p>
                <p>{report.nama_penuh} - {report.nama_pos} - {report.syif}</p>
                <p className="text-data">{report.tarikh_laporan?.slice(0, 10)} {report.masa_laporan || ''} - {monthLabel(report.tarikh_laporan?.slice(0, 7))} - {weekLabel(dateToWeekValue(report.tarikh_laporan?.slice(0, 10))) || '-'}</p>
                <div className="mt-2 flex flex-wrap gap-2">{pinnedNlpReports.includes(report.id_laporan) && <Badge>Dipin</Badge>}<Badge tone={report.tahap_risiko}>{report.tahap_risiko}</Badge><Badge tone={statusTone(report.status_laporan)}>{report.status_laporan}</Badge></div>
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                <Button variant="ghost" onClick={() => setPinnedNlpReports((current) => current.includes(report.id_laporan) ? current.filter((id) => id !== report.id_laporan) : [...current, report.id_laporan])}>{pinnedNlpReports.includes(report.id_laporan) ? 'Nyahpin' : 'Pin'}</Button>
                <Button variant="ghost" onClick={() => openNlp(report.id_laporan)}><Eye size={16} /> NLP</Button>
              </div>
            </div>
          )) : <EmptyState title="Tiada laporan" description="Laporan harian akan dipaparkan di sini." />}
        </Card>
        <Card title="Keputusan NLP Penuh" className="desktop-sticky-panel">
          {selectedNlp ? (
            <div className="space-y-4 text-sm">
              <div><p className="label-caps">Laporan</p><h3>{selectedNlp.tajuk_laporan}</h3><p>{selectedNlp.kandungan_laporan}</p></div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="app-row rounded-xl border p-4"><p className="label-caps">Skor Risiko</p><p className="text-kpi mt-2">{selectedNlp.skor_risiko}</p></div>
                <div className="app-row rounded-xl border p-4"><p className="label-caps">Keyakinan</p><p className="text-kpi mt-2">{Math.round(Number(selectedNlp.tahap_keyakinan || 0) * 100)}%</p></div>
                <div className="app-row rounded-xl border p-4"><p className="label-caps">Tahap Risiko</p><div className="mt-3"><Badge tone={selectedNlp.tahap_risiko}>{selectedNlp.tahap_risiko}</Badge></div></div>
              </div>
              <p><span className="font-medium text-primary-token">Kategori:</span> {selectedNlp.kategori_dikesan}</p>
              <div><p className="label-caps mb-2">Kata kunci dikesan</p><div className="flex flex-wrap gap-2">{(selectedNlp.kata_kunci_dikesan || []).map((keyword) => <Badge key={keyword}>{keyword}</Badge>)}</div></div>
              <p><span className="font-medium text-primary-token">Ringkasan:</span> {selectedNlp.ringkasan_automatik}</p>
              <p><span className="font-medium text-primary-token">Penjelasan:</span> {selectedNlp.explanation}</p>
            </div>
          ) : <EmptyState title="Pilih laporan" description="Pilih laporan untuk melihat kata kunci, kategori, skor risiko dan keyakinan NLP." />}
        </Card>
      </div>
      <AlertMessage type="success">Perubahan latihan di bawah digunakan untuk laporan baharu selepas disimpan. Tambah istilah lapangan sebenar seperti nama insiden, lokasi biasa, atau perkataan yang selalu digunakan pengawal.</AlertMessage>
      <Card title="Tambah Kategori NLP Baharu">
        <form onSubmit={createRule} className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-[1fr_180px_160px]">
            <Field label="Nama kategori"><Input required value={newRule.nama_kategori} onChange={(e) => setNewRule({ ...newRule, nama_kategori: e.target.value })} placeholder="Contoh: Gangguan Awam" /></Field>
            <Field label="Tahap risiko"><Select value={newRule.tahap_keutamaan} onChange={(e) => setNewRule({ ...newRule, tahap_keutamaan: e.target.value })}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></Select></Field>
            <Field label="Status"><Select value={newRule.status_kategori} onChange={(e) => setNewRule({ ...newRule, status_kategori: e.target.value })}><option>Aktif</option><option>Tidak Aktif</option></Select></Field>
          </div>
          <Field label="Penerangan"><Input value={newRule.penerangan_kategori} onChange={(e) => setNewRule({ ...newRule, penerangan_kategori: e.target.value })} placeholder="Kegunaan kategori ini dalam laporan operasi" /></Field>
          <Field label="Kata kunci rujukan"><Textarea rows={3} required value={newRule.kata_kunci_rujukan} onChange={(e) => setNewRule({ ...newRule, kata_kunci_rujukan: e.target.value })} placeholder="Pisahkan dengan koma. Contoh: kekecohan, bergaduh, enggan patuh arahan" /></Field>
          <Button disabled={saving === 'new'}>{saving === 'new' ? 'Menambah...' : 'Tambah NLP'}</Button>
        </form>
      </Card>
      <div className="grid gap-4 xl:grid-cols-3">
        {rules.length ? rules.map((rule) => {
          const edit = edits[rule.id_kategori_insiden] || {};
          return (
            <Card key={rule.id_kategori_insiden} title={rule.nama_kategori} action={<Badge tone={edit.tahap_keutamaan}>{edit.tahap_keutamaan}</Badge>}>
              <div className="space-y-3">
                <Field label="Nama kategori"><Input value={edit.nama_kategori || ''} onChange={(e) => updateEdit(rule.id_kategori_insiden, { nama_kategori: e.target.value })} /></Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Tahap risiko"><Select value={edit.tahap_keutamaan || 'Low'} onChange={(e) => updateEdit(rule.id_kategori_insiden, { tahap_keutamaan: e.target.value })}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></Select></Field>
                  <Field label="Status"><Select value={edit.status_kategori || 'Aktif'} onChange={(e) => updateEdit(rule.id_kategori_insiden, { status_kategori: e.target.value })}><option>Aktif</option><option>Tidak Aktif</option></Select></Field>
                </div>
                <Field label="Penerangan"><Input value={edit.penerangan_kategori || ''} onChange={(e) => updateEdit(rule.id_kategori_insiden, { penerangan_kategori: e.target.value })} /></Field>
                <Field label="Kata kunci rujukan"><Textarea rows={4} value={edit.kata_kunci_rujukan || ''} onChange={(e) => updateEdit(rule.id_kategori_insiden, { kata_kunci_rujukan: e.target.value })} /></Field>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => save(rule.id_kategori_insiden)} disabled={saving === rule.id_kategori_insiden}>{saving === rule.id_kategori_insiden ? 'Menyimpan...' : 'Simpan latihan'}</Button>
                  <Button variant="danger" onClick={() => setConfirmDeleteRule(rule)} disabled={saving === rule.id_kategori_insiden}>Padam</Button>
                </div>
              </div>
            </Card>
          );
        }) : <LoadingState message="Memuatkan peraturan NLP..." />}
      </div>
      <ConfirmModal
        open={!!confirmDeleteRule}
        title="Padam kategori NLP?"
        message={`Kategori "${confirmDeleteRule?.nama_kategori || ''}" akan dipadam jika belum digunakan. Jika sudah digunakan dalam laporan, sistem akan nyahaktifkan kategori ini supaya rekod lama kekal selamat.`}
        confirmLabel="Padam"
        danger
        onCancel={() => setConfirmDeleteRule(null)}
        onConfirm={deleteRule}
      />
    </div>
  );
}
