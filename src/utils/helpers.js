import toast from 'react-hot-toast';
import api from '../api/axios';

export const ROLE = {
  admin: 'Pentadbir Sistem',
  chief: 'Ketua Pengawal',
  guard: 'Pengawal Keselamatan',
};

export const riskColors = {
  Low: 'var(--color-risk-low)',
  Medium: 'var(--color-risk-medium)',
  High: 'var(--color-risk-high)',
  Critical: 'var(--color-risk-critical)',
};

export const API_ORIGIN =
  import.meta.env.VITE_API_ORIGIN ||
  (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : 'http://localhost:3000');
export const maxEvidenceFiles = 6;

export function parseAttachmentPaths(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [value];
  } catch {
    return [value];
  }
}

export function dateToWeekValue(value) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function monthLabel(value) {
  if (!value) return '';
  const [year, month] = value.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('ms-MY', { month: 'long', year: 'numeric' });
}

export function recentMonthOptions(count = 36) {
  const options = [];
  const cursor = new Date();
  cursor.setDate(1);
  for (let index = 0; index < count; index += 1) {
    options.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
    cursor.setMonth(cursor.getMonth() - 1);
  }
  return options;
}

export function weekLabel(value) {
  if (!value) return '';
  const [year, week] = value.split('-W').map(Number);
  const janFourth = new Date(Date.UTC(year, 0, 4));
  const janFourthDay = janFourth.getUTCDay() || 7;
  const weekStart = new Date(janFourth);
  weekStart.setUTCDate(janFourth.getUTCDate() - janFourthDay + 1 + ((week - 1) * 7));
  const monthName = weekStart.toLocaleDateString('ms-MY', { month: 'long' });
  const weekOfMonth = Math.ceil(weekStart.getUTCDate() / 7);
  return `${monthName} Minggu ${weekOfMonth}`;
}

export async function downloadCsv(path, filename) {
  try {
    const { data } = await api.get(path, { responseType: 'blob' });
    const url = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    notifySuccess(`${filename} dimuat turun`);
  } catch (error) {
    notifyError(error, 'Fail CSV gagal dimuat turun');
  }
}

export function playFeedbackTone(type = 'success') {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    const gain = context.createGain();
    const oscillator = context.createOscillator();
    const secondOscillator = context.createOscillator();
    const now = context.currentTime;
    const frequencies = type === 'error' ? [220, 164] : type === 'action' ? [440, 554] : [523, 659];

    oscillator.frequency.setValueAtTime(frequencies[0], now);
    secondOscillator.frequency.setValueAtTime(frequencies[1], now + 0.06);
    oscillator.type = 'sine';
    secondOscillator.type = 'sine';
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.06, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    oscillator.connect(gain);
    secondOscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    secondOscillator.start(now + 0.055);
    oscillator.stop(now + 0.16);
    secondOscillator.stop(now + 0.2);
    window.setTimeout(() => context.close(), 260);
  } catch {
    // Audio feedback is optional; ignore browsers that block it.
  }
}

export function notifyError(error, fallback = 'Tindakan gagal. Sila cuba lagi.') {
  playFeedbackTone('error');
  toast.error(error?.response?.data?.message || error?.message || fallback);
}

export function notifySuccess(message) {
  playFeedbackTone('success');
  toast.success(message);
}

export function notifyAction(message) {
  playFeedbackTone('action');
  toast(message);
}

export const shiftTimes = {
  Pagi: { start: '07:00', end: '16:00', label: '07:00-16:00' },
  Petang: { start: '14:45', end: '23:45', label: '14:45-23:45' },
  Malam: { start: '23:00', end: '08:00', label: '23:00-08:00' },
  'Office Hour': { start: '07:00', end: '17:00', label: '07:00-17:00' },
};

export function shiftTimeLabel(shift) {
  return shiftTimes[shift]?.label || 'Masa belum ditetapkan';
}

export function statusTone(status) {
  if (['Diluluskan', 'Selesai', 'Aktif', 'Disahkan', 'Hadir'].includes(status)) return 'Low';
  if (['Ditolak', 'Tidak Hadir', 'Tidak Aktif', 'Lewat'].includes(status)) return 'Critical';
  if (['Dihantar', 'Dalam Semakan', 'Dalam Tindakan', 'Draf', 'Dijadualkan'].includes(status)) return 'Medium';
  if (['Dikunci'].includes(status)) return 'High';
  return 'default';
}
