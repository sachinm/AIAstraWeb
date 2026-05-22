import { clearAuth } from '../lib/graphql';
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
  clearClientSession();

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
