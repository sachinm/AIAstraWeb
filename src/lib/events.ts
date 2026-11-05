/**
 * First-party product analytics (server docs/reading-engine/49 §4.1): what the person clicks and chooses, batched to
 * `POST /api/analytics/events`. Only known event names, a surface, a short target and a few scalar props: never free
 * text, never birth data. Sends nothing when signed out. A failed send is dropped, never retried in a loop.
 */
import { buildApiHeaders } from './apiHeaders';
import { ledgerApiUrl } from './ledgerApi';
import { gaEvent } from './ga';

export type EventName =
  | 'page_view'
  | 'tab_select'
  | 'view_select'
  | 'week_select'
  | 'scenario_add'
  | 'scenario_remove'
  | 'scenario_layer_toggle'
  | 'scenario_answer'
  | 'place_set'
  | 'window_open'
  | 'why_open'
  | 'add_menu_open'
  | 'board_open'
  | 'worry_open'
  | 'chip_select'
  | 'question_answer';

interface QueuedEvent {
  event: EventName;
  surface: string;
  target?: string;
  props?: Record<string, string | number | boolean>;
  at: string;
}

const FLUSH_AT = 20;
const FLUSH_MS = 5000;
let queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let session: string | null = null;

function sessionId(): string {
  if (session) return session;
  try {
    session = sessionStorage.getItem('astra_session');
    if (!session) {
      session = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem('astra_session', session);
    }
  } catch {
    session = session ?? Math.random().toString(36).slice(2);
  }
  return session;
}

export function track(event: EventName, surface: string, target?: string, props?: Record<string, string | number | boolean>): void {
  if (typeof window === 'undefined') return;
  queue.push({ event, surface, target: target?.slice(0, 80), props, at: new Date().toISOString() });
  gaEvent(event, surface, target?.slice(0, 80), props);
  if (queue.length >= FLUSH_AT) void flushEvents();
  else if (!timer) timer = setTimeout(() => void flushEvents(), FLUSH_MS);
}

export async function flushEvents(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (queue.length === 0) return;
  const batch = queue.slice(0, 50);
  queue = queue.slice(50);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (!token) return;
  try {
    const body = JSON.stringify({ session: sessionId(), events: batch });
    const headers = await buildApiHeaders({ token, body, method: 'POST' });
    await fetch(ledgerApiUrl('/api/analytics/events'), { method: 'POST', headers, body, keepalive: true });
  } catch {
    // analytics never breaks the page
  }
  if (queue.length) void flushEvents();
}

const PENDING_KEY = 'astra_events_pending';

/** On page hide the async send cannot finish, so the queue is kept for the next page load. */
function savePending(): void {
  if (queue.length === 0) return;
  try {
    const prior = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? '[]') as QueuedEvent[];
    sessionStorage.setItem(PENDING_KEY, JSON.stringify([...prior, ...queue].slice(-200)));
    queue = [];
  } catch {
    // storage blocked: the events are dropped
  }
}

/** Events kept by a previous page are queued again and sent shortly. */
export function restorePending(): void {
  try {
    const kept = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? '[]') as QueuedEvent[];
    sessionStorage.removeItem(PENDING_KEY);
    if (Array.isArray(kept) && kept.length) {
      queue = [...kept, ...queue];
      if (!timer) timer = setTimeout(() => void flushEvents(), 1000);
    }
  } catch {
    // nothing kept
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', savePending);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushEvents();
  });
  restorePending();
}

/** tests */
export function _queued(): QueuedEvent[] {
  return queue;
}
export function _reset(): void {
  queue = [];
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
  if (timer) clearTimeout(timer);
  timer = null;
  session = null;
}
