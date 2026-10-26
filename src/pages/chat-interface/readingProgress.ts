/**
 * Progress shown while the reading engine works: the "I understood X" line (from the `intent` SSE event) and one pill per
 * stage (`stage` events). Pure functions so the UI state is easy to test. The server sends these events only when the
 * reading engine is enabled; with it off nothing here is ever populated and the UI behaves as before.
 */

export type StageStatus = 'start' | 'done' | 'failed';

export interface StageChip {
  key: string;
  name: string;
  label: string;
  status: StageStatus;
  ms?: number;
}

export interface ReadingProgress {
  understood?: string;
  subjects?: string[];
  horizonLabel?: string;
  stages: StageChip[];
  windowsCount?: number;
  /** Thought summaries streamed while the answer is prepared (event `thought`). Shown in a collapsible panel, never saved. */
  thinking?: string;
  /** Parts of the question still to answer, in order (event `next`); the chat reads them one after another. */
  next?: NextPart[];
}

export interface NextPart {
  id: string;
  label: string;
}

/** The parts listed by a `next` event (ids and labels as strings only). */
export function nextPartsOf(ev: Record<string, unknown>): NextPart[] {
  const parts = ev.parts;
  if (!Array.isArray(parts)) return [];
  return parts
    .filter((p): p is { id: string; label: string } => !!p && typeof (p as NextPart).id === 'string' && typeof (p as NextPart).label === 'string')
    .map((p) => ({ id: p.id, label: p.label }));
}

/** Longest thinking text kept in memory for one answer. */
export const MAX_THINKING_CHARS = 20_000;

export interface ReadingStreamEvent {
  type: 'intent' | 'stage' | 'windows' | 'info' | 'clarify' | 'propose' | 'thought' | 'next';
  [k: string]: unknown;
}

const STAGE_LABELS: Record<string, string> = {
  intake: 'Understanding',
  prepare: 'Chart facts',
  promise: 'Promise',
  dasha: 'Dasha',
  transit: 'Transits',
  nakshatra: 'Nakshatras',
  reconcile: 'Cross-check',
  synthesize: 'Writing',
};

export function stageLabel(name: string): string {
  return STAGE_LABELS[name] ?? name;
}

export const emptyProgress = (): ReadingProgress => ({ stages: [] });

export function applyReadingEvent(prev: ReadingProgress | undefined, ev: ReadingStreamEvent): ReadingProgress {
  const p: ReadingProgress = prev ? { ...prev, stages: [...prev.stages] } : emptyProgress();
  if (ev.type === 'intent') {
    const intent = (ev.intent ?? {}) as { text?: string; subjects?: Array<{ label?: string }>; horizonLabel?: string };
    p.understood = typeof intent.text === 'string' ? intent.text : p.understood;
    p.subjects = (intent.subjects ?? []).map((s) => s.label ?? '').filter(Boolean);
    p.horizonLabel = intent.horizonLabel;
    return p;
  }
  if (ev.type === 'next') {
    const parts = nextPartsOf(ev);
    if (parts.length) p.next = parts;
    return p;
  }
  if (ev.type === 'thought') {
    const delta = typeof ev.delta === 'string' ? ev.delta : '';
    if (delta) p.thinking = ((p.thinking ?? '') + delta).slice(0, MAX_THINKING_CHARS);
    return p;
  }
  if (ev.type === 'windows') {
    const w = ev.windows;
    p.windowsCount = Array.isArray(w) ? w.length : p.windowsCount;
    return p;
  }
  if (ev.type === 'stage') {
    const name = String(ev.name ?? '');
    if (!name) return p;
    const subject = typeof ev.subject === 'string' ? ev.subject : '';
    const key = subject ? `${name}:${subject}` : name;
    const status = (ev.status === 'done' || ev.status === 'failed' ? ev.status : 'start') as StageStatus;
    const ms = typeof ev.ms === 'number' ? ev.ms : undefined;
    const i = p.stages.findIndex((s) => s.key === key);
    const chip: StageChip = { key, name, label: stageLabel(name), status, ...(ms !== undefined ? { ms } : {}) };
    if (i >= 0) p.stages[i] = chip;
    else p.stages.push(chip);
    return p;
  }
  return p;
}

/** Pills that add information for a person: skip the instant ones (understanding) and merge per-subject duplicates. */
export function visibleChips(progress: ReadingProgress | undefined): StageChip[] {
  if (!progress) return [];
  const seen = new Set<string>();
  const out: StageChip[] = [];
  for (const c of progress.stages) {
    if (c.name === 'intake') continue;
    if (seen.has(c.name)) {
      const existing = out.find((o) => o.name === c.name)!;
      if (c.status === 'failed') existing.status = 'failed';
      else if (existing.status === 'done' && c.status === 'start') existing.status = 'start';
      continue;
    }
    seen.add(c.name);
    out.push({ ...c });
  }
  return out;
}
