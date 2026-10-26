import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  useQuestionLocation,
  roundCoord,
  QUESTION_LOCATION_STORAGE_KEY,
  QUESTION_LOCATION_TIMEOUT_MS,
} from './useQuestionLocation';

type Success = (pos: { coords: { latitude: number; longitude: number } }) => void;
type Failure = (err: { code: number; message: string }) => void;

const getCurrentPosition = vi.fn();

function grant(lat = 43.653226, lon = -79.383184) {
  getCurrentPosition.mockImplementation((ok: Success) => ok({ coords: { latitude: lat, longitude: lon } }));
}
function deny() {
  getCurrentPosition.mockImplementation((_ok: Success, fail: Failure) => fail({ code: 1, message: 'denied' }));
}

describe('useQuestionLocation', () => {
  beforeEach(() => {
    getCurrentPosition.mockReset();
    sessionStorage.clear();
    localStorage.clear();
    Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    // @ts-expect-error test cleanup of the stubbed property
    delete navigator.geolocation;
  });

  it('rounds to 2 decimals', () => {
    expect(roundCoord(43.653226)).toBe(43.65);
    expect(roundCoord(-79.386)).toBe(-79.39);
    expect(roundCoord(12.005)).toBeCloseTo(12.01, 2);
  });

  it('does not ask on mount, only when the location is first needed', async () => {
    grant();
    const onAsk = vi.fn();
    const { result } = renderHook(() => useQuestionLocation({ onAsk }));
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(onAsk).not.toHaveBeenCalled();
    expect(result.current.status).toBe('unasked');

    let loc: Awaited<ReturnType<typeof result.current.ensureLocation>> = null;
    await act(async () => {
      loc = await result.current.ensureLocation();
    });
    expect(onAsk).toHaveBeenCalledTimes(1);
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(getCurrentPosition.mock.calls[0]![2]).toMatchObject({ enableHighAccuracy: false, timeout: 5000 });
    expect(loc).toEqual({ lat: 43.65, lon: -79.38, tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
    expect(result.current.status).toBe('granted');
  });

  it('caches the location for later questions and in sessionStorage only', async () => {
    grant();
    const { result, unmount } = renderHook(() => useQuestionLocation());
    await act(async () => {
      await result.current.ensureLocation();
    });
    await act(async () => {
      await result.current.ensureLocation();
    });
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(JSON.parse(sessionStorage.getItem(QUESTION_LOCATION_STORAGE_KEY)!)).toMatchObject({ status: 'granted', location: { lat: 43.65, lon: -79.38 } });
    expect(localStorage.length).toBe(0);
    unmount();

    // a remount in the same session reuses it without asking
    const second = renderHook(() => useQuestionLocation());
    expect(second.result.current.status).toBe('granted');
    let loc: unknown;
    await act(async () => {
      loc = await second.result.current.ensureLocation();
    });
    expect(loc).toMatchObject({ lat: 43.65, lon: -79.38 });
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it('denied gives no location and is not asked again this session', async () => {
    deny();
    const onAsk = vi.fn();
    const { result, unmount } = renderHook(() => useQuestionLocation({ onAsk }));
    let loc: unknown = 'x';
    await act(async () => {
      loc = await result.current.ensureLocation();
    });
    expect(loc).toBeNull();
    expect(result.current.status).toBe('denied');
    await act(async () => {
      loc = await result.current.ensureLocation();
    });
    expect(loc).toBeNull();
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(onAsk).toHaveBeenCalledTimes(1);
    unmount();

    const again = renderHook(() => useQuestionLocation({ onAsk }));
    await act(async () => {
      loc = await again.result.current.ensureLocation();
    });
    expect(loc).toBeNull();
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it('an unanswered prompt times out after 5 s with no location and no re-ask', async () => {
    vi.useFakeTimers();
    getCurrentPosition.mockImplementation(() => {}); // prompt left open
    const { result } = renderHook(() => useQuestionLocation());
    let loc: unknown = 'x';
    await act(async () => {
      const p = result.current.ensureLocation().then((v) => (loc = v));
      await vi.advanceTimersByTimeAsync(QUESTION_LOCATION_TIMEOUT_MS);
      await p;
    });
    expect(loc).toBeNull();
    expect(result.current.status).toBe('denied');
    await act(async () => {
      await result.current.ensureLocation();
    });
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it('no geolocation API: no location, no ask line', async () => {
    // @ts-expect-error remove the API for this case
    delete navigator.geolocation;
    const onAsk = vi.fn();
    const { result } = renderHook(() => useQuestionLocation({ onAsk }));
    let loc: unknown = 'x';
    await act(async () => {
      loc = await result.current.ensureLocation();
    });
    expect(loc).toBeNull();
    expect(onAsk).not.toHaveBeenCalled();
    expect(result.current.status).toBe('denied');
  });

  it('reask asks the browser again after a denial', async () => {
    deny();
    const { result } = renderHook(() => useQuestionLocation());
    await act(async () => {
      await result.current.ensureLocation();
    });
    grant(19.076, 72.8777);
    let loc: unknown;
    await act(async () => {
      loc = await result.current.reask();
    });
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(loc).toMatchObject({ lat: 19.08, lon: 72.88 });
    expect(result.current.status).toBe('granted');
  });

  it('survives blocked sessionStorage', async () => {
    grant();
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useQuestionLocation());
    let loc: unknown;
    await act(async () => {
      loc = await result.current.ensureLocation();
    });
    expect(loc).toMatchObject({ lat: 43.65, lon: -79.38 });
    spy.mockRestore();
  });
});
