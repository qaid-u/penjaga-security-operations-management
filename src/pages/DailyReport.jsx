import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, RotateCcw } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';
import { maxEvidenceFiles, notifyError, notifyAction, notifySuccess, statusTone } from '../utils/helpers';
import { Card, Field, Select, Input, Textarea, ChecklistChoice, Button, AlertMessage, Badge, EmptyState, AttachmentLinks, LoadingState } from '../components/ui';

export function DailyReport() {
  const [nlp, setNlp] = useState(null);
  const [submitted, setSubmitted] = useState(null);
  const [form, setForm] = useState({ syif: 'Pagi', tarikh_laporan: new Date().toISOString().slice(0, 10), masa_laporan: '08:00', checklist: [] });
  const [fileKey, setFileKey] = useState(0);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [previewUrls, setPreviewUrls] = useState([]);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const previewUrlsRef = useRef([]);
  const queryClient = useQueryClient();
  
  const { data: metaData } = useQuery({
    queryKey: ['meta'],
    queryFn: async () => {
      const res = await api.get('/meta');
      return res.data;
    }
  });

  const { data: reportsData } = useQuery({
    queryKey: ['myReports'],
    queryFn: async () => {
      const res = await api.get('/reports', { params: { limit: 10 } });
      return res.data;
    }
  });

  const submitMutation = useMutation({
    mutationFn: async (body) => {
      const res = await api.post('/reports', body, { headers: { 'Content-Type': 'multipart/form-data' } });
      return res.data;
    },
    onSuccess: (data) => {
      setNlp(data.nlp);
      setSubmitted(data.report);
      setForm({ syif: 'Pagi', tarikh_laporan: new Date().toISOString().slice(0, 10), masa_laporan: '08:00', checklist: [] });
      clearEvidenceFiles();
      setFileKey((prev) => prev + 1);
      notifySuccess('Laporan berjaya dihantar');
      queryClient.invalidateQueries({ queryKey: ['myReports'] });
    },
    onError: (error) => notifyError(error, 'Laporan gagal dihantar'),
  });

  const meta = metaData || { posts: [], categories: [], checklist: [] };
  const reports = reportsData?.data || [];
  
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }, []);
  
  useEffect(() => { previewUrlsRef.current = previewUrls; }, [previewUrls]);
  useEffect(() => () => {
    stopCamera();
    previewUrlsRef.current.forEach((item) => { if (item.url) URL.revokeObjectURL(item.url); });
  }, [stopCamera]);
  
  const addEvidenceFiles = (files = []) => {
    const selectedFiles = Array.from(files).filter(Boolean);
    if (!selectedFiles.length) return;
    setForm((prev) => {
      const currentFiles = prev.lampiran_fail || [];
      const nextFiles = [...currentFiles, ...selectedFiles].slice(0, maxEvidenceFiles);
      if (currentFiles.length + selectedFiles.length > maxEvidenceFiles) notifyError({ message: `Maksimum ${maxEvidenceFiles} lampiran sahaja untuk satu laporan` });
      return { ...prev, lampiran_fail: nextFiles };
    });
    const nextPreviews = selectedFiles.map((file) => ({ name: file.name, url: file.type?.startsWith('image/') ? URL.createObjectURL(file) : '' }));
    setPreviewUrls((current) => [...current, ...nextPreviews].slice(0, maxEvidenceFiles));
  };
  
  const removeEvidenceFile = (index) => {
    setForm((prev) => ({ ...prev, lampiran_fail: (prev.lampiran_fail || []).filter((_, fileIndex) => fileIndex !== index) }));
    setPreviewUrls((current) => {
      const preview = current[index];
      if (preview?.url) URL.revokeObjectURL(preview.url);
      return current.filter((_, previewIndex) => previewIndex !== index);
    });
  };
  
  const clearEvidenceFiles = () => {
    previewUrls.forEach((item) => { if (item.url) URL.revokeObjectURL(item.url); });
    setPreviewUrls([]);
    setForm((prev) => ({ ...prev, lampiran_fail: [] }));
  };
  
  const openCamera = async () => {
    setCameraError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Kamera tidak disokong oleh pelayar ini');
      notifyError({ message: 'Kamera tidak disokong oleh pelayar ini' });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      streamRef.current = stream;
      setCameraOpen(true);
      notifyAction('Kamera dibuka');
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 0);
    } catch {
      setCameraError('Kamera tidak dapat dibuka. Sila benarkan akses kamera atau guna lampiran fail.');
      notifyError({ message: 'Kamera tidak dapat dibuka' });
    }
  };
  
  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return setCameraError('Gambar gagal ditangkap. Cuba sekali lagi.');
      const file = new File([blob], `bukti-laporan-${Date.now()}.jpg`, { type: 'image/jpeg' });
      addEvidenceFiles([file]);
      stopCamera();
      notifySuccess('Gambar bukti ditangkap');
    }, 'image/jpeg', 0.9);
  };
  
  const getChecklistValue = (id) => form.checklist.find((item) => item.id_checklist === id);
  const setChecklist = (id, key, value) => setForm((prev) => ({ ...prev, checklist: [...prev.checklist.filter((i) => i.id_checklist !== id), { ...(prev.checklist.find((i) => i.id_checklist === id) || { id_checklist: id, jawapan: '' }), [key]: value }] }));
  
  const submit = (event) => {
    event.preventDefault();
    const unansweredChecklist = meta.checklist.filter((item) => !getChecklistValue(item.id_checklist)?.jawapan);
    if (unansweredChecklist.length) {
      notifyError({ message: `Sila jawab semua checklist. ${unansweredChecklist.length} item belum ditanda.` });
      return;
    }
    
    const body = new FormData();
    Object.entries({ ...form, id_pos: Number(form.id_pos), id_kategori_insiden: form.id_kategori_insiden ? Number(form.id_kategori_insiden) : '' }).forEach(([key, value]) => {
      if (key === 'checklist') body.append(key, JSON.stringify(value));
      else if (key !== 'lampiran_fail' && value !== undefined && value !== null) body.append(key, value);
    });
    (form.lampiran_fail || []).forEach((file) => body.append('lampiran_fail', file));
    
    submitMutation.mutate(body);
  };
  
  if (!metaData) return <LoadingState message="Memuatkan borang laporan..." />;

  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
      <Card title="Laporan Harian">
        <form onSubmit={submit} className="space-y-4">
          <p className="label-caps">Bahagian 1: Tugasan dan pos</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Pos kawalan"><Select required value={form.id_pos || ''} onChange={(e) => setForm({ ...form, id_pos: e.target.value })}><option value="">Pilih pos</option>{meta.posts.map((p) => <option key={p.id_pos} value={p.id_pos}>{p.nama_pos}</option>)}</Select></Field>
            <Field label="Syif"><Select value={form.syif} onChange={(e) => setForm({ ...form, syif: e.target.value })}><option>Pagi</option><option>Petang</option><option>Malam</option></Select></Field>
            <Field label="Tarikh"><Input type="date" required value={form.tarikh_laporan} onChange={(e) => setForm({ ...form, tarikh_laporan: e.target.value })} /></Field>
            <Field label="Masa"><Input type="time" required value={form.masa_laporan} onChange={(e) => setForm({ ...form, masa_laporan: e.target.value })} /></Field>
          </div>
          <p className="label-caps">Bahagian 2: Butiran laporan</p>
          <Field label="Tajuk laporan"><Input required value={form.tajuk_laporan || ''} onChange={(e) => setForm({ ...form, tajuk_laporan: e.target.value })} /></Field>
          <Field label="Kategori insiden pilihan"><Select value={form.id_kategori_insiden || ''} onChange={(e) => setForm({ ...form, id_kategori_insiden: e.target.value })}><option value="">Biarkan NLP klasifikasi</option>{meta.categories.map((c) => <option key={c.id_kategori_insiden} value={c.id_kategori_insiden}>{c.nama_kategori}</option>)}</Select></Field>
          <Field label="Kandungan laporan"><Textarea required rows={6} value={form.kandungan_laporan || ''} onChange={(e) => setForm({ ...form, kandungan_laporan: e.target.value })} /></Field>
          <div className="space-y-2">
            <p className="label-caps">Bahagian 3: Checklist</p>
            <p className="text-sm">Tekan satu pilihan untuk setiap pemeriksaan. Checklist bermula kosong supaya setiap jawapan dibuat secara sengaja.</p>
            {meta.checklist.map((item) => {
              const current = getChecklistValue(item.id_checklist)?.jawapan || '';
              return (
                <div key={item.id_checklist} className="app-row grid gap-3 rounded-md border p-3">
                  <span className="text-sm font-medium text-primary-token">{item.nama_checklist}</span>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {['Ya', 'Tidak', 'Tidak Berkaitan'].map((answer) => <ChecklistChoice key={answer} active={current === answer} onClick={() => setChecklist(item.id_checklist, 'jawapan', answer)}>{answer}</ChecklistChoice>)}
                  </div>
                  <Input placeholder="Catatan jika perlu" value={getChecklistValue(item.id_checklist)?.catatan || ''} onChange={(e) => setChecklist(item.id_checklist, 'catatan', e.target.value)} />
                </div>
              );
            })}
          </div>
          <div className="gov-upload-panel space-y-3 rounded-2xl p-4">
            <p className="label-caps">Bahagian 4: Lampiran bukti</p>
            <p className="text-sm">Muat naik sehingga {maxEvidenceFiles} gambar/PDF, atau gunakan kamera beberapa kali jika terdapat lebih daripada satu isu.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" variant="ghost" onClick={openCamera}><Camera size={16} /> Guna kamera</Button>
              <Field label="Lampiran bukti"><Input key={fileKey} type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(e) => { addEvidenceFiles(e.target.files || []); setFileKey((prev) => prev + 1); }} /></Field>
            </div>
            {cameraError && <AlertMessage>{cameraError}</AlertMessage>}
            {cameraOpen && (
              <div className="app-row motion-pop space-y-3 rounded-md border p-3">
                <video ref={videoRef} autoPlay playsInline muted className="aspect-video w-full rounded-md object-cover" />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button type="button" onClick={capturePhoto}><Camera size={16} /> Tangkap gambar</Button>
                  <Button type="button" variant="ghost" onClick={stopCamera}>Tutup kamera</Button>
                </div>
              </div>
            )}
            {previewUrls.length > 0 && (
              <div className="app-row motion-pop rounded-md border p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  {previewUrls.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="rounded-md border bg-white p-2">
                      {file.url ? <img src={file.url} alt={`Pratonton bukti ${index + 1}`} className="max-h-44 w-full rounded-md object-contain" /> : <div className="flex min-h-28 items-center justify-center rounded-md border border-dashed text-sm text-secondary-token">Fail PDF / dokumen</div>}
                      <p className="mt-2 truncate text-sm font-medium text-primary-token">{file.name}</p>
                      <Button type="button" variant="ghost" className="mt-2 w-full" onClick={() => removeEvidenceFile(index)}><RotateCcw size={16} /> Buang lampiran</Button>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="ghost" className="mt-3 w-full sm:w-auto" onClick={() => { clearEvidenceFiles(); setFileKey((prev) => prev + 1); }}><RotateCcw size={16} /> Buang semua lampiran</Button>
              </div>
            )}
            {(form.lampiran_fail || []).length > 0 && <p className="text-data">{form.lampiran_fail.length} lampiran dipilih.</p>}
          </div>
          <div className="space-y-2">
            <p className="label-caps">Bahagian 5: Hantar laporan</p>
            <Button className="w-full sm:w-auto" disabled={submitMutation.isLoading}>{submitMutation.isLoading ? 'Menghantar...' : 'Hantar laporan'}</Button>
          </div>
        </form>
      </Card>
      <div className="space-y-5">
        {submitted && <AlertMessage type="success">Laporan berjaya dihantar. Status laporan boleh disemak selepas semakan Ketua.</AlertMessage>}
        {nlp && <Card title="Keputusan NLP Rule-Based"><div className="space-y-4 text-sm"><p>Analisis automatik berdasarkan kata kunci laporan.</p><div className={`rounded-2xl border p-4 ${['High', 'Critical'].includes(nlp.tahap_risiko) ? 'app-row-alert' : 'app-row'}`}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="label-caps">Kategori dikesan</p><h3>{nlp.kategori_dikesan}</h3></div><Badge tone={nlp.tahap_risiko}>{nlp.tahap_risiko}</Badge></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div><p className="label-caps">Skor risiko</p><p className="text-kpi">{nlp.skor_risiko}</p></div><div><p className="label-caps">Status laporan</p><p className="font-medium text-primary-token">{submitted?.status_laporan}</p></div></div></div><div><p className="label-caps mb-2">Kata kunci dikesan</p><div className="flex flex-wrap gap-2">{nlp.kata_kunci_dikesan.length ? nlp.kata_kunci_dikesan.map((keyword) => <Badge key={keyword}>{keyword}</Badge>) : <Badge>Tiada kata kunci khusus</Badge>}</div></div><p><span className="font-medium text-primary-token">Ringkasan:</span> {nlp.ringkasan_automatik}</p></div></Card>}
        <Card title="Laporan Saya">{reports.length ? reports.map((report) => <div key={report.id_laporan} className="app-row mb-2 rounded-md border p-3 text-sm"><div className="flex justify-between gap-2"><span className="font-medium text-primary-token">{report.tajuk_laporan}</span><Badge tone={report.tahap_risiko}>{report.tahap_risiko}</Badge></div><div className="mt-2 flex flex-wrap gap-2"><Badge tone={statusTone(report.status_laporan)}>{report.status_laporan}</Badge><span>{report.nama_pos}</span></div>{report.status_laporan === 'Ditolak' && <AlertMessage>Laporan ditolak. Semak catatan Ketua dan hantar laporan baharu jika pembetulan diperlukan.</AlertMessage>}{report.status_laporan === 'Diluluskan' && <AlertMessage type="success">Laporan telah diluluskan.</AlertMessage>}<AttachmentLinks value={report.lampiran_fail} label="Lampiran" /></div>) : <EmptyState title="Tiada laporan" description="Laporan yang anda hantar akan dipaparkan di sini." />}</Card>
      </div>
    </div>
  );
}
