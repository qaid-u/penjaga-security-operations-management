export const modes = { coverage: 'Liputan operasi', mapping: 'Pautan pos', schedule: 'Jadual', attendance: 'Rekod kehadiran', incidents: 'Klasifikasi laporan', followup: 'Tindakan susulan' };
export const tones = { neutral: '#64748b', linked: '#002b5b', Medium: '#a16207', High: '#c2410c', Critical: '#b91c1c', Low: '#15803d' };
export function indicator(location, mode, unavailable = false) {
  const neutral = (text) => ({ text, color: tones.neutral });
  if (unavailable) return neutral('Data tidak tersedia');
  if (!location) return neutral('Lokasi belum dikonfigurasi');
  if (!location.status_aktif) return neutral('Lokasi tidak aktif');
  if (!location.id_pos) return neutral('Belum dipautkan');
  if (location.in_scope === false) return neutral('Di luar penapis');
  const m = location.metrics;
  if (mode === 'mapping') return { text: 'Pos dipautkan', color: tones.linked };
  if (!m) return neutral('Data tidak tersedia');
  if (mode === 'coverage') return { text: `${m.schedule.assignments} tugasan · ${m.attendance.checked_in} daftar masuk · ${m.attendance.checked_out} daftar keluar`, color: m.attendance.checked_in ? tones.Low : m.attendance.checked_out ? tones.linked : m.schedule.assignments ? tones.linked : tones.neutral };
  if (mode === 'schedule') return { text: `${m.schedule.confirmed} tugasan disahkan / dikunci · ${m.schedule.draft} belum disahkan`, color: m.schedule.confirmed ? tones.linked : tones.neutral };
  if (mode === 'attendance') return { text: `${m.attendance.checked_in} daftar masuk · ${m.attendance.checked_out} daftar keluar`, color: m.attendance.checked_in ? tones.linked : tones.neutral };
  if (mode === 'incidents') {
    const risk = ['Critical','High','Medium','Low'].find((level) => m.incidents[level] > 0);
    return risk ? { text: `Klasifikasi tertinggi: ${risk} · ${m.incidents.total} laporan${m.incidents.Unknown ? ` · ${m.incidents.Unknown} belum dikelaskan` : ''}`, color: tones[risk] } : neutral(m.incidents.total ? `${m.incidents.total} laporan · Klasifikasi tidak tersedia` : 'Tiada laporan dalam julat');
  }
  return { text: `${m.follow_up.open} terbuka · ${m.follow_up.in_progress} dalam tindakan · ${m.follow_up.completed} selesai`, color: m.follow_up.in_progress ? tones.linked : m.follow_up.open ? tones.Medium : m.follow_up.completed ? tones.Low : tones.neutral };
}
export function apiMessage(error) {
  const status = error?.response?.status;
  if (status === 401) return 'Sesi tamat. Sila log masuk semula.';
  if (status === 403) return 'Akses data operasi tidak dibenarkan.';
  if (status === 404) return 'Lokasi tidak ditemui. Muat semula pautan lokasi.';
  return error?.response?.data?.message || 'Data operasi tidak tersedia. Model 3D masih boleh digunakan.';
}
export function klTimestamp(value) { return value ? new Intl.DateTimeFormat('ms-MY', { timeZone: 'Asia/Kuala_Lumpur', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Maklumat tidak tersedia'; }
