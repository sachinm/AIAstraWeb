/**
 * The personalization wizard's REST client (server docs/reading-engine/52 §5): the person's facts and their selfie.
 */
import { buildApiHeaders } from './apiHeaders';
import { ledgerApiUrl } from './ledgerApi';

export interface ProfileFacts {
  facts: Record<string, { value: string; source: string; confirmed_at: string | null }>;
  wizard: { done: string | null; skipped: string | null };
}

const token = () => (typeof window !== 'undefined' ? localStorage.getItem('token') : null);

export async function fetchFacts(): Promise<ProfileFacts | null> {
  const headers = await buildApiHeaders({ token: token(), method: 'GET' });
  const r = await fetch(ledgerApiUrl('/api/profile/facts'), { method: 'GET', headers });
  return r.ok ? ((await r.json()) as ProfileFacts) : null;
}

/** null = "I'd rather not say" */
export async function saveFacts(facts: Record<string, string | null>): Promise<boolean> {
  const body = JSON.stringify({ facts });
  const headers = await buildApiHeaders({ token: token(), body, method: 'PUT' });
  return (await fetch(ledgerApiUrl('/api/profile/facts'), { method: 'PUT', headers, body })).ok;
}

export interface FaceBox {
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
}

export async function uploadSelfie(jpeg: Blob, face: FaceBox): Promise<{ ok: true } | { ok: false; message: string }> {
  const bytes = new Uint8Array(await jpeg.arrayBuffer());
  const headers = await buildApiHeaders({ token: token(), body: bytes, method: 'POST', extra: { 'Content-Type': 'image/jpeg', 'x-face-box': JSON.stringify(face) } });
  headers['Content-Type'] = 'image/jpeg';
  const r = await fetch(ledgerApiUrl('/api/profile/photo'), { method: 'POST', headers, body: bytes });
  if (r.ok) return { ok: true };
  const j = (await r.json().catch(() => ({}))) as { message?: string };
  return { ok: false, message: j.message ?? 'That photo could not be saved.' };
}

/** An object URL for the person's photo, or null when they have none. */
export async function fetchSelfieUrl(): Promise<string | null> {
  const t = token();
  if (!t) return null;
  const headers = await buildApiHeaders({ token: t, method: 'GET' });
  const r = await fetch(ledgerApiUrl('/api/profile/photo'), { method: 'GET', headers });
  if (!r.ok) return null;
  const ct = r.headers?.get?.('content-type') ?? '';
  if (ct && !ct.toLowerCase().startsWith('image/')) return null;
  const blob = await r.blob();
  if (!blob.size || (blob.type && !blob.type.toLowerCase().startsWith('image/'))) return null;
  return URL.createObjectURL(blob);
}
