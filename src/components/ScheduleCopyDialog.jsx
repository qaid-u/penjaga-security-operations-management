import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/axios';
import { AlertMessage, Button, Input } from './ui';

export default function ScheduleCopyDialog({ weekId, dateLabel, onClose, onSaved }) {
  const dialog = useRef(null);
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const url = '/jadual/mingguan/' + weekId + '/copy-next';
  const preview = useQuery({
    queryKey: ['schedule-copy', weekId],
    queryFn: async ({ signal }) => (await api.get(url, { signal })).data,
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);

  const data = preview.data;
  const eligible = data?.rows.filter(row => row.active && !row.conflict) || [];
  const ids = selection?.version === data?.version && selection
    ? selection.ids : eligible.map(row => row.id_jadual);
  const visible = data?.rows.filter(row =>
    [row.nama_pos, row.syif, row.nama_penuh].join(' ').toLowerCase().includes(search.trim().toLowerCase())
  ) || [];
  const choose = ids => setSelection({ version: data.version, ids });
  const save = async event => {
    event.preventDefault();
    if (!ids.length || saving) return;
    setSaving(true);
    setError('');
    try {
      const result = await api.post(url, { ids, version: data.version });
      onSaved(result.data);
    } catch (failure) {
      setError(failure.response?.data?.message || 'Salinan gagal disimpan. Cuba lagi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <dialog ref={dialog} className="schedule-assignment-dialog" aria-labelledby="copy-week-title"
      onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}>
      <form onSubmit={save}>
        <header className="schedule-dialog-header">
          <div><span className="schedule-caption">Pratonton draf</span><h2 id="copy-week-title">Salin ke minggu depan</h2></div>
        </header>
        <div className="schedule-dialog-scroll space-y-3">
          {preview.isPending && <p role="status">Menyemak tugasan dan pertindihan…</p>}
          {preview.isError && <AlertMessage>{preview.error.response?.data?.message || 'Pratonton gagal dimuatkan.'}</AlertMessage>}
          {data && !preview.isError && <>
            <p><strong>{dateLabel(data.start)} – {dateLabel(data.end)}</strong></p>
            <p className="text-sm">Pilih tugasan untuk draf minggu depan. Tugasan yang bertindih tidak boleh dipilih.</p>
            {data.rows.length > 0 ? <>
              <Input type="search" aria-label="Cari tugasan untuk disalin" placeholder="Cari pos, syif atau pengawal" value={search}
                onChange={event => setSearch(event.target.value)} />
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="ghost" disabled={saving} onClick={() => choose(eligible.map(row => row.id_jadual))}>Pilih semua yang boleh disalin</Button>
                <Button type="button" variant="ghost" disabled={saving} onClick={() => choose([])}>Kosongkan pilihan</Button>
              </div>
              <div className="schedule-guard-options">
                {visible.map(row => (
                  <label key={row.id_jadual} className="schedule-guard-option">
                    <input type="checkbox" disabled={saving || !row.active || Boolean(row.conflict)}
                      checked={ids.includes(row.id_jadual)}
                      onChange={event => choose(event.target.checked ? [...ids, row.id_jadual] : ids.filter(id => id !== row.id_jadual))} />
                    <span>
                      <strong>{row.nama_pos} · {row.syif}</strong>
                      <small>{row.nama_penuh} · {dateLabel(row.tarikh_tugas)}</small>
                      <small>{row.masa_mula.slice(0,5)}–{row.masa_tamat.slice(0,5)}</small>
                      {!row.active && <small>Pos atau pengawal tidak aktif</small>}
                      {row.conflict && <small>Bertindih dengan {row.conflict.nama_pos} pada {dateLabel(row.conflict.tarikh_tugas)}, {row.conflict.masa_mula.slice(0,5)}–{row.conflict.masa_tamat.slice(0,5)}</small>}
                    </span>
                  </label>
                ))}
                {!visible.length && <p>Tiada tugasan sepadan.</p>}
              </div>
              <p role="status">{ids.length} dipilih · {data.rows.length - eligible.length} tidak boleh disalin</p>
            </> : <p>Tiada tugasan untuk disalin daripada minggu ini.</p>}
          </>}
          {error && <AlertMessage>{error}</AlertMessage>}
          {(error || preview.isError) && <Button type="button" variant="ghost" disabled={preview.isFetching}
            onClick={() => { setError(''); setSelection(null); preview.refetch(); }}>Semak semula</Button>}
        </div>
        <footer className="schedule-dialog-footer">
          <Button type="button" variant="ghost" disabled={saving} onClick={onClose}>Batal</Button>
          <Button disabled={saving || preview.isFetching || preview.isError || Boolean(error) || !ids.length}>
            {saving ? 'Menyimpan…' : 'Simpan sebagai draf'}
          </Button>
        </footer>
      </form>
    </dialog>
  );
}
