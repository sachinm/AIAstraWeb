import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { clearClientSession, KEPT_LOCAL_STORAGE_KEYS, performLogout } from './logout';
import { readSignupDraft, saveSignupDraft } from './signupDraft';

vi.mock('../lib/graphql', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/graphql')>();
  return {
    ...actual,
    clearAuth: vi.fn(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
    }),
  };
});

function okLogoutResponse(): Response {
  return new Response(JSON.stringify({ data: { logout: true } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function sentBody(fetchMock: ReturnType<typeof vi.fn>): string {
  const init = fetchMock.mock.calls[0][1] as RequestInit;
  return String(init.body);
}

describe('logout', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

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
    fetchMock = vi.fn(async () => okLogoutResponse());
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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

  it('sends the Logout mutation with the auth header before clearing the session', async () => {
    performLogout({ reason: 'manual', redirect: false });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sentBody(fetchMock)).toContain('mutation Logout');
    expect(sentBody(fetchMock)).toContain('logout');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer jwt');
    expect(headers['X-Astra-Authorization']).toBe('Bearer jwt');
    // Local session is cleared regardless of the in-flight request.
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('sends the mutation on idle logout as well', async () => {
    performLogout({ reason: 'idle', redirect: false });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sentBody(fetchMock)).toContain('mutation Logout');
  });

  it.each([
    ['network failure', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['HTTP 500', async () => new Response('boom', { status: 500 })],
    [
      'GraphQL error body',
      async () =>
        new Response(JSON.stringify({ errors: [{ message: 'internal' }] }), { status: 200 }),
    ],
  ])('local state is cleared when the server call fails (%s)', async (_label, impl) => {
    fetchMock.mockImplementation(impl as () => Promise<Response>);
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);

    expect(() => performLogout({ reason: 'manual', redirect: false })).not.toThrow();

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('userId')).toBeNull();
    expect(localStorage.getItem('astroUser')).toBeNull();
    expect(localStorage.getItem('isAuthenticated')).toBeNull();
    expect(sessionStorage.getItem('lastActivityAt')).toBeNull();

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(debugSpy).toHaveBeenCalled());
  });

  it('does not call the server for expired sessions', () => {
    performLogout({ reason: 'expired', redirect: false });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('does not call the server from a tab reacting to a broadcast', () => {
    performLogout({ reason: 'idle', redirect: false, broadcast: false });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('does not call the server when there is no token', () => {
    localStorage.removeItem('token');
    performLogout({ reason: 'manual', redirect: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe('sign-out wipes what the app wrote (privacy B0.3)', () => {
    const SENTINEL = 'SENTINEL-personal-27/04/1990-Pune';

    function fillEveryAppKey() {
      // localStorage: every key the app writes, plus an unknown key holding a personal value
      localStorage.setItem('token', 'jwt');
      localStorage.setItem('userId', 'u1');
      localStorage.setItem('astroUser', JSON.stringify({ name: 'Asha', dateOfBirth: '1990-04-27', placeOfBirth: 'Pune', timeOfBirth: '00:05' }));
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('aa_visit', 'v1');
      localStorage.setItem('sessionLogoutAt', '1');
      localStorage.setItem('aiastra.region', 'IN');
      localStorage.setItem('aiastra.chat.sidebars', JSON.stringify({ leftOpen: false, rightOpen: true }));
      localStorage.setItem('someFutureKey', SENTINEL);
      // sessionStorage: every key the app writes or wrote in older builds, plus a sentinel
      sessionStorage.setItem('lastActivityAt', String(Date.now()));
      sessionStorage.setItem('aa_visit_logged', '1');
      sessionStorage.setItem('aiastra.registration.details', JSON.stringify({ city: 'Pune', dob: '27/04/1990' }));
      sessionStorage.setItem('aiastra.questionLocation', JSON.stringify({ status: 'granted', location: { lat: 18.52, lon: 73.86 } }));
      sessionStorage.setItem('someFutureKey', SENTINEL);
      saveSignupDraft({ city: 'Pune', dob: '27/04/1990' });
    }

    function storageText(store: Storage): string {
      let out = '';
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i)!;
        out += `${k}=${store.getItem(k)};`;
      }
      return out;
    }

    it('keeps only the region switch and the reading-UI preferences', () => {
      expect([...KEPT_LOCAL_STORAGE_KEYS].sort()).toEqual(['aiastra.chat.sidebars', 'aiastra.region']);
    });

    it.each([
      ['manual', { reason: 'manual' as const, redirect: false }],
      ['idle', { reason: 'idle' as const, redirect: false }],
      ['expired', { reason: 'expired' as const, redirect: false, broadcast: false }],
      ['broadcast from another tab', { reason: 'idle' as const, redirect: false, broadcast: false }],
    ])('after a %s sign-out sessionStorage is empty and localStorage holds only the kept keys', (_label, opts) => {
      fillEveryAppKey();
      performLogout(opts);

      expect(sessionStorage.length).toBe(0);
      const remaining: string[] = [];
      for (let i = 0; i < localStorage.length; i++) remaining.push(localStorage.key(i)!);
      expect(remaining.sort()).toEqual([...KEPT_LOCAL_STORAGE_KEYS].sort());
      expect(localStorage.getItem('aiastra.region')).toBe('IN');
      expect(storageText(localStorage)).not.toContain('SENTINEL');
      expect(storageText(localStorage)).not.toContain('Pune');
      expect(readSignupDraft()).toBeNull();
    });

    it('sign-out works when storage throws', () => {
      fillEveryAppKey();
      const spy = vi.spyOn(Storage.prototype, 'clear').mockImplementation(() => {
        throw new Error('blocked');
      });
      expect(() => performLogout({ reason: 'manual', redirect: false })).not.toThrow();
      spy.mockRestore();
      expect(readSignupDraft()).toBeNull();
    });

    it('the start-up auth clear (no session) leaves the anonymous visit id alone', () => {
      fillEveryAppKey();
      clearClientSession();
      expect(localStorage.getItem('aa_visit')).toBe('v1');
      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('astroUser')).toBeNull();
    });
  });
});
