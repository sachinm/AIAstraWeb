/**
 * Progress shown while the reading engine works: the "I understood X" line (from the `intent` SSE event) and one pill per
 * stage (`stage` events). Pure functions so the UI state is easy to test. The server sends these events only when the
 * reading engine is enabled; with it off nothing here is ever populated and the UI behaves as before.
 */

/**
 * Stage states as the server sends them (`stage` event, field `status`), plus `waiting` for a stage the client knows is
 * still to come. Server side (AIAstra_Server src/reading/graph.ts): `failed` = a required analyst (promise, dasha, and
 * transit when the period is 3 years or less) still failed after its one retry, which caps the reading's confidence;
 * `skipped` = an optional analyst (nakshatra, long-period transit) failed or timed out once and the reading went on
 * without it.
 */
export type StageStatus = 'waiting' | 'start' | 'done' | 'failed' | 'skipped';

export interface StageChip {
  key: string;
  name: string;
  label: string;
  status: StageStatus;
  ms?: number;
  /** Client clock when the `start` event arrived / when the stage finished (done, failed or skipped). */
  startedAt?: number;
  endedAt?: number;
  /** Optional server hints: `reason` ('timeout' | 'error' | text), `retried`, `cached`; older servers send none. */
  reason?: string;
  retried?: boolean;
  cached?: boolean;
  /** Plain note from the event detail, e.g. transit data unavailable when chart facts were prepared. */
  note?: string;
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

export function applyReadingEvent(prev: ReadingProgress | undefined, ev: ReadingStreamEvent, now: number = Date.now()): ReadingProgress {
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
    const status = (ev.status === 'done' || ev.status === 'failed' || ev.status === 'skipped' ? ev.status : 'start') as StageStatus;
    const ms = typeof ev.ms === 'number' ? ev.ms : undefined;
    const i = p.stages.findIndex((s) => s.key === key);
    const before = i >= 0 ? p.stages[i] : undefined;
    const detail = (ev.detail ?? {}) as { transits?: unknown };
    const chip: StageChip = {
      key,
      name,
      label: stageLabel(name),
      status,
      ...(ms !== undefined ? { ms } : {}),
      startedAt: before?.startedAt ?? (status === 'start' ? now : ms !== undefined ? now - ms : now),
      ...(status !== 'start' ? { endedAt: now } : {}),
      ...(typeof ev.reason === 'string' && ev.reason ? { reason: ev.reason } : {}),
      ...(typeof ev.retried === 'boolean' ? { retried: ev.retried } : {}),
      ...(ev.cached === true ? { cached: true } : {}),
      ...(name === 'prepare' && detail.transits === 'unavailable' ? { note: 'Transit data unavailable' } : {}),
    };
    if (i >= 0) p.stages[i] = chip;
    else p.stages.push(chip);
    return p;
  }
  return p;
}

/** When per-subject copies of one stage disagree, the stage shows the most telling state. */
const STATUS_RANK: Record<StageStatus, number> = { done: 1, skipped: 2, waiting: 3, start: 4, failed: 5 };

/** Stages that add information for a person: skip the instant one (understanding) and merge per-subject duplicates. */
export function visibleChips(progress: ReadingProgress | undefined): StageChip[] {
  if (!progress) return [];
  const out: StageChip[] = [];
  for (const c of progress.stages) {
    if (c.name === 'intake') continue;
    const existing = out.find((o) => o.name === c.name);
    if (!existing) {
      out.push({ ...c });
      continue;
    }
    if (STATUS_RANK[c.status] > STATUS_RANK[existing.status]) {
      existing.status = c.status;
      if (c.reason) existing.reason = c.reason;
    }
    if (c.startedAt !== undefined) existing.startedAt = Math.min(existing.startedAt ?? c.startedAt, c.startedAt);
    if (c.endedAt !== undefined) existing.endedAt = Math.max(existing.endedAt ?? c.endedAt, c.endedAt);
    if (c.ms !== undefined) existing.ms = Math.max(existing.ms ?? 0, c.ms);
    if (c.retried) existing.retried = true;
    existing.cached = !!existing.cached && !!c.cached;
  }
  return out;
}

const ANALYSTS = new Set(['promise', 'dasha', 'transit', 'nakshatra']);

/**
 * The stage list for the progress panel: what the server has reported, plus `waiting` rows for stages that are sure
 * to come. Every reading ends with Writing; the multi-agent flow (any analyst stage) also has a Cross-check first.
 * Analysts are not guessed: the server picks them per question, and they all start together after Chart facts.
 */
export function panelStages(progress: ReadingProgress | undefined): StageChip[] {
  const chips = visibleChips(progress);
  if (!chips.length) return chips;
  const has = (n: string) => chips.some((c) => c.name === n);
  const waiting = (name: string): StageChip => ({ key: name, name, label: stageLabel(name), status: 'waiting' });
  if (chips.some((c) => ANALYSTS.has(c.name)) && !has('reconcile')) chips.push(waiting('reconcile'));
  if (!has('synthesize')) chips.push(waiting('synthesize'));
  return chips;
}

export function isFinished(status: StageStatus): boolean {
  return status === 'done' || status === 'failed' || status === 'skipped';
}

/** "3 of 6": stages finished (done, skipped or failed) out of all known stages. */
export function stageCounts(stages: StageChip[]): { finished: number; total: number } {
  return { finished: stages.filter((s) => isFinished(s.status)).length, total: stages.length };
}

/**
 * The short plain-language line under a stage, or '' when the state says enough. The server's `failed` always comes
 * after one retry of a required analyst; `reason: 'timeout'` (when the server sends it) names the time-out.
 */
export function stageReason(c: StageChip): string {
  const timedOut = c.reason === 'timeout';
  if (c.status === 'failed') {
    const what = timedOut ? 'Timed out' : 'Did not finish';
    const retry = c.retried === false ? '' : ' after a retry';
    return `${what}${retry} \u2014 reading confidence capped`;
  }
  if (c.status === 'skipped') return timedOut ? 'Skipped (timed out) \u2014 optional check' : 'Skipped \u2014 optional check, the reading went on without it';
  if (c.status === 'done') {
    if (c.cached) return 'Reused from an earlier reading';
    if (c.note) return c.note;
    if (c.retried) return 'Done after a retry';
  }
  return '';
}

export function statusWord(s: StageStatus): string {
  return { waiting: 'Waiting', start: 'Running', done: 'Done', failed: 'Failed', skipped: 'Skipped' }[s];
}

/** "4.2 s", "34 s", "1 m 05 s". */
export function formatSeconds(ms: number): string {
  const sec = Math.max(0, ms) / 1000;
  if (sec < 10) return `${sec.toFixed(1)} s`;
  if (sec < 60) return `${Math.round(sec)} s`;
  const m = Math.floor(sec / 60);
  return `${m} m ${String(Math.round(sec % 60)).padStart(2, '0')} s`;
}
