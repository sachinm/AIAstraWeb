import { clearAuth } from '../lib/graphql';
import { REGION_KEY } from '../lib/region';
import { clearSelfV3Persisted } from '../lib/selfV3Cache';
import { THEME_KEY } from '../lib/theme';
import { PREFS_KEY as READING_UI_PREFS_KEY } from '../pages/chat-interface/readingUi';
import { forgetQuestionLocation } from '../pages/chat-interface/useQuestionLocation';
import { requestServerLogout } from './api';
import { clearSignupDraft } from './signupDraft';
import {
  broadcastLogoutToOtherTabs,
  stopIdleSessionWatcher,
} from './sessionIdle';

export type LogoutReason = 'idle' | 'manual' | 'expired';

export interface PerformLogoutOptions {
  reason?: LogoutReason;
  /** When false, only clear storage (e.g. tab reacting to broadcast). */
  broadcast?: boolean;
  /** When false, do not hard-navigate (caller updates React state). */
  redirect?: boolean;
}

/**
 * The only localStorage keys that survive sign-out: the region switch (lib/region.ts), the reading-UI sidebar
 * preferences (readingUi.ts) and the colour theme (lib/theme.ts). None is personal. Everything else the app writes goes: token, userId, astroUser,
 * isAuthenticated, aa_visit (visit id) and the cross-tab logout signal (server docs/privacy/02 §4.3).
 */
export const KEPT_LOCAL_STORAGE_KEYS: readonly string[] = [REGION_KEY, READING_UI_PREFS_KEY, THEME_KEY];

/**
 * Sign-out wipe: all of sessionStorage, every localStorage key except KEPT_LOCAL_STORAGE_KEYS, and the in-memory
 * sign-up draft and question location. Storage can throw (private mode, blocked site data), so each part is guarded.
 */
export function clearAppStorage(): void {
  try {
    sessionStorage.clear();
  } catch {
    /* storage unavailable: nothing was written there */
  }
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k !== null && !KEPT_LOCAL_STORAGE_KEYS.includes(k)) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    /* storage unavailable: nothing was written there */
  }
  clearSignupDraft();
  forgetQuestionLocation();
}

/** Auth keys only; used at start-up for a missing or expired session. Sign-out also runs clearAppStorage. */
export function clearClientSession(): void {
  clearAuth();
  localStorage.removeItem('astroUser');
  localStorage.removeItem('isAuthenticated');
  sessionStorage.removeItem('lastActivityAt');
  stopIdleSessionWatcher();
}

export function performLogout(options?: PerformLogoutOptions): void {
  const reason = options?.reason ?? 'manual';
  const broadcast = options?.broadcast !== false;
  const redirect = options?.redirect !== false;

  if (broadcast) broadcastLogoutToOtherTabs();
  // Originating tab only (other tabs get broadcast:false), and not for expired sessions
  // (the token is already rejected). Must run before clearClientSession removes the token.
  if (broadcast && reason !== 'expired' && localStorage.getItem('token')) {
    void requestServerLogout();
  }
  clearClientSession();
  clearAppStorage();
  // The Self board's encrypted offline copy (memory + IndexedDB) belongs to the signed-in person only.
  void clearSelfV3Persisted();

  window.dispatchEvent(
    new CustomEvent('auth:logout', { detail: { reason } })
  );

  if (!redirect) return;

  const path =
    reason === 'idle' || reason === 'expired'
      ? '/signin?reason=idle'
      : '/';
  if (window.location.pathname + window.location.search !== path) {
    window.location.assign(path);
  }
}
