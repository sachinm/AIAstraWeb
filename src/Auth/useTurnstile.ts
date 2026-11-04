import { useCallback, useEffect, useRef, useState } from 'react';

export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() || '';

/** How long a submit waits for the check, retries included, before it gives up. */
export const TOKEN_WAIT_MS = 60_000;

type Waiter = (token: string | null) => void;

/**
 * The Cloudflare check, run unseen while the person fills in the form. A submit that comes before the check has finished
 * (autofill or a password manager can fill and submit in under a second) waits for the token with `waitForToken` and
 * goes on by itself, so nobody has to press the button twice.
 */
export function useTurnstile() {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** a submit is waiting for the token */
  const [awaiting, setAwaiting] = useState(false);
  /** Cloudflare wants the person to click, so the widget has to be shown */
  const [needsInteraction, setNeedsInteraction] = useState(false);
  const resetFnRef = useRef<(() => void) | undefined>();
  const tokenRef = useRef<string | null>(null);
  const errorRef = useRef<string | null>(null);
  const waitersRef = useRef<Waiter[]>([]);

  const isEnabled = Boolean(TURNSTILE_SITE_KEY);

  const settle = useCallback((value: string | null) => {
    const waiters = waitersRef.current;
    waitersRef.current = [];
    waiters.forEach((w) => w(value));
  }, []);

  useEffect(() => () => settle(null), [settle]);

  const onSuccess = useCallback(
    (value: string) => {
      tokenRef.current = value;
      errorRef.current = null;
      setToken(value);
      setError(null);
      setNeedsInteraction(false);
      settle(value);
    },
    [settle]
  );

  const onExpire = useCallback(() => {
    tokenRef.current = null;
    setToken(null);
  }, []);

  const onError = useCallback(() => {
    const message = 'Security check failed. Please try again.';
    tokenRef.current = null;
    errorRef.current = message;
    setToken(null);
    setError(message);
    // a waiting submit keeps waiting: the gate shows the failure with "Try again", and a fresh token still sends it
  }, []);

  const onBeforeInteractive = useCallback(() => setNeedsInteraction(true), []);
  const onAfterInteractive = useCallback(() => setNeedsInteraction(false), []);

  const registerReset = useCallback((fn: () => void) => {
    resetFnRef.current = fn;
  }, []);

  const reset = useCallback(() => {
    tokenRef.current = null;
    errorRef.current = null;
    setToken(null);
    setError(null);
    setNeedsInteraction(false);
    resetFnRef.current?.();
  }, []);

  /** The token now if there is one, otherwise the token once the check finishes; null if it fails or takes too long. */
  const waitForToken = useCallback(
    (timeoutMs: number = TOKEN_WAIT_MS): Promise<string | null> => {
      if (!isEnabled) return Promise.resolve(null);
      if (tokenRef.current) return Promise.resolve(tokenRef.current);
      // a check that failed in the background starts again, rather than failing the submit straight away
      if (errorRef.current) reset();
      setAwaiting(true);
      return new Promise<string | null>((resolve) => {
        let timer = 0;
        const finish: Waiter = (value) => {
          window.clearTimeout(timer);
          if (waitersRef.current.length === 0) setAwaiting(false);
          resolve(value);
        };
        timer = window.setTimeout(() => {
          waitersRef.current = waitersRef.current.filter((w) => w !== finish);
          finish(null);
        }, timeoutMs);
        waitersRef.current.push(finish);
      });
    },
    [isEnabled, reset]
  );

  return {
    isEnabled,
    siteKey: TURNSTILE_SITE_KEY,
    token,
    error,
    awaiting,
    needsInteraction,
    onSuccess,
    onExpire,
    onError,
    onBeforeInteractive,
    onAfterInteractive,
    registerReset,
    reset,
    waitForToken,
  };
}
