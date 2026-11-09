/**
 * The viewer's colour theme: Light, Dark, or System (follows the device's setting). Kept in this browser only, default
 * System. index.html sets the same class before React mounts, so the page never flashes the wrong theme; ThemeScope
 * (useAppliedTheme) keeps it in step after that.
 *
 * Phase 1 (Sachin, 2026-11-08): only the signed-in pages follow the choice. The public pages (landing, sign-in,
 * sign-up, pricing, legal) stay dark until phase 2 (docs/theme-phase-2.md). THEMED_PREFIXES is mirrored in index.html.
 */
import { useCallback, useEffect, useSyncExternalStore } from 'react';

export type ThemeChoice = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

export const THEME_KEY = 'aiastra.theme';
export const THEME_CHOICES: readonly ThemeChoice[] = ['system', 'light', 'dark'];

/** The signed-in areas that follow the viewer's theme; every other page is dark (phase 1). */
export const THEMED_PREFIXES: readonly string[] = ['/dashboard', '/profile', '/welcome'];

export function isThemedPath(pathname: string): boolean {
  return THEMED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** The browser bar colour per theme (meta theme-color). */
const BAR_COLOR: Record<Theme, string> = { dark: '#111827', light: '#f5f3ff' };

const listeners = new Set<() => void>();
let current: ThemeChoice | null = null;

export function loadThemeChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
  } catch {
    return 'system';
  }
}

function darkQuery(): MediaQueryList | null {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;
  } catch {
    return null;
  }
}

export function resolveTheme(choice: ThemeChoice): Theme {
  if (choice !== 'system') return choice;
  return darkQuery()?.matches === false ? 'light' : 'dark';
}

/** Puts the theme on <html>: `dark` or `light` class, color-scheme, and the browser bar colour. */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('light', theme === 'light');
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR_COLOR[theme]);
}

function getChoice(): ThemeChoice {
  if (current === null) current = loadThemeChoice();
  return current;
}

/** The store's snapshot: the choice and what it resolves to, so a device change re-renders while on System. */
function getSnapshot(): string {
  const choice = getChoice();
  return `${choice}:${resolveTheme(choice)}`;
}

export function setThemeChoice(choice: ThemeChoice): void {
  current = choice;
  try {
    localStorage.setItem(THEME_KEY, choice);
  } catch {
    /* storage unavailable: the choice lasts for this page only */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** For tests: forget the cached choice so the next read comes from storage. */
export function resetThemeForTests(): void {
  current = null;
}

/**
 * [choice, setChoice, resolved theme]. While the choice is System, a change to the device's setting re-themes the page
 * at once.
 */
export function useTheme(): [ThemeChoice, (choice: ThemeChoice) => void, Theme] {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => 'system:dark');
  const [choice, resolved] = snapshot.split(':') as [ThemeChoice, Theme];

  useEffect(() => {
    if (choice !== 'system') return undefined;
    const mq = darkQuery();
    if (!mq) return undefined;
    const onChange = () => listeners.forEach((l) => l());
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [choice]);

  const set = useCallback((next: ThemeChoice) => setThemeChoice(next), []);
  return [choice, set, resolved];
}

/** Puts the theme on <html> for this page: the viewer's theme on the signed-in pages, dark on the public ones. */
export function useAppliedTheme(pathname: string): Theme {
  const [, , resolved] = useTheme();
  const theme: Theme = isThemedPath(pathname) ? resolved : 'dark';
  useEffect(() => applyTheme(theme), [theme]);
  return theme;
}
