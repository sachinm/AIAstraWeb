/**
 * Small, testable pieces of the reading chat UI (docs/product/chat-interface-review.md §3).
 */

/** Enter sends; Shift+Enter inserts a newline; IME composition never sends. */
export function shouldSendOnKey(e: { key: string; shiftKey?: boolean; isComposing?: boolean; nativeEvent?: { isComposing?: boolean } }): boolean {
  if (e.key !== 'Enter') return false;
  if (e.shiftKey) return false;
  if (e.isComposing || e.nativeEvent?.isComposing) return false;
  return true;
}

/** The view follows new text only while the reader is already near the bottom (never yank someone who scrolled up). */
export function isNearBottom(el: { scrollTop: number; scrollHeight: number; clientHeight: number }, threshold = 120): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
}

/** Subject chips under the input (replace the old quick questions; no remedies, no health for the general public). */
export const SUBJECT_CHIPS: Array<{ id: string; label: string; question: string }> = [
  { id: 'career_job', label: 'Work & career', question: 'Is the next 6 months a good time to change jobs?' },
  { id: 'money_wealth', label: 'Money', question: 'When will my income start growing in the next year?' },
  { id: 'love_relationships', label: 'Relationship', question: 'When in the next 12 months am I likely to meet someone serious?' },
  { id: 'marriage', label: 'Marriage timing', question: 'When in the next 2 years is marriage most likely for me?' },
  { id: 'property_vehicles', label: 'Property', question: 'Which windows in the next 3 years favour buying a house?' },
  { id: 'time_window_outlook', label: 'This month', question: 'What does the next month look like for me?' },
  { id: 'spirituality_direction', label: 'My nakshatras', question: 'What do my nakshatras say about my nature?' },
];

export const INPUT_PLACEHOLDER = 'Ask about work, money, relationships, timing…';

export interface SidebarPrefs {
  leftOpen: boolean;
  rightOpen: boolean;
}
const PREFS_KEY = 'aiastra.chat.sidebars';

/** Remembered per device; storage can be unavailable (private mode), so every access is guarded. */
export function loadSidebarPrefs(fallback: SidebarPrefs): SidebarPrefs {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(PREFS_KEY) : null;
    if (!raw) return fallback;
    const j = JSON.parse(raw) as Partial<SidebarPrefs>;
    return { leftOpen: typeof j.leftOpen === 'boolean' ? j.leftOpen : fallback.leftOpen, rightOpen: typeof j.rightOpen === 'boolean' ? j.rightOpen : fallback.rightOpen };
  } catch {
    return fallback;
  }
}

export function saveSidebarPrefs(p: SidebarPrefs): void {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable: keep the in-memory state */
  }
}

/** What the clarify card shows (server events from the clarify agent). */
export type ClarifyView =
  | { type: 'clarify'; runId: string; question: string; chips: Array<{ label: string; value: string }>; allowFreeText: boolean; guidance?: string; understanding?: string }
  | { type: 'propose'; runId: string; exactQuery: string; assumed?: string | null }
  | { type: 'declined'; runId?: string; reply: string };

export function toClarifyView(ev: Record<string, unknown>): ClarifyView | null {
  if (ev.type === 'clarify' && typeof ev.runId === 'string' && typeof ev.question === 'string') {
    return { type: 'clarify', runId: ev.runId, question: ev.question, chips: Array.isArray(ev.chips) ? (ev.chips as Array<{ label: string; value: string }>) : [], allowFreeText: ev.allowFreeText !== false, guidance: typeof ev.guidance === 'string' ? ev.guidance : undefined, understanding: typeof ev.understanding === 'string' ? ev.understanding : undefined };
  }
  if (ev.type === 'propose' && typeof ev.runId === 'string' && typeof ev.exactQuery === 'string') {
    return { type: 'propose', runId: ev.runId, exactQuery: ev.exactQuery, assumed: typeof ev.assumed === 'string' ? ev.assumed : null };
  }
  if (ev.type === 'declined' && typeof ev.reply === 'string') return { type: 'declined', runId: typeof ev.runId === 'string' ? ev.runId : undefined, reply: ev.reply };
  return null;
}
