import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEMED_PREFIXES as THEMED, THEME_KEY, isThemedPath, loadThemeChoice, resetThemeForTests, useAppliedTheme, useTheme } from './theme';

/** useTheme on a signed-in page, with ThemeScope's applying alongside. */
function useOnPage(pathname = '/dashboard/you') {
  const r = useTheme();
  useAppliedTheme(pathname);
  return r;
}

/** A controllable prefers-color-scheme: dark query. */
function mockOsTheme(initialDark: boolean) {
  let dark = initialDark;
  const listeners = new Set<() => void>();
  const mq = {
    get matches() {
      return dark;
    },
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
  };
  window.matchMedia = vi.fn().mockReturnValue(mq) as unknown as typeof window.matchMedia;
  return {
    set(next: boolean) {
      dark = next;
      listeners.forEach((l) => l());
    },
    listenerCount: () => listeners.size,
  };
}

const root = document.documentElement;
const originalMatchMedia = window.matchMedia;

beforeEach(() => {
  localStorage.clear();
  root.classList.remove('dark', 'light');
  root.style.colorScheme = '';
  resetThemeForTests();
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  vi.restoreAllMocks();
});

describe('useTheme', () => {
  it('defaults to System and follows a light device', () => {
    mockOsTheme(false);
    const { result } = renderHook(() => useOnPage());
    expect(result.current[0]).toBe('system');
    expect(result.current[2]).toBe('light');
    expect(root.classList.contains('light')).toBe(true);
    expect(root.classList.contains('dark')).toBe(false);
    expect(root.style.colorScheme).toBe('light');
  });

  it('defaults to System and follows a dark device', () => {
    mockOsTheme(true);
    const { result } = renderHook(() => useOnPage());
    expect(result.current[0]).toBe('system');
    expect(result.current[2]).toBe('dark');
    expect(root.classList.contains('dark')).toBe(true);
  });

  it('persists the choice and applies its class', () => {
    mockOsTheme(true);
    const { result } = renderHook(() => useOnPage());
    act(() => result.current[1]('light'));
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
    expect(result.current[0]).toBe('light');
    expect(root.classList.contains('light')).toBe(true);
    expect(root.classList.contains('dark')).toBe(false);

    act(() => result.current[1]('dark'));
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(root.classList.contains('dark')).toBe(true);
    expect(root.classList.contains('light')).toBe(false);
  });

  it('reads a saved choice on the next visit', () => {
    mockOsTheme(true);
    localStorage.setItem(THEME_KEY, 'light');
    const { result } = renderHook(() => useOnPage());
    expect(result.current[0]).toBe('light');
    expect(root.classList.contains('light')).toBe(true);
  });

  it('reacts to the device setting while on System, and ignores it otherwise', () => {
    const os = mockOsTheme(false);
    const { result } = renderHook(() => useOnPage());
    expect(root.classList.contains('light')).toBe(true);

    act(() => os.set(true));
    expect(result.current[2]).toBe('dark');
    expect(root.classList.contains('dark')).toBe(true);

    act(() => result.current[1]('light'));
    expect(os.listenerCount()).toBe(0);
    act(() => os.set(false));
    act(() => os.set(true));
    expect(root.classList.contains('light')).toBe(true);
  });

  it('works when storage throws', () => {
    mockOsTheme(false);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(loadThemeChoice()).toBe('system');
    const { result } = renderHook(() => useOnPage());
    act(() => result.current[1]('dark'));
    expect(result.current[0]).toBe('dark');
    expect(root.classList.contains('dark')).toBe(true);
  });

  it('ignores a junk saved value', () => {
    localStorage.setItem(THEME_KEY, 'purple');
    expect(loadThemeChoice()).toBe('system');
  });
});

describe('phase 1: public pages stay dark', () => {
  it('themes only the signed-in areas', () => {
    expect(isThemedPath('/dashboard')).toBe(true);
    expect(isThemedPath('/dashboard/you')).toBe(true);
    expect(isThemedPath('/profile/locale')).toBe(true);
    expect(isThemedPath('/welcome')).toBe(true);
    for (const p of ['/', '/signin', '/signup', '/signup/details', '/pricing', '/terms', '/privacy', '/refunds', '/dashboardx']) {
      expect(isThemedPath(p)).toBe(false);
    }
  });

  it('puts dark on a public page whatever the choice, and the choice back on a signed-in one', () => {
    mockOsTheme(false);
    localStorage.setItem(THEME_KEY, 'light');
    const { rerender } = renderHook(({ path }) => useOnPage(path), { initialProps: { path: '/signin' } });
    expect(root.classList.contains('dark')).toBe(true);
    expect(root.classList.contains('light')).toBe(false);
    rerender({ path: '/dashboard/love' });
    expect(root.classList.contains('light')).toBe(true);
    rerender({ path: '/pricing' });
    expect(root.classList.contains('dark')).toBe(true);
  });
});

describe('index.html', () => {
  it('limits the early theme to the same signed-in areas', () => {
    const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');
    expect(html).toContain(`(${THEMED.map((p) => p.slice(1)).join('|')})(`);
  });

  it('sets the theme before the app script loads, from the same key', () => {
    const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');
    const script = html.indexOf(`localStorage.getItem('${THEME_KEY}')`);
    expect(script).toBeGreaterThan(0);
    expect(script).toBeLessThan(html.indexOf('/src/main.tsx'));
  });
});

describe('theme-light.css', () => {
  it('is up to date with the colour classes in src (run node scripts/gen-light-theme.mjs)', async () => {
    const url = pathToFileURL(resolve(__dirname, '../../scripts/gen-light-theme.mjs')).href;
    const gen = (await import(/* @vite-ignore */ url)) as { generate: (dir: string) => string };
    const expected = gen.generate(resolve(__dirname, '..'));
    const actual = readFileSync(resolve(__dirname, '../theme-light.css'), 'utf8').replace(/\r\n/g, '\n');
    expect(actual === expected).toBe(true);
  });
});
