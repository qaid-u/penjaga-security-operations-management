import { useEffect, useState } from 'react';
import { Eye, EyeOff, ChevronDown, Paperclip } from 'lucide-react';
import api from '../api/axios';

export function Badge({ children, tone = 'default' }) {
  const tones = {
    default: 'badge-default',
    Low: 'badge-low',
    Medium: 'badge-medium',
    High: 'badge-high',
    Critical: 'badge-critical',
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[var(--fs-label)] font-medium ${tones[tone] || tones.default}`}>{children}</span>;
}

export function Card({ title, children, action, className = '' }) {
  return (
    <section className={`app-surface rounded-2xl border p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className={title ? 'gov-card-title text-[var(--color-brand-navy)]' : ''}>{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, children }) {
  return (
    <label className="block text-sm font-medium text-secondary-token">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

export function Input(props) {
  return <input {...props} className={`app-input w-full rounded-lg border px-3 py-2 text-sm ${props.className || ''}`} />;
}

export function Select(props) {
  return <select {...props} className={`app-input w-full rounded-lg border px-3 py-2 text-sm ${props.className || ''}`} />;
}

export function Textarea(props) {
  return <textarea {...props} className={`app-input w-full rounded-lg border px-3 py-2 text-sm ${props.className || ''}`} />;
}

export function Button({ children, variant = 'primary', ...props }) {
  const variants = {
    primary: 'app-button-primary',
    ghost: 'app-button-ghost border',
    danger: 'app-button-danger',
  };
  return <button {...props} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 ${variants[variant]} ${props.className || ''}`}>{children}</button>;
}

export function ChecklistChoice({ active, children, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`min-h-10 rounded-lg border px-3 py-2 text-sm font-medium ${active ? 'app-button-primary' : 'app-button-ghost'}`}>
      {active ? '✓ ' : ''}{children}
    </button>
  );
}

export function PageHeader({ title, description, action }) {
  return (
    <div className="app-surface mb-5 rounded-2xl border p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="border-l-4 border-[var(--color-brand-gold)] pl-4">
          <p className="label-caps">PENJAGA</p>
          <h1 className="mt-1 text-[var(--color-brand-navy)]">{title}</h1>
          {description && <p className="mt-2 max-w-3xl text-sm">{description}</p>}
        </div>
        {action && <div className="flex flex-wrap gap-2 sm:justify-end">{action}</div>}
      </div>
    </div>
  );
}

export function StatCard({ label, value }) {
  return <Card><p className="label-caps">{label}</p><p className="text-kpi mt-3">{value}</p></Card>;
}

export function ActionTile({ title, value, description, tone = 'default', action }) {
  return (
    <button type="button" onClick={action} className={`app-row w-full rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${tone === 'urgent' ? 'app-row-alert' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-primary-token">{title}</p>
          <p className="mt-1 text-xs text-secondary-token">{description}</p>
        </div>
        <span className="text-2xl font-bold text-[var(--color-brand-navy)]">{value}</span>
      </div>
    </button>
  );
}

export function LoadingState({ message = 'Memuatkan data...' }) {
  return <Card><p>{message}</p></Card>;
}

export function EmptyState({ title = 'Tiada data', description = 'Belum ada rekod untuk dipaparkan.' }) {
  return <div className="app-row rounded-md border p-4 text-sm"><p className="font-medium text-primary-token">{title}</p><p>{description}</p></div>;
}

export function AlertMessage({ children, type = 'error' }) {
  const tone = type === 'success' ? 'status-success' : 'status-error';
  return <p className={`${tone} rounded-md border px-3 py-2 text-sm`}>{children}</p>;
}

export function FilterPanel({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <Card title="Tapisan" action={<Button variant="ghost" className="sm:hidden" onClick={() => setOpen((value) => !value)}><ChevronDown size={16} /> {open ? 'Tutup' : 'Buka'}</Button>}>
      <div className={`${open ? 'grid' : 'hidden'} gap-2 sm:grid`}>
        {children}
      </div>
    </Card>
  );
}

export function ConfirmModal({ open, title, message, confirmLabel = 'Sahkan', danger = false, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(0,0,0,0.55)] p-4 sm:items-center">
      <div className="app-elevated motion-sheet w-full max-w-md rounded-lg border p-4 shadow-xl">
        <h2>{title}</h2>
        <p className="mt-2">{message}</p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Button variant="ghost" onClick={onCancel}>Batal</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

export function PasswordInput({ value, onChange, required = false }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input type={visible ? 'text' : 'password'} value={value} onChange={onChange} required={required} className="pr-12" />
      <button type="button" className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md app-nav" onClick={() => setVisible((state) => !state)} aria-label={visible ? 'Sembunyikan kata laluan' : 'Tunjuk kata laluan'}>
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function parseAttachmentPaths(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [value];
  } catch {
    return [value];
  }
}

function ProtectedAttachment({ path, label, image = false, className = '' }) {
  const [objectUrl, setObjectUrl] = useState('');
  const [failed, setFailed] = useState(false);
  const filename = path.split('/').pop();

  useEffect(() => {
    let active = true;
    let currentUrl = '';
    api.get(`/uploads/${encodeURIComponent(filename)}`, { responseType: 'blob' })
      .then(({ data }) => {
        currentUrl = URL.createObjectURL(data);
        if (active) setObjectUrl(currentUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [filename]);

  if (failed) return <span className="text-sm text-secondary-token">Fail tidak dapat dimuatkan: {label}</span>;
  if (!objectUrl) return <span className="text-sm text-secondary-token">Memuatkan {label}...</span>;
  if (image) {
    return (
      <a href={objectUrl} target="_blank" rel="noreferrer" className={className}>
        <img src={objectUrl} alt={label} className="h-48 w-full rounded-md object-contain" />
      </a>
    );
  }
  return (
    <a href={objectUrl} target="_blank" rel="noreferrer" className={className}>
      <Paperclip size={14} /> {label}
    </a>
  );
}

export function AttachmentLinks({ value, label = 'Lampiran bukti' }) {
  const paths = parseAttachmentPaths(value);
  if (!paths.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {paths.map((path, index) => (
        <ProtectedAttachment
          key={`${path}-${index}`}
          path={path}
          label={paths.length > 1 ? `${label} ${index + 1}` : label}
          className="text-primary-token inline-flex items-center gap-1 text-sm font-medium underline"
        />
      ))}
    </div>
  );
}

export function EvidencePreview({ value }) {
  const paths = parseAttachmentPaths(value);
  if (!paths.length) return null;
  const imagePaths = paths.filter((path) => /\.(jpe?g|png|webp)$/i.test(path));
  const documentPaths = paths.filter((path) => !/\.(jpe?g|png|webp)$/i.test(path));
  return (
    <section>
      <p className="document-section-title">Bukti Bergambar</p>
      {imagePaths.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {imagePaths.map((path, index) => (
            <div key={path} className="rounded-lg border bg-white p-2">
              <ProtectedAttachment
                path={path}
                label={`Bukti laporan ${index + 1}`}
                image
                className="block"
              />
              <p className="mt-2 text-center text-xs font-medium text-primary-token">Bukti gambar {index + 1}</p>
            </div>
          ))}
        </div>
      ) : <p className="document-box text-secondary-token">Tiada gambar dilampirkan untuk laporan ini.</p>}
      {documentPaths.length > 0 && (
        <div className="mt-3">
          <p className="label-caps mb-2">Lampiran dokumen</p>
          <AttachmentLinks value={documentPaths} label="Buka dokumen" />
        </div>
      )}
    </section>
  );
}

export function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t py-4">
      <p className="text-sm text-secondary-token">Muka surat {page} daripada {totalPages}</p>
      <div className="flex gap-2">
        <Button variant="ghost" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Sebelumnya</Button>
        <Button variant="ghost" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Seterusnya</Button>
      </div>
    </div>
  );
}
