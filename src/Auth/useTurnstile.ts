import { useCallback, useRef, useState } from 'react';

export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() || '';

export function useTurnstile() {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resetFnRef = useRef<(() => void) | undefined>();

  const isEnabled = Boolean(TURNSTILE_SITE_KEY);

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

  const registerReset = useCallback((fn: () => void) => {
    resetFnRef.current = fn;
  }, []);

  const reset = useCallback(() => {
    setToken(null);
    setError(null);
    resetFnRef.current?.();
  }, []);

  const requireToken = useCallback((): string | null => {
    if (!isEnabled) return null;
    return token;
  }, [isEnabled, token]);

  return {
    isEnabled,
    siteKey: TURNSTILE_SITE_KEY,
    token,
    error,
    onSuccess,
    onExpire,
    onError,
    registerReset,
    reset,
    requireToken,
  };
}
