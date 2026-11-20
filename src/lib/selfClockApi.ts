/**
 * The Self clock switch (server docs/reading-engine/66 §4.4). The v3 Self header's clock sheet keeps this call when the
 * v2 Self reading is retired: the server keeps PUT /api/self/v2/clock. Moved here unchanged from selfV2Api.ts.
 *
 * PUT /api/self/v2/clock      -> 202 { usage, status: 'building', alsoChanges } | 400 { error }
 */
import { buildApiHeaders } from './apiHeaders';
import { ledgerApiUrl } from './ledgerApi';
import type { PlanStatus } from './billing';
import type { ClockChangeResult } from './boardTypes';

export async function changeSelfV2Clock(system: string): Promise<ClockChangeResult> {
  let r: Response;
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const body = JSON.stringify({ system });
    // buildApiHeaders sends X-Astra-Page (the page timing telemetry joins server timings to the page by it)
    const headers = await buildApiHeaders({ token, body, method: 'PUT' });
    r = await fetch(ledgerApiUrl('/api/self/v2/clock'), { method: 'PUT', headers, credentials: 'include', body });
  } catch {
    return { ok: false, error: 'failed' };
  }
  const j = (await r.json().catch(() => null)) as { usage?: PlanStatus; alsoChanges?: string[]; error?: string } | null;
  if (r.ok) return { ok: true, usage: j?.usage ?? null, alsoChanges: j?.alsoChanges ?? [] };
  if (r.status === 400 && (j?.error === 'not_applicable' || j?.error === 'unknown_system')) return { ok: false, error: j.error };
  return { ok: false, error: 'failed' };
}
