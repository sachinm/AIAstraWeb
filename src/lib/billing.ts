/**
 * Plans and checkout (docs/billing/README.md in the server repo). The server owns the prices and the access rule; choosing
 * a plan only records it until a payment sets the paid flag.
 */
import { buildApiHeaders } from './apiHeaders';
import { ledgerApiUrl } from './ledgerApi';

export type PlanCode = 'free' | 'plus' | 'unlimited';
export type PlanInterval = 'month' | 'year';
export type Region = 'US' | 'IN';

/** `me.plan`, and `usage` on chat responses. */
export interface PlanStatus {
  code: PlanCode;
  desired_plan: PlanCode | null;
  desired_interval: PlanInterval | null;
  is_paid: boolean;
  interval: PlanInterval | null;
  used: number;
  /** null when exempt */
  limit: number | null;
  /** null when exempt */
  remaining: number | null;
  window: 'lifetime' | 'month' | 'day' | 'none';
  resets_at: string | null;
  exempt: boolean;
}

export interface PlanPrice {
  amount_minor: number;
  currency: string;
}

export interface CatalogPlan {
  code: PlanCode;
  name: string;
  limit: number | null;
  window: PlanStatus['window'];
  prices: { month: PlanPrice; year: PlanPrice } | null;
}

export interface PlanCatalog {
  country: string | null;
  region: Region;
  currency: 'USD' | 'INR';
  gateway: string | null;
  plans: CatalogPlan[];
}

export interface CheckoutResult {
  status: 'pending_payment' | 'redirect';
  checkout_url: string | null;
  plan: PlanStatus | null;
}

/** The server said no more questions in this window (HTTP 402, or an SSE error). */
export class QuotaExhaustedError extends Error {
  readonly usage: PlanStatus | null;
  constructor(usage: PlanStatus | null, message?: string) {
    super(message || 'You have used your questions.');
    this.name = 'QuotaExhaustedError';
    this.usage = usage;
  }
}

/** True when this plan cannot ask another question right now. */
export function isExhausted(plan: PlanStatus | null): boolean {
  return Boolean(plan && !plan.exempt && plan.remaining === 0);
}

/** The catalog in the currency for this region, or for the detected country when none is given. Null on failure. */
export async function fetchPlans(region?: Region | null): Promise<PlanCatalog | null> {
  try {
    const res = await fetch(ledgerApiUrl(`/api/billing/plans${region ? `?region=${region}` : ''}`));
    if (!res.ok) return null;
    return (await res.json()) as PlanCatalog;
  } catch (e) {
    console.debug('fetchPlans failed', e instanceof Error ? e.message : String(e));
    return null;
  }
}

/** Records the desired plan and returns where to pay, when a gateway is set up. Throws when it could not be saved. */
export async function startCheckout(plan: PlanCode, interval: PlanInterval, region?: Region | null): Promise<CheckoutResult> {
  const token = localStorage.getItem('token');
  const body = JSON.stringify({ plan, interval, ...(region ? { region } : {}) });
  const headers = await buildApiHeaders({ token, body, method: 'POST' });
  const res = await fetch(ledgerApiUrl('/api/billing/checkout'), { method: 'POST', headers, body });
  if (!res.ok) throw new Error(`Checkout failed (${res.status})`);
  return (await res.json()) as CheckoutResult;
}
