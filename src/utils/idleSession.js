// Signs out an unattended device. Guard-post computers are often shared between shifts.
export const IDLE_LIMIT_MS = 30 * 60 * 1000;
export const ACTIVITY_KEY = 'penjaga_last_activity';

// A missing or unreadable timestamp counts as active, so an existing session is not dropped on upgrade.
export function isIdle(storage, now = Date.now()) {
  const last = Number(storage.getItem(ACTIVITY_KEY));
  return Number.isFinite(last) && last > 0 && now - last >= IDLE_LIMIT_MS;
}

export function startIdleWatch(onIdle, { storage = localStorage, target = window } = {}) {
  let lastWrite = 0;
  const check = () => { if (isIdle(storage)) onIdle(); };
  const record = () => {
    const now = Date.now();
    if (now - lastWrite < 10_000) return;
    // Check first: waking a sleeping laptop must not refresh an already expired session.
    if (isIdle(storage, now)) { onIdle(); return; }
    lastWrite = now;
    storage.setItem(ACTIVITY_KEY, String(now));
  };
  // Only input a person produces. `scroll` also fires when the page scrolls itself.
  const events = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'pointermove'];
  events.forEach(name => target.addEventListener(name, record, { passive: true, capture: true }));
  const timer = target.setInterval(check, 30_000);
  record();
  return () => {
    events.forEach(name => target.removeEventListener(name, record, { capture: true }));
    target.clearInterval(timer);
  };
}
