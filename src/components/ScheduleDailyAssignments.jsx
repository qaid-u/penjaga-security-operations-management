import { useEffect, useRef, useState } from 'react';
import { CalendarDays, MapPin, Search, Users, X } from 'lucide-react';
import api from '../api/axios';
import { shiftTimes, shiftTimeLabel } from '../utils/helpers';
import { AlertMessage, Button, Field, Input, Select } from './ui';

const limit = 40;
const openRows = rows => rows.filter(row => shiftTimes[row.syif] && row.required > row.assigned);
const slotKey = (row, index) => [row.id_pos, row.syif, index].join(':');

export default function ScheduleDailyAssignments({ weekId, date, dateLabel, rows, guards, onClose, onSaved, reload }) {
  const dialog = useRef(null);
  const [openings, setOpenings] = useState(() => openRows(rows));
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const count = Object.keys(selected).length;
  const visible = openings.filter(row =>
    `${row.nama_pos} ${row.syif}`.toLowerCase().includes(search.trim().toLowerCase())
  );

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

  const choose = (row, index, value) => {
    const key = slotKey(row, index);
    setSelected(previous => {
      const next = { ...previous };
      if (!value) delete next[key];
      else {
        const times = shiftTimes[row.syif];
        next[key] = { id_pos: row.id_pos, id_pengguna: Number(value), syif: row.syif, masa_mula: times.start, masa_tamat: times.end };
      }
      return next;
    });
    if (!error?.refresh) setError(null);
  };

  const refresh = async () => {
    setPending(true);
    try {
      const fresh = openRows(await reload());
      const validKeys = new Set(fresh.flatMap(row =>
        Array.from({ length: Math.min(limit, row.required - row.assigned) }, (_, index) => slotKey(row, index))
      ));
      setSelected(previous => Object.fromEntries(Object.entries(previous).filter(([key]) => validKeys.has(key))));
      setOpenings(fresh);
      setError(null);
    } catch {
      setError({ message: 'Kekosongan belum dapat dimuat semula. Cuba lagi.', refresh: true });
    } finally {
      setPending(false);
    }
  };

  const save = async event => {
    event.preventDefault();
    if (!count || pending || error?.refresh) return;
    setPending(true);
    setError(null);
    try {
      const { data } = await api.post(`/jadual/mingguan/${weekId}/daily-assignments`, {
        date, assignments: Object.values(selected),
      });
      onSaved(data.created);
    } catch (failure) {
      setError(failure.response?.data || { message: 'Status simpanan belum dapat disahkan. Muat semula kekosongan dahulu.', refresh: true });
    } finally {
      setPending(false);
    }
  };

  return (
    <dialog ref={dialog} className="schedule-assignment-dialog" aria-labelledby="daily-assignment-title"
      onCancel={event => { event.preventDefault(); if (!pending) onClose(); }}>
      <form onSubmit={save}>
        <header className="schedule-dialog-header">
          <div>
            <span className="schedule-caption flex items-center gap-2"><CalendarDays size={14} aria-hidden="true" />{dateLabel(date)}</span>
            <h2 id="daily-assignment-title">Isi kekosongan harian</h2>
          </div>
          <button type="button" className="schedule-close" aria-label="Tutup tugasan harian" disabled={pending} onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className="schedule-dialog-scroll space-y-3">
          <p className="text-sm">Pilih pengawal untuk kekosongan yang mahu diisi. Tugasan yang dipilih disimpan bersama.</p>
          <div className="ops-search-row"><Search size={17} aria-hidden="true" />
            <Input type="search" aria-label="Cari pos atau syif" placeholder="Cari pos atau syif" value={search} onChange={event => setSearch(event.target.value)} />
          </div>
          {!guards.length && <p>Tiada pengawal aktif tersedia.</p>}
          {!visible.length && <p>{openings.length ? 'Tiada pos atau syif sepadan.' : 'Tiada lagi kekosongan untuk tarikh ini.'}</p>}
          {visible.map(row => {
            const shortage = row.required - row.assigned;
            const hasError = error?.target?.id_pos === row.id_pos && error?.target?.syif === row.syif;
            return (
              <section className="schedule-daily-opening" key={slotKey(row, 0)} aria-label={row.nama_pos + ' · ' + row.syif}>
                <div className="schedule-daily-opening-head">
                  <MapPin size={17} aria-hidden="true" />
                  <div><h3>{row.nama_pos}</h3><p>{row.syif} · {shiftTimeLabel(row.syif)}{row.syif === 'Malam' && ' · tamat esok'}</p></div>
                  <span>{shortage} kosong</span>
                </div>
                {hasError && <AlertMessage>{error.message}{error.conflict && ` ${error.conflict.nama_pos} · ${dateLabel(error.conflict.tarikh_tugas)} · ${error.conflict.masa_mula.slice(0,5)}–${error.conflict.masa_tamat.slice(0,5)}.`}</AlertMessage>}
                {Array.from({ length: Math.min(shortage, limit) }, (_, index) => {
                  const key = slotKey(row, index);
                  const value = selected[key]?.id_pengguna || '';
                  return <Field key={key} label={shortage === 1 ? 'Pengawal' : `Pengawal ${index + 1}`}>
                    <Select value={value} disabled={pending || (!value && count >= limit)} onChange={event => choose(row, index, event.target.value)}>
                      <option value="">Pilih pengawal</option>
                      {guards.map(guard => <option key={guard.id_pengguna} value={guard.id_pengguna}
                        disabled={guard.id_pengguna !== value && Object.values(selected).some(item => item.syif === row.syif && item.id_pengguna === guard.id_pengguna)}>
                        {guard.nama_penuh}{guard.nama_pengguna ? ` · ${guard.nama_pengguna}` : ''}
                      </option>)}
                    </Select>
                  </Field>;
                })}
              </section>
            );
          })}
          {error && <div role="alert" className="space-y-2">
            <AlertMessage>{error.message || 'Tugasan belum dapat disahkan.'}</AlertMessage>
            {error.refresh && <Button type="button" variant="ghost" disabled={pending} onClick={refresh}>Muat semula kekosongan</Button>}
            {error.target && search && <Button type="button" variant="ghost" onClick={() => setSearch('')}>Lihat semua kekosongan</Button>}
          </div>}
        </div>
        <footer className="schedule-dialog-footer">
          <Button type="button" variant="ghost" disabled={pending} onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={pending || !count || Boolean(error?.refresh)}>
            <Users size={16} aria-hidden="true" />{pending ? 'Memproses…' : `Simpan ${count} tugasan`}
          </Button>
          {count === limit && <small className="col-span-2">Had {limit} tugasan setiap simpanan.</small>}
        </footer>
      </form>
    </dialog>
  );
}
