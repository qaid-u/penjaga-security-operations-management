import { useState } from 'react';
import { skipToken, useMutation, useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import api from '../api/axios';
import { AlertMessage, Button, Field, Select } from './ui';

export function ReportClassificationValidation({ detail, categories, trainingEnabled, onSaved }) {
  const id = detail.report.id_laporan;
  const saved = detail.confirmedCategory;
  const [category, setCategory] = useState(saved?.category || '');
  const [allowTraining, setAllowTraining] = useState(saved?.training_allowed === true);
  const analysisQuery = useQuery({ queryKey: ['reportAnalysis', id], queryFn: skipToken });
  const analysis = analysisQuery.data?.analysis || detail.analysis;
  const job = analysisQuery.data?.job || detail.analysisJob;
  const suggested = analysis?.kategori_dikesan || analysis?.topCategory || detail.report.kategori_dikesan;
  const hasCategory = value => categories.some(item => item.nama_kategori === value);
  const canUseSuggestion = !['pending', 'processing', 'failed'].includes(job?.status) && hasCategory(suggested);
  const mutation = useMutation({
    mutationFn: async () => (await api.patch(`/reports/${id}/classification`, { category, allowTraining })).data,
    onSuccess: ({ confirmedCategory }) => {
      setCategory(confirmedCategory.category);
      setAllowTraining(confirmedCategory.training_allowed);
      onSaved(confirmedCategory);
    },
  });

  const choose = value => {
    if (value !== category) setAllowTraining(false);
    setCategory(value);
    mutation.reset();
  };
  const unchanged = category === saved?.category && allowTraining === Boolean(saved?.training_allowed);

  return (
    <form className="workspace-review-decision space-y-3" aria-label="Pengesahan kategori"
      onSubmit={event => {
        event.preventDefault();
        if (!mutation.isPending && !unchanged && hasCategory(category)) mutation.mutate();
      }}>
      <h3 className="flex items-center gap-2"><ShieldCheck size={18} aria-hidden="true" /> Pengesahan kategori</h3>
      <p className="workspace-note">Semak laporan asal. Terima cadangan AI atau pilih kategori yang lebih tepat. Kelulusan laporan dibuat secara berasingan.</p>
      {canUseSuggestion && <Button type="button" variant="ghost" disabled={mutation.isPending} onClick={() => choose(suggested)}>
        Guna cadangan AI · {suggested}
      </Button>}
      <Field label="Kategori pilihan Ketua Pengawal">
        <Select value={category} disabled={mutation.isPending} onChange={event => choose(event.target.value)}>
          <option value="">Pilih kategori</option>
          {categories.map(item => <option key={item.id_kategori_insiden} value={item.nama_kategori}>{item.nama_kategori}</option>)}
        </Select>
      </Field>
      {trainingEnabled && <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={allowTraining} disabled={mutation.isPending}
          onChange={event => { setAllowTraining(event.target.checked); mutation.reset(); }} />
        Pertimbangkan kategori ini untuk latihan selepas saya meluluskan laporan (pilihan).
      </label>}
      {mutation.isError && <AlertMessage>{mutation.error.response?.data?.message || 'Kategori gagal disahkan. Cuba lagi.'}</AlertMessage>}
      {mutation.isSuccess && <p className="workspace-note" role="status">Pengesahan kategori disimpan.</p>}
      <Button type="submit" disabled={mutation.isPending || unchanged || !hasCategory(category)}>
        {mutation.isPending ? 'Menyimpan…' : 'Sahkan kategori'}
      </Button>
    </form>
  );
}
