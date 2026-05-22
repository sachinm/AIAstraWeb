import { useCallback, useRef, useState } from 'react';

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() || '';

export function useTurnstile() {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resetRef = useRef<(() => void) | null>(null);

  const isEnabled = Boolean(SITE_KEY);

  const registerReset = useCallback((fn: () => void) => {
    resetRef.current = fn;
  }, []);

  const reset = useCallback(() => {
    setToken(null);
    setError(null);
    resetRef.current?.();
  }, []);

  const onSuccess = useCallback((value: string) => {
    setToken(value);
    setError(null);
  }, []);

  const onExpire = useCallback(() => {
    setToken(null);
  }, []);

  const onError = useCallback(() => {
    setToken(null);
    setError('Security check failed. Please try again.');
  }, []);

  /** Returns current token when enabled; null if missing (caller should block submit). */
  const requireToken = useCallback((): string | null => {
    if (!isEnabled) return null;
    return token;
  }, [isEnabled, token]);

  return {
    isEnabled,
    token,
    error,
    requireToken,
    reset,
    onSuccess,
    onExpire,
    onError,
    registerReset,
    siteKey: SITE_KEY,
  };
}
