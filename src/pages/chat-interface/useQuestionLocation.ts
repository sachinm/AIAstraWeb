import { useCallback, useEffect, useRef, useState } from 'react';
import { browserTimeZone } from './readingUi';

/**
 * Where a question is asked, for the server's prashna chart (server docs/reading-engine/28 §4). Sent only on
 * ask-stream / confirm-stream; when it is missing the server uses the birth place.
 */
export interface QuestionLocation {
  lat: number;
  lon: number;
  /** IANA zone from the browser, e.g. "America/Toronto" */
  tz?: string;
}

/** `unasked`: not asked yet this session. `asking`: the browser prompt is open. `denied` covers unavailable and timeout. */
export type QuestionLocationStatus = 'unasked' | 'asking' | 'granted' | 'denied';

export const QUESTION_LOCATION_TIMEOUT_MS = 5000;
export const QUESTION_LOCATION_ASK_TEXT =
  "Allow location so readings about 'right now' use where you are. Otherwise we use your birth place.";

type Stored = { status: 'granted'; location: QuestionLocation } | { status: 'denied' };

/** Two decimals is about 1 km: enough for a prashna chart, no finer than that leaves the browser. */
export function roundCoord(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * This tab's answer, in memory only (server docs/privacy/02 §4.3): never in sessionStorage or localStorage. It outlives
 * a remount of the chat, not a page refresh; sign-out forgets it.
 */
let remembered: Stored | null = null;

function readStored(): Stored | null {
  return remembered;
}

function writeStored(value: Stored | null): void {
  remembered = value;
}

/** Forget this tab's answer (sign-out, tests). */
export function forgetQuestionLocation(): void {
  remembered = null;
}

/**
 * Asks for the browser's position once per session, and only when `ensureLocation` is first called (after the first
 * question is sent), never on page load. Denied, unavailable or timed out means no location and no second ask; `reask`
 * is the only way to ask again (the "change" link). The result lives in memory only, for the tab's life.
 */
export function useQuestionLocation(options?: { onAsk?: () => void }) {
  const [initial] = useState(readStored);
  const [status, setStatus] = useState<QuestionLocationStatus>(initial?.status ?? 'unasked');
  const [location, setLocation] = useState<QuestionLocation | null>(initial?.status === 'granted' ? initial.location : null);
  const storedRef = useRef<Stored | null>(initial);
  const pendingRef = useRef<Promise<QuestionLocation | null> | null>(null);
  const mountedRef = useRef(true);
  const onAskRef = useRef(options?.onAsk);
  onAskRef.current = options?.onAsk;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const settle = useCallback((value: Stored) => {
    storedRef.current = value;
    writeStored(value);
    if (!mountedRef.current) return;
    setStatus(value.status);
    setLocation(value.status === 'granted' ? value.location : null);
  }, []);

  const request = useCallback((): Promise<QuestionLocation | null> => {
    if (pendingRef.current) return pendingRef.current;
    const geo = typeof navigator !== 'undefined' ? navigator.geolocation : undefined;
    if (!geo || typeof geo.getCurrentPosition !== 'function') {
      settle({ status: 'denied' });
      return Promise.resolve(null);
    }
    onAskRef.current?.();
    setStatus('asking');
    let done = false;
    const pending = new Promise<QuestionLocation | null>((resolve) => {
      const finish = (value: QuestionLocation | null) => {
        if (done) return;
        done = true;
        clearTimeout(cap);
        pendingRef.current = null;
        resolve(value);
      };
      // The browser's own timeout does not count the time its permission prompt is open, so cap the wait here too.
      // A late answer is still remembered for the next question.
      const cap = setTimeout(() => {
        if (storedRef.current?.status !== 'granted') settle({ status: 'denied' });
        finish(null);
      }, QUESTION_LOCATION_TIMEOUT_MS);
      try {
        geo.getCurrentPosition(
          (pos) => {
            const loc: QuestionLocation = { lat: roundCoord(pos.coords.latitude), lon: roundCoord(pos.coords.longitude) };
            const tz = browserTimeZone();
            if (tz) loc.tz = tz;
            settle({ status: 'granted', location: loc });
            finish(loc);
          },
          () => {
            settle({ status: 'denied' });
            finish(null);
          },
          { enableHighAccuracy: false, timeout: QUESTION_LOCATION_TIMEOUT_MS, maximumAge: 10 * 60 * 1000 }
        );
      } catch {
        settle({ status: 'denied' });
        finish(null);
      }
    });
    // a browser may answer synchronously (cached permission state): only keep the promise while it is still open
    if (!done) pendingRef.current = pending;
    return pending;
  }, [settle]);

  /** The location to send with this question, asking first if this session has not asked yet. */
  const ensureLocation = useCallback(async (): Promise<QuestionLocation | null> => {
    const stored = storedRef.current;
    if (stored?.status === 'granted') return stored.location;
    if (stored?.status === 'denied') return null;
    return request();
  }, [request]);

  /** The location already known, without asking (for follow-up calls in the same reading). */
  const currentLocation = useCallback((): QuestionLocation | null => {
    const stored = storedRef.current;
    return stored?.status === 'granted' ? stored.location : null;
  }, []);

  /** "Change": forget this session's answer and ask the browser again. */
  const reask = useCallback((): Promise<QuestionLocation | null> => {
    storedRef.current = null;
    writeStored(null);
    return request();
  }, [request]);

  return { status, location, ensureLocation, currentLocation, reask };
}
