/**
 * A board built fresh takes one question (server docs/billing/02), and its response carries the plan status after that
 * charge as `usage`. The board clients announce it here and ProfileGate applies it, so the "N of 20 questions used" line
 * moves as soon as the board shows, without the board pages knowing about the plan.
 */
import type { PlanStatus } from './billing';

export const PLAN_USAGE_EVENT = 'aiastra:plan-usage';

/** Passes on a `usage` from a response body; anything that is not a plan status is ignored. */
export function announceUsage(usage: unknown): void {
  if (typeof window === 'undefined' || !usage || typeof usage !== 'object' || typeof (usage as { used?: unknown }).used !== 'number') return;
  window.dispatchEvent(new CustomEvent<PlanStatus>(PLAN_USAGE_EVENT, { detail: usage as PlanStatus }));
}

/** Calls `apply` with each announced usage; returns the unsubscribe. */
export function onUsage(apply: (usage: PlanStatus) => void): () => void {
  const h = (e: Event) => apply((e as CustomEvent<PlanStatus>).detail);
  window.addEventListener(PLAN_USAGE_EVENT, h);
  return () => window.removeEventListener(PLAN_USAGE_EVENT, h);
}
