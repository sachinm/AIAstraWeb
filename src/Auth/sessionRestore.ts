import type { User } from '../App';
import { getUserId } from '../lib/graphql';
import { isJwtExpired, isSessionIdleExpired } from './sessionIdle';
import { readStoredUser } from './storedUser';

export function hasAuthToken(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem('token'));
}

/** Valid JWT present and idle window not exceeded. */
export function isAuthSessionValid(): boolean {
  if (typeof window === 'undefined') return false;
  const token = localStorage.getItem('token');
  if (!token) return false;
  if (isJwtExpired(token)) return false;
  if (isSessionIdleExpired()) return false;
  return true;
}

/** The stored display name; legacy birth fields are dropped (see storedUser.ts). */
export function parseStoredUser(): User | null {
  return readStoredUser();
}

/** Profile from signup, or minimal placeholder when only JWT/userId exist (code login). */
export function resolveUserForSession(): User | null {
  const parsed = parseStoredUser();
  if (parsed) return parsed;

  const userId = getUserId();
  if (!userId || !hasAuthToken()) return null;

  return { name: 'User' };
}

export interface RestoredSession {
  isAuthenticated: boolean;
  user: User | null;
}

export function restoreSessionFromStorage(): RestoredSession {
  if (!isAuthSessionValid()) {
    return { isAuthenticated: false, user: null };
  }
  const user = resolveUserForSession();
  return { isAuthenticated: true, user };
}
