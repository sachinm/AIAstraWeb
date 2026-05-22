const LAST_ACTIVITY_KEY = 'lastActivityAt';
export const LOGOUT_BROADCAST_KEY = 'sessionLogoutAt';
const META_REFRESH_ID = 'session-idle-meta-refresh';

const ACTIVITY_EVENTS = [
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'click',
  'focus',
] as const;

export function getSessionIdleMs(): number {
  const env = import.meta.env.VITE_SESSION_IDLE_MS;
  if (env !== undefined && env !== '') {
    const n = Number(env);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 600_000;
}

export const SESSION_IDLE_MS = getSessionIdleMs();

let idleTimer: ReturnType<typeof setTimeout> | undefined;
let checkInterval: ReturnType<typeof setInterval> | undefined;
let onIdleCallback: (() => void) | null = null;

export function decodeJwtExpMs(token: string | null): number | null {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64)) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isJwtExpired(token: string | null): boolean {
  const expMs = decodeJwtExpMs(token);
  if (expMs === null) return false;
  return Date.now() >= expMs;
}

export function touchActivity(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  updateMetaRefresh();
  resetIdleTimer();
}

export function isSessionIdleExpired(): boolean {
  if (typeof window === 'undefined') return false;
  const raw = sessionStorage.getItem(LAST_ACTIVITY_KEY);
  if (!raw) {
    const hasAuth =
      localStorage.getItem('token') || localStorage.getItem('astroUser');
    return Boolean(hasAuth);
  }
  const last = Number(raw);
  if (!Number.isFinite(last)) return true;
  return Date.now() - last > SESSION_IDLE_MS;
}

function resetIdleTimer(): void {
  if (idleTimer !== undefined) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (isSessionIdleExpired()) onIdleCallback?.();
  }, SESSION_IDLE_MS);
}

function updateMetaRefresh(): void {
  if (typeof document === 'undefined') return;
  const raw = sessionStorage.getItem(LAST_ACTIVITY_KEY);
  if (!raw) return;
  const deadline = Number(raw) + SESSION_IDLE_MS;
  const seconds = Math.max(1, Math.ceil((deadline - Date.now()) / 1000));
  let meta = document.getElementById(META_REFRESH_ID) as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.id = META_REFRESH_ID;
    meta.httpEquiv = 'refresh';
    document.head.appendChild(meta);
  }
  meta.content = `${seconds};url=/signin?reason=idle`;
}

export function removeMetaRefresh(): void {
  if (typeof document === 'undefined') return;
  document.getElementById(META_REFRESH_ID)?.remove();
}

function onActivity(): void {
  touchActivity();
}

function onStorage(e: StorageEvent): void {
  if (e.key === LAST_ACTIVITY_KEY && e.newValue) {
    resetIdleTimer();
    updateMetaRefresh();
  }
  if (e.key === LOGOUT_BROADCAST_KEY && e.newValue) {
    const hasSession =
      localStorage.getItem('token') || localStorage.getItem('astroUser');
    if (hasSession) {
      void import('./logout').then(({ performLogout }) => {
        performLogout({ reason: 'idle', broadcast: false, redirect: true });
      });
    }
  }
}

function onVisibilityOrShow(): void {
  if (document.visibilityState === 'hidden') return;
  if (isSessionIdleExpired()) onIdleCallback?.();
}

export function startIdleSessionWatcher(onIdle: () => void): void {
  if (typeof window === 'undefined') return;
  stopIdleSessionWatcher();
  onIdleCallback = onIdle;
  touchActivity();
  for (const ev of ACTIVITY_EVENTS) {
    window.addEventListener(ev, onActivity, { passive: true });
  }
  window.addEventListener('storage', onStorage);
  document.addEventListener('visibilitychange', onVisibilityOrShow);
  window.addEventListener('pageshow', onVisibilityOrShow);
  checkInterval = setInterval(() => {
    if (isSessionIdleExpired()) onIdle();
  }, 30_000);
}

export function stopIdleSessionWatcher(): void {
  onIdleCallback = null;
  if (idleTimer !== undefined) clearTimeout(idleTimer);
  idleTimer = undefined;
  if (checkInterval !== undefined) clearInterval(checkInterval);
  checkInterval = undefined;
  if (typeof window !== 'undefined') {
    for (const ev of ACTIVITY_EVENTS) {
      window.removeEventListener(ev, onActivity);
    }
    window.removeEventListener('storage', onStorage);
    document.removeEventListener('visibilitychange', onVisibilityOrShow);
    window.removeEventListener('pageshow', onVisibilityOrShow);
  }
  removeMetaRefresh();
}

export function broadcastLogoutToOtherTabs(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOGOUT_BROADCAST_KEY, String(Date.now()));
  localStorage.removeItem(LOGOUT_BROADCAST_KEY);
}
