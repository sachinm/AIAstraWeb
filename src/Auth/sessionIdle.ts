/**
 * Idle sign-out. The last-activity time lives in `localStorage` (2026-11-18): on a phone, Chrome unloads a background
 * tab and reloads it when the person comes back, and a new tab starts with an empty `sessionStorage`. The old
 * `sessionStorage` stamp was therefore missing on return, which read as "idle" and signed a person with a valid token
 * out after a short app switch. Now:
 * - the stamp is shared by every tab and survives a tab reload or discard;
 * - a missing stamp with a valid token is a fresh session (the token's own expiry stays the hard limit);
 * - no meta-refresh redirect: a page whose timers were frozen in the background is checked on return instead.
 */
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
  return 1_800_000;
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

/** Storage can throw (private mode, blocked site data); a failed read or write never signs anyone out. */
function readStamp(): string | null {
  try {
    return localStorage.getItem(LAST_ACTIVITY_KEY) ?? sessionStorage.getItem(LAST_ACTIVITY_KEY);
  } catch {
    return null;
  }
}

function writeStamp(ms: number): void {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(ms));
  } catch {
    /* storage unavailable: the in-memory timer still runs */
  }
}

/** Clears the stamp (sign-out): both stores, so an old `sessionStorage` stamp cannot linger. */
export function clearActivityStamp(): void {
  try {
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    sessionStorage.removeItem(LAST_ACTIVITY_KEY);
  } catch {
    /* nothing to clear */
  }
}

/** a scroll fires many events: the stamp is written at most every few seconds (the idle window is minutes) */
const STAMP_EVERY_MS = 5_000;
let lastWrite = 0;

export function touchActivity(): void {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (now - lastWrite >= STAMP_EVERY_MS || !readStamp()) {
    writeStamp(now);
    lastWrite = now;
  }
  resetIdleTimer();
}

export function isSessionIdleExpired(): boolean {
  if (typeof window === 'undefined') return false;
  const raw = readStamp();
  // no stamp (a reloaded or new tab, or storage blocked): not idle; the token's expiry is the limit
  if (!raw) return false;
  const last = Number(raw);
  if (!Number.isFinite(last)) return false;
  return Date.now() - last > SESSION_IDLE_MS;
}

function resetIdleTimer(): void {
  if (idleTimer !== undefined) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (isSessionIdleExpired()) onIdleCallback?.();
  }, SESSION_IDLE_MS);
}

/** Removes the meta-refresh tag an older build added (it redirected to sign-in on a timer, unchecked). */
export function removeMetaRefresh(): void {
  if (typeof document === 'undefined') return;
  document.getElementById(META_REFRESH_ID)?.remove();
}

function onActivity(): void {
  touchActivity();
}

function onStorage(e: StorageEvent): void {
  if (e.key === LAST_ACTIVITY_KEY && e.newValue) {
    // another tab was active: this tab's idle clock restarts too
    resetIdleTimer();
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
  else touchActivity();
}

export function startIdleSessionWatcher(onIdle: () => void): void {
  if (typeof window === 'undefined') return;
  stopIdleSessionWatcher();
  onIdleCallback = onIdle;
  removeMetaRefresh();
  // check before stamping: a tab coming back after the idle window still signs out
  if (isSessionIdleExpired()) {
    onIdle();
    return;
  }
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
