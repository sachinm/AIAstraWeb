import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
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

  it('defaults idle timeout to 10 minutes', () => {
    expect(getSessionIdleMs()).toBe(600_000);
  });

  it('detects expired idle session when lastActivity is older than idle ms', () => {
    const idleMs = getSessionIdleMs();
    sessionStorage.setItem(
      'lastActivityAt',
      String(Date.now() - idleMs - 1000)
    );
    expect(isSessionIdleExpired()).toBe(true);
  });

  it('does not expire when activity was recent', () => {
    touchActivity();
    expect(isSessionIdleExpired()).toBe(false);
  });

  it('treats missing lastActivity with stored auth as expired', () => {
    localStorage.setItem('token', 'x');
    expect(isSessionIdleExpired()).toBe(true);
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
