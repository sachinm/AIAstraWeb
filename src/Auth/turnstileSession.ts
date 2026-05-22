import { getSessionIdleMs } from './sessionIdle';

export const TURNSTILE_VERIFIED_KEY = 'turnstileVerifiedAt';

const MAX_TTL_MS = 30 * 60 * 1000;

export function getTurnstileVerificationTtlMs(): number {
  return Math.min(getSessionIdleMs(), MAX_TTL_MS);
}

export function markTurnstileVerified(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(TURNSTILE_VERIFIED_KEY, String(Date.now()));
}

export function clearTurnstileVerification(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(TURNSTILE_VERIFIED_KEY);
}

export function isTurnstileVerificationValid(): boolean {
  if (typeof window === 'undefined') return false;
  const raw = sessionStorage.getItem(TURNSTILE_VERIFIED_KEY);
  if (!raw) return false;
  const at = Number(raw);
  if (!Number.isFinite(at)) {
    clearTurnstileVerification();
    return false;
  }
  if (Date.now() - at > getTurnstileVerificationTtlMs()) {
    clearTurnstileVerification();
    return false;
  }
  return true;
}
