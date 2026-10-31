export function NotificationCount({ count }) {
  return Number(count) > 0 ? <span className="workspace-notification-count" aria-label={`${count} notifikasi belum dibaca`}>{count > 99 ? '99+' : count}</span> : null;
}
