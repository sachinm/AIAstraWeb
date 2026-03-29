import { useCallback } from 'react';

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY?.trim() || '';

let scriptPromise: Promise<void> | null = null;

function loadRecaptchaScript(): Promise<void> {
  if (!SITE_KEY) return Promise.resolve();
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.grecaptcha?.execute) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(
      `script[src^="https://www.google.com/recaptcha/api.js"]`
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('reCAPTCHA script failed')), {
        once: true,
      });
      return;
    }
    const s = document.createElement('script');
    s.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(SITE_KEY)}`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('reCAPTCHA script failed'));
    document.head.appendChild(s);
  });

  return scriptPromise;
}

/**
 * Google reCAPTCHA v3: returns a token per action. If VITE_RECAPTCHA_SITE_KEY is unset, getToken returns null (backend must not require reCAPTCHA).
 */
export function useRecaptcha() {
  const getToken = useCallback(async (action: string): Promise<string | null> => {
    if (!SITE_KEY) return null;
    try {
      await loadRecaptchaScript();
    } catch {
      return null;
    }
    return new Promise((resolve) => {
      const g = window.grecaptcha;
      if (!g) {
        resolve(null);
        return;
      }
      g.ready(() => {
        g.execute(SITE_KEY, { action })
          .then((token) => resolve(token))
          .catch(() => resolve(null));
      });
    });
  }, []);

  return { getToken, isEnabled: Boolean(SITE_KEY) };
}
