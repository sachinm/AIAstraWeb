/**
 * A quiet session refresh after a 401 (doc 75): one POST to the refresh route with the token held; a new token is stored
 * and the caller retries its request once. Any other answer (the route not live yet, a refusal, the network) is false,
 * and the caller tells the person their session ended. Concurrent callers share one request.
 */
import { buildApiHeaders } from './apiHeaders';
import { getUserId, setAuth } from './graphql';
import { ledgerApiUrl } from './ledgerApi';

export const SESSION_REFRESH_PATH = (import.meta.env.VITE_SESSION_REFRESH_PATH as string | undefined) || '/api/auth/refresh';

let inFlight: Promise<boolean> | null = null;

async function once(): Promise<boolean> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (!token) return false;
  try {
    const body = JSON.stringify({});
    const headers = await buildApiHeaders({ token, body, method: 'POST' });
    const r = await fetch(ledgerApiUrl(SESSION_REFRESH_PATH), { method: 'POST', headers, body, credentials: 'include' });
    if (!r.ok) return false;
    const j = (await r.json().catch(() => null)) as { token?: unknown; userId?: unknown } | null;
    if (!j || typeof j.token !== 'string' || !j.token) return false;
    setAuth(j.token, typeof j.userId === 'string' && j.userId ? j.userId : (getUserId() ?? ''));
    return true;
  } catch {
    return false;
  }
}

export function refreshSession(): Promise<boolean> {
  if (!inFlight) inFlight = once().finally(() => (inFlight = null));
  return inFlight;
}
