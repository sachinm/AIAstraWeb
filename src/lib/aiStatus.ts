/**
 * "The assistant is unavailable" (the model provider refused for credit, rate or key reasons; the server marks such a
 * failure with `code: 'ai_unavailable'`). One shared switch: the full-screen notice shows, and every control that would
 * start a model call (Ask, the chat send, fresh-reading buttons) turns itself off. It lifts after a few minutes, or when
 * the person taps "Try again", so a short rate limit never locks anyone out for good.
 */
import { useSyncExternalStore } from 'react';

export const AI_UNAVAILABLE_MESSAGE = 'The assistant is temporarily unavailable due to usage limits. Please try again later.';

const KEY = 'aiastra:ai-unavailable-until';
const HOLD_MS = 5 * 60_000;

let until = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

try {
  until = Number(sessionStorage.getItem(KEY)) || 0;
} catch {
  /* storage can be blocked; the switch then lasts only for this page */
}

const emit = () => listeners.forEach((l) => l());

function arm() {
  clearTimeout(timer);
  const left = until - Date.now();
  if (left > 0) timer = setTimeout(clearAiUnavailable, left);
}
arm();

export function isAiUnavailable(): boolean {
  return until > Date.now();
}

/** A request failed with `ai_unavailable`: show the notice and turn the controls off. */
export function announceAiUnavailable(): void {
  until = Date.now() + HOLD_MS;
  noticeClosed = false;
  try {
    sessionStorage.setItem(KEY, String(until));
  } catch {
    /* ignore */
  }
  arm();
  emit();
}

export function clearAiUnavailable(): void {
  until = 0;
  noticeClosed = false;
  clearTimeout(timer);
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  emit();
}

let noticeClosed = false;

/** Hides the notice; the controls stay off until the hold ends. */
export function closeAiNotice(): void {
  noticeClosed = true;
  emit();
}

/** True while the full-screen notice should show. */
export function useAiNoticeOpen(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => isAiUnavailable() && !noticeClosed,
    () => false,
  );
}

/** True while the assistant is marked unavailable. */
export function useAiUnavailable(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    isAiUnavailable,
    () => false,
  );
}
