/** The public assistant and the visit log. No sign-in. See docs/assistant/01 in the server repo. */
import { buildApiHeaders } from './apiHeaders';
import { ledgerApiUrl } from './ledgerApi';

export const ASSISTANT_MAX_CHARS = 400;

export interface AssistantReply {
  answer: string;
  verdict: 'yes' | 'no' | 'needs_chart' | 'unsure';
  cta: boolean;
}

const VISIT_KEY = 'aa_visit';
const LOGGED_KEY = 'aa_visit_logged';

/** Storage can throw in a private window, and the assistant must work without it. */
function readStore(store: 'localStorage' | 'sessionStorage', key: string): string | null {
  try {
    return window[store].getItem(key);
  } catch {
    return null;
  }
}

function writeStore(store: 'localStorage' | 'sessionStorage', key: string, value: string): void {
  try {
    window[store].setItem(key, value);
  } catch {
    // nothing to do: the server makes a new visit id next time
  }
}

async function post<T>(path: string, payload: object): Promise<T> {
  const body = JSON.stringify({ ...payload, visitId: readStore('localStorage', VISIT_KEY) ?? undefined, path: window.location.pathname, referrer: document.referrer || undefined });
  const headers = await buildApiHeaders({ body, method: 'POST' });
  const res = await fetch(ledgerApiUrl(path), { method: 'POST', headers, body });
  const j = (await res.json().catch(() => ({}))) as T & { visitId?: string };
  // a 429 still carries a polite answer, so only a reply with no JSON at all counts as failure
  if (!res.ok && res.status !== 429) throw new Error(`assistant ${res.status}`);
  if (typeof j.visitId === 'string') writeStore('localStorage', VISIT_KEY, j.visitId);
  return j;
}

export async function askAssistant(question: string): Promise<AssistantReply> {
  const r = await post<Partial<AssistantReply>>('/api/assistant/ask', { question });
  if (typeof r.answer !== 'string') throw new Error('assistant: no answer');
  return { answer: r.answer, verdict: r.verdict ?? 'unsure', cta: r.cta === true };
}

/** Records this visit once per browser session. Never gets in the way of the page. */
export async function logVisit(): Promise<void> {
  if (readStore('sessionStorage', LOGGED_KEY)) return;
  writeStore('sessionStorage', LOGGED_KEY, '1');
  await post('/api/assistant/visit', {}).catch(() => undefined);
}
