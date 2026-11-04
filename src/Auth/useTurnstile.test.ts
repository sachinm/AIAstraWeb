import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** The site key is read when the module loads, so each test loads it afresh with the check switched on. */
async function load() {
  vi.resetModules();
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'site');
  const { useTurnstile } = await import('./useTurnstile');
  return renderHook(() => useTurnstile());
}

describe('useTurnstile.waitForToken', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('gives the token at once when the check has already finished', async () => {
    const { result } = await load();
    act(() => result.current.onSuccess('tok'));
    await expect(result.current.waitForToken()).resolves.toBe('tok');
  });

  it('a submit before the check finishes (fast autofill) waits, then gets the token without a second click', async () => {
    const { result } = await load();
    let got: string | null | undefined;
    act(() => {
      void result.current.waitForToken().then((t) => (got = t));
    });
    expect(result.current.awaiting).toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(3_000);
    });
    expect(got).toBeUndefined();
    await act(async () => result.current.onSuccess('late'));
    expect(got).toBe('late');
    expect(result.current.awaiting).toBe(false);
  });

  it('keeps waiting through a failed check, so "Try again" can still send the request', async () => {
    const { result } = await load();
    let got: string | null | undefined;
    act(() => {
      void result.current.waitForToken().then((t) => (got = t));
    });
    await act(async () => result.current.onError());
    expect(got).toBeUndefined();
    expect(result.current.error).not.toBeNull();
    act(() => result.current.reset());
    await act(async () => result.current.onSuccess('retry'));
    expect(got).toBe('retry');
  });

  it('gives up with null after the time limit', async () => {
    const { result } = await load();
    let got: string | null | undefined;
    act(() => {
      void result.current.waitForToken(5_000).then((t) => (got = t));
    });
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(got).toBeNull();
    expect(result.current.awaiting).toBe(false);
  });

  it('a check that failed in the background starts again when the person submits', async () => {
    const { result } = await load();
    const resetWidget = vi.fn();
    act(() => result.current.registerReset(resetWidget));
    act(() => result.current.onError());
    act(() => {
      void result.current.waitForToken();
    });
    expect(resetWidget).toHaveBeenCalled();
  });

  it('tracks when Cloudflare wants a click', async () => {
    const { result } = await load();
    act(() => result.current.onBeforeInteractive());
    expect(result.current.needsInteraction).toBe(true);
    act(() => result.current.onSuccess('tok'));
    expect(result.current.needsInteraction).toBe(false);
  });
});
