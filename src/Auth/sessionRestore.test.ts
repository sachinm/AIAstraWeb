import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isAuthSessionValid,
  restoreSessionFromStorage,
  resolveUserForSession,
} from './sessionRestore';

describe('sessionRestore', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.stubEnv('VITE_SESSION_IDLE_MS', '');
  });

  it('restores authenticated session from token and userId without astroUser', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const payload = btoa(JSON.stringify({ sub: 'u1', exp }));
    const token = `h.${payload}.s`;
    localStorage.setItem('token', token);
    localStorage.setItem('userId', 'u1');
    sessionStorage.setItem('lastActivityAt', String(Date.now()));

    expect(isAuthSessionValid()).toBe(true);
    const user = resolveUserForSession();
    expect(user?.email).toBe('u1');
    const restored = restoreSessionFromStorage();
    expect(restored.isAuthenticated).toBe(true);
    expect(restored.user).not.toBeNull();
  });

  it('does not restore when token is missing', () => {
    expect(restoreSessionFromStorage().isAuthenticated).toBe(false);
  });
});
