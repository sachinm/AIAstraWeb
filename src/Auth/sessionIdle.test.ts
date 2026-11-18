import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  clearActivityStamp,
  decodeJwtExpMs,
  isJwtExpired,
  isSessionIdleExpired,
  touchActivity,
  getSessionIdleMs,
} from './sessionIdle';

describe('sessionIdle', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.stubEnv('VITE_SESSION_IDLE_MS', '');
  });

  it('defaults idle timeout to 30 minutes', () => {
    expect(getSessionIdleMs()).toBe(1_800_000);
  });

  it('detects expired idle session when lastActivity is older than idle ms', () => {
    const idleMs = getSessionIdleMs();
    localStorage.setItem('lastActivityAt', String(Date.now() - idleMs - 1000));
    expect(isSessionIdleExpired()).toBe(true);
  });

  it('does not expire when activity was recent, and stores the stamp in localStorage (survives a tab reload)', () => {
    touchActivity();
    expect(isSessionIdleExpired()).toBe(false);
    expect(localStorage.getItem('lastActivityAt')).not.toBeNull();
  });

  // 2026-11-18: Chrome on a phone reloads a background tab with an empty sessionStorage; a valid token must survive it
  it('a missing stamp with a stored token is not idle (reloaded or new tab after an app switch)', () => {
    localStorage.setItem('token', 'x');
    expect(isSessionIdleExpired()).toBe(false);
  });

  it('a reload after a short app switch keeps the session: the stamp is read back from localStorage', () => {
    localStorage.setItem('token', 'x');
    localStorage.setItem('lastActivityAt', String(Date.now() - 2 * 60_000));
    sessionStorage.clear(); // what the tab reload left behind
    expect(isSessionIdleExpired()).toBe(false);
  });

  it('still reads an older sessionStorage stamp written by the previous build', () => {
    const idleMs = getSessionIdleMs();
    sessionStorage.setItem('lastActivityAt', String(Date.now() - idleMs - 1000));
    expect(isSessionIdleExpired()).toBe(true);
  });

  it('clearActivityStamp removes the stamp from both stores', () => {
    localStorage.setItem('lastActivityAt', '1');
    sessionStorage.setItem('lastActivityAt', '1');
    clearActivityStamp();
    expect(localStorage.getItem('lastActivityAt')).toBeNull();
    expect(sessionStorage.getItem('lastActivityAt')).toBeNull();
  });

  it('decodes JWT exp and detects expiry', () => {
    const expSec = Math.floor(Date.now() / 1000) - 60;
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({ sub: 'u1', exp: expSec }));
    const token = `${header}.${payload}.sig`;
    expect(decodeJwtExpMs(token)).toBe(expSec * 1000);
    expect(isJwtExpired(token)).toBe(true);
  });
});
