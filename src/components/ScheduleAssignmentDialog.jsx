import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronDown, Clock3, MapPin, Search, ShieldCheck, X } from 'lucide-react';
import { AlertMessage, Button, Field, Input, Select, Textarea } from './ui';
import { shiftTimes, shiftTimeLabel } from '../utils/helpers';

export default function ScheduleAssignmentDialog({ form, setForm, posts, guards, start, end, saving, conflict, clearConflict, onSave, onClose }) {
  const dialog = useRef(null);
  const [search, setSearch] = useState('');
  const [contextOpen, setContextOpen] = useState(!form.id_pos);
  const selectedPost = posts.find(post => String(post.id_pos) === String(form.id_pos));
  const selectedGuard = guards.find(guard => String(guard.id_pengguna) === String(form.id_pengguna));
  const found = guards.filter(guard => `${guard.nama_penuh} ${guard.nama_pengguna || ''}`.toLowerCase().includes(search.trim().toLowerCase()));
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    element.querySelector('input[type="search"]')?.focus();
    return () => { element.close(); document.body.style.overflow = overflow; previous?.focus?.(); };
  }, []);
  const update = value => { clearConflict(); setForm({ ...form, ...value }); };
  return <dialog ref={dialog} className="schedule-assignment-dialog" aria-labelledby="assignment-dialog-title" onCancel={event => {event.preventDefault(); if (!saving) onClose();}}>
    <form onSubmit={onSave}>
      <header className="schedule-dialog-header"><div><span className="schedule-caption">{form.id_jadual ? 'Kemas kini jadual' : 'Tugasan baharu'}</span><h2 id="assignment-dialog-title">{form.id_jadual ? 'Edit tugasan' : 'Pilih pengawal'}</h2></div><button type="button" className="schedule-close" aria-label="Tutup tugasan" disabled={saving} onClick={onClose}><X size={20}/></button></header>
      <div className="schedule-dialog-scroll">
        <div className="schedule-assignment-context"><p><MapPin size={16} aria-hidden="true"/><strong>{selectedPost?.nama_pos || 'Pilih pos kawalan'}</strong></p><p><CalendarDays size={15} aria-hidden="true"/>{form.tarikh_tugas ? new Intl.DateTimeFormat('ms-MY',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Kuala_Lumpur'}).format(new Date(form.tarikh_tugas+'T12:00:00+08:00')) : 'Pilih tarikh'}</p><p><Clock3 size={15} aria-hidden="true"/>{form.syif} · {form.masa_mula} – {form.masa_tamat}{form.masa_tamat <= form.masa_mula && ' (esok)'}</p></div>
        <details className="schedule-change-context" open={contextOpen} onToggle={event => setContextOpen(event.currentTarget.open)}><summary>Ubah pos, tarikh atau masa <ChevronDown size={15} aria-hidden="true"/></summary><div className="space-y-3">
          <Field label="Pos kawalan"><Select disabled={saving} required value={form.id_pos} onChange={e => update({id_pos:e.target.value})}><option value="">Pilih pos</option>{posts.map(post => <option key={post.id_pos} value={post.id_pos}>{post.nama_pos}{post.nama_bangunan ? ' · '+post.nama_bangunan : ''}</option>)}</Select></Field>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Tarikh"><Input disabled={saving} type="date" required min={start} max={end} value={form.tarikh_tugas} onChange={e => update({tarikh_tugas:e.target.value})}/></Field><Field label="Syif"><Select disabled={saving} value={form.syif} onChange={e => {const times=shiftTimes[e.target.value];update({syif:e.target.value,masa_mula:times.start,masa_tamat:times.end});}}>{Object.keys(shiftTimes).map(shift => <option key={shift} value={shift}>{shift} ({shiftTimeLabel(shift)})</option>)}</Select></Field><Field label="Masa mula"><Input disabled={saving} type="time" required value={form.masa_mula} onChange={e => update({masa_mula:e.target.value})}/></Field><Field label="Masa tamat"><Input disabled={saving} type="time" required value={form.masa_tamat} onChange={e => update({masa_tamat:e.target.value})}/></Field></div>
        </div></details>
        <fieldset className="schedule-guard-picker"><legend>Pengawal bertugas</legend><div className="ops-search-row"><Search size={17} aria-hidden="true"/><Input type="search" aria-label="Cari pengawal" placeholder="Cari nama pengawal" value={search} onChange={e => setSearch(e.target.value)}/></div><div className="schedule-guard-options">{found.map(guard => <label className="schedule-guard-option" key={guard.id_pengguna}><input type="radio" name="assignment-guard" disabled={saving} checked={String(form.id_pengguna) === String(guard.id_pengguna)} onChange={() => update({id_pengguna:guard.id_pengguna})}/><span className="schedule-avatar" aria-hidden="true">{guard.nama_penuh?.trim().slice(0,1)}</span><span>{guard.nama_penuh}<small>{guard.nama_pengguna}</small></span>{String(form.id_pengguna) === String(guard.id_pengguna) && <Check size={18} aria-hidden="true"/>}</label>)}{!found.length && <p className="schedule-list-hint">{guards.length ? 'Tiada nama sepadan. Cuba carian lain.' : 'Tiada pengawal aktif tersedia dalam senarai.'}</p>}</div></fieldset>
        {selectedGuard && <p className="schedule-selected-guard"><Check size={15} aria-hidden="true"/>Dipilih: <strong>{selectedGuard.nama_penuh}</strong></p>}
        <details className="schedule-change-context"><summary>Catatan (pilihan) <ChevronDown size={15} aria-hidden="true"/></summary><Field label="Catatan"><Textarea rows={2} disabled={saving} value={form.catatan} onChange={e => update({catatan:e.target.value})}/></Field></details>
        {conflict?.error && <AlertMessage>{conflict.error}</AlertMessage>}
        {conflict?.critical?.length > 0 && <AlertMessage>{conflict.critical.join('. ')}</AlertMessage>}
        {conflict?.conflict && <p className="schedule-conflict-note" role="status">
          Bertindih dengan {conflict.conflict.nama_pos} pada {conflict.conflict.tarikh_tugas}, {conflict.conflict.masa_mula.slice(0,5)}–{conflict.conflict.masa_tamat.slice(0,5)}. Pilih pengawal lain atau ubah waktu tugasan.
        </p>}
        {conflict?.warnings?.length > 0 && <AlertMessage>{conflict.warnings.join('. ')}</AlertMessage>}
        <p className="schedule-conflict-note"><ShieldCheck size={16} aria-hidden="true"/>Pertindihan masa akan disemak secara automatik sebelum disimpan.</p>
      </div>
      <footer className="schedule-dialog-footer"><Button type="button" variant="ghost" disabled={saving} onClick={onClose}>Batal</Button><Button type="submit" disabled={saving || !form.id_pos || !form.id_pengguna || !form.tarikh_tugas || Boolean(conflict?.critical?.length)}>{saving ? 'Menyemak & menyimpan…' : 'Simpan tugasan'}</Button></footer>
    </form>
  </dialog>;
}
