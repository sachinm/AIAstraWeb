import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearClientSession, performLogout } from './logout';

vi.mock('../lib/graphql', () => ({
  clearAuth: vi.fn(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
  }),
}));

describe('logout', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('token', 'jwt');
    localStorage.setItem('userId', 'u1');
    localStorage.setItem('astroUser', '{}');
    localStorage.setItem('isAuthenticated', 'true');
    sessionStorage.setItem('lastActivityAt', String(Date.now()));
    vi.stubGlobal('location', {
      pathname: '/dashboard/chat',
      search: '',
      assign: vi.fn(),
    });
  });

  it('clearClientSession removes all auth keys', () => {
    clearClientSession();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('userId')).toBeNull();
    expect(localStorage.getItem('astroUser')).toBeNull();
    expect(localStorage.getItem('isAuthenticated')).toBeNull();
    expect(sessionStorage.getItem('lastActivityAt')).toBeNull();
  });

  it('performLogout clears tokens without redirect when redirect is false', () => {
    performLogout({ reason: 'manual', redirect: false, broadcast: false });
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('astroUser')).toBeNull();
  });
});
