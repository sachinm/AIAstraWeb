/**
 * The Self board v3 client (server docs/reading-engine/68 §4.6). One GET carries the whole board: the layout the person
 * chose, every catalogue card in registry order with its period rail, and the build state. The types below are copied
 * from the server's `src/reading/self/v3/types.ts` and must stay identical to it; where the server reuses a v2 type,
 * this file reuses the one in selfV2Api.ts.
 *
 * GET /api/self/v3            -> 200 SelfV3Response (`status` ok | pending | preparing) | 404 no_kundli
 *                                | 404 without a v3 body: the server has v3 off, the page shows the v2 board
 * PUT /api/self/v3/layout     -> 200 SelfBoardLayoutView (+ `reading: { queued }` when five or more cards and the per-card
 *                                reading is on) | 400 { error: LayoutError }
 * POST /api/self/v3/confirm   -> 204
 * POST /api/self/v3/cards/:id/read (doc 70 §4.2) -> 202 { state: 'queued' } | 409 already_reading | 429 spend_cap
 *                                | 400 unknown_card, card_not_offered | 404 no_kundli | 503 off
 * The clock switch stays PUT /api/self/v2/clock (selfV2Api.changeSelfV2Clock).
 */
import { optionsFor, type BoardCardOptions, type BoardOptions, type CardOptions } from './cardOptions';
import { buildApiHeaders } from './apiHeaders';
import { getSelfV3Cached, setSelfV3Cached } from './selfV3Cache';
import { ledgerApiUrl } from './ledgerApi';
import type {
  CardStatus,
  IsoDate,
  LadderSteps,
  PersonalCard,
  PersonalPattern,
  SelfConfirmAnswer,
  SelfV2AreaId,
  SelfV2BuildView,
  SelfV2Clock,
  SelfV2Quality,
  SelfV2Refresh,
  SelfV2Response,
} from './selfV2Api';

// ---------------------------------------------------------------------------------------------------------------------
// Copied from the server's src/reading/self/v3/types.ts. Keep identical.
// ---------------------------------------------------------------------------------------------------------------------

/** Phase A and B: the eleven v2 areas (the `now` hero is not a card; the top strip is gone) */
export type SelfCardIdV2 = Exclude<SelfV2AreaId, 'now'>;
/** Phase C ids (offered when the per-card reading is on) and Phase D ids (reserved) */
export type SelfCardIdLater =
  | 'fitness'
  | 'sleep'
  | 'blood'
  | 'sharpness'
  | 'mood'
  | 'restores'
  | 'play'
  | 'purpose'
  | 'learning'
  | 'layers'
  | 'constitution'
  | 'aims'
  | 'practice'
  | 'saturn'
  | 'helps';
export type SelfCardId = SelfCardIdV2 | SelfCardIdLater;

export type SelfCardGroup = 'body' | 'mind' | 'character' | 'indian' | 'time';

export const SELF_CARD_GROUPS: ReadonlyArray<{ id: SelfCardGroup; title: string }> = [
  { id: 'body', title: 'Body' },
  { id: 'mind', title: 'Mind' },
  { id: 'character', title: 'Character' },
  { id: 'indian', title: 'Indian lens' },
  { id: 'time', title: 'Time' },
];

/** the seven sections a card can show (doc 68 §4.4) */
export type SelfSectionId = 'line' | 'year' | 'stretch' | 'confirm' | 'pattern' | 'ladder' | 'details';
export const SELF_SECTIONS: readonly SelfSectionId[] = ['line', 'year', 'stretch', 'confirm', 'pattern', 'ladder', 'details'];
/** "In a line" and "Your year" cannot be switched off */
export const FIXED_SECTIONS: readonly SelfSectionId[] = ['line', 'year'];
export const DEFAULT_SECTIONS: readonly SelfSectionId[] = ['line', 'year', 'stretch', 'confirm'];

/** 1 Compact (today's), 2 Seasons (default), 3 One at a time, 4 Year table (doc 68 §4.2) */
export type SelfTemplateId = 'compact' | 'seasons' | 'single' | 'table';
export const SELF_TEMPLATES: readonly SelfTemplateId[] = ['compact', 'seasons', 'single', 'table'];
/** the templates the page offers today; the others are refused by PUT until they ship */
export const SELF_TEMPLATES_LIVE: readonly SelfTemplateId[] = ['compact', 'seasons'];
export const DEFAULT_TEMPLATE: SelfTemplateId = 'seasons';
/** "Done" needs at least three cards */
export const MIN_CARDS = 3;
export const SUGGESTED_COUNT = 8;

export interface SelfBoardLayout {
  template: SelfTemplateId;
  /** the person's cards, in their order */
  cards: SelfCardId[];
  /** per card, the sections switched on, when the person changed them; absent: the card's defaults */
  sections: Partial<Record<SelfCardId, SelfSectionId[]>>;
  /** per card, how it reads (server doc 71 §4.3), only the keys the person changed */
  options?: BoardCardOptions;
  /** the board-wide gear settings, only the keys that differ from the defaults (absent from older servers) */
  boardOptions?: Partial<BoardOptions>;
}

export interface SelfBoardLayoutView extends SelfBoardLayout {
  /** false until the person has pressed Done once: the page opens the picker */
  chosen: boolean;
  updatedAt: string | null;
  /** the server's env-driven defaults; the client holds COLD_BOARD_DEFAULTS only until these arrive (absent from older servers) */
  boardDefaults?: BoardOptions;
}

/** PUT /api/self/v3/layout body; without `options` / `boardOptions` the server keeps what is stored */
export interface SelfV3LayoutBody {
  template: SelfTemplateId;
  cards: SelfCardId[];
  sections?: Partial<Record<SelfCardId, SelfSectionId[]>>;
  options?: BoardCardOptions;
  boardOptions?: Partial<BoardOptions>;
}

/** PUT /api/self/v3/layout errors */
export type LayoutError =
  | 'unknown_template'
  | 'template_not_live'
  | 'unknown_card'
  | 'card_not_offered'
  | 'duplicate_card'
  | 'too_few_cards'
  | 'unknown_section'
  | 'fixed_section_off'
  | 'bad_body'
  | 'unknown_option';

/** the engine's word for a span on one clock */
export type SpanTone = 'heavy' | 'mixed' | 'light';

export type SpanMode = 'get_through' | 'build';

/** what the person reads for one span (doc 68 §4.8) */
export interface SpanReading {
  span: string;
  from: IsoDate;
  to: IsoDate;
  tone: SpanTone;
  mode: SpanMode;
  /** at most 30 words */
  asks: string;
  /** at most 20 words */
  obstacle: string;
  /** one if-then sentence */
  step: string;
  /** false when fewer than READING_CLOCKS_MIN clocks hold the frame span's tone: the page shows no tone word */
  held?: boolean;
  /** doc 70 §4.2: how many clocks hold the span's tone, of how many read ("4 of 5 clocks agree") */
  agreement?: { agree: number; of: number } | null;
  /** doc 70 §4.3 item 6, Chart details: each clock read for this span, its tone, and whether it holds the span's tone */
  clocks?: SpanClockView[];
}

/** one clock's word for a span, as Chart details lists it (labels are plain names) */
export interface SpanClockView {
  system: string;
  label: string;
  tone: SpanTone;
  agrees: boolean;
}

export interface SelfV3CardContent {
  /** "In a line": one sentence with a date */
  line: string;
  spans: SpanReading[];
  /** "Is this right?" */
  confirm: { claimId: string; text: string } | null;
  /** "Your pattern" (off by default) */
  pattern: PersonalPattern | null;
  /** "The ladder" (off by default) */
  ladder: LadderSteps | null;
  /** "Checked on 3 of 4 clocks" */
  agreement: { agree: number; of: number } | null;
}

// ---------------------------------------------------------------------------------------------------------------------
// GET /api/self/v3 (doc 68 §4.6)
// ---------------------------------------------------------------------------------------------------------------------

/** one bar of the period rail */
export interface RailItem {
  from: IsoDate;
  to: IsoDate;
  /** "now → 5 Dec 2026" style label in calendar words */
  label: string;
  /** the tone word shown beside the bar; null in Phase A (v2 dates carry no tone) */
  tone: SpanTone | null;
  /** the reading's own label for the date, when the rail comes from v2 dates */
  note: string | null;
  current: boolean;
  /** the SpanReading.span this bar opens, when the card is v3 */
  span: string | null;
  /** the period's own words for the Read face, paragraph by paragraph; null when none is written (absent from older servers) */
  text?: string[] | null;
}

export interface SelfV3CardView {
  id: SelfCardId;
  group: SelfCardGroup;
  title: string;
  description: string;
  suggested: boolean;
  sensitive: boolean;
  /** false: shown greyed in the picker with `unavailableReason` */
  available: boolean;
  unavailableReason: string | null;
  status: CardStatus;
  /** doc 70 §4.2: the card's own reading state (always `ready` or `not_read` while the per-card reading is off) */
  state: CardReadState;
  /** the card's real first line for this person, for the picker tile; null until read */
  firstLine: string | null;
  defaultSections: SelfSectionId[];
  /** doc 71: the options in force and the plain lines where one cannot be honoured yet (absent from older servers) */
  options?: CardOptions;
  optionNotes?: string[];
  /** what stands for the person on this card regardless of period, plain lines (absent from older servers) */
  standing?: string[];
  rail: RailItem[];
  /** Phase B content; null while the card is filled from the v2 build */
  v3: SelfV3CardContent | null;
  /** Phase A content: the stored v2 card and its Chart details (engine names redacted) */
  v2: {
    card: PersonalCard | null;
    rangeLabel: string;
    details: { headline?: string; paragraphs?: string[]; evidence: string[]; certainty?: string };
  } | null;
}

export interface SelfV3Response {
  status: SelfV2Response['status'];
  builtAt: string | null;
  /** which build filled the cards */
  readVersion: 'v2' | 'v3' | null;
  clock: SelfV2Clock;
  profile: SelfV2Response['profile'];
  refresh: SelfV2Refresh;
  build: SelfV2BuildView;
  quality: SelfV2Quality | null;
  layout: SelfBoardLayoutView;
  /** every catalogue card in registry order, offered or not; the page shows `layout.cards` on the board */
  cards: SelfV3CardView[];
  /** doc 70 §4.2: the board's reading progress; null when nothing is known yet */
  reading: BoardReadingView | null;
}

// ---------------------------------------------------------------------------------------------------------------------
// Doc 70 Phase 3: a reading per card (§4.2, §4.4)
// ---------------------------------------------------------------------------------------------------------------------

/**
 * One card's reading state. `ready`: a stored reading is served; `reading`: its calls are running; `queued`: waiting
 * for its turn; `failed`: its last attempt did not come through (Try again); `not_read`: not read yet (the person has
 * not chosen it, the rest is off, or the spend cap stopped the queue).
 */
export type CardReadState = 'ready' | 'reading' | 'queued' | 'failed' | 'not_read';
export const CARD_READ_STATES: readonly CardReadState[] = ['ready', 'reading', 'queued', 'failed', 'not_read'];

/** where the board's reading is: reading the clocks, checking agreement, writing cards, done; idle when nothing runs */
export type BoardReadingStage = 'idle' | 'clocks' | 'ledger' | 'cards' | 'done';

export interface BoardReadingView {
  /** false when the per-card reading is off on this server (the board is filled the Phase B way) */
  enabled: boolean;
  stage: BoardReadingStage;
  /** the clocks the ledger stands on, plain labels; `missing`: not stored yet; `failed`: its reader did not come through */
  clocks: Array<{ system: string; label: string; state: 'read' | 'missing' | 'failed' }>;
  /** board cards ready, of board cards */
  done: number;
  total: number;
  /** the day's spend cap stopped the queue: the rest stays "Not read yet" */
  capReached: boolean;
  /** fewer clocks stored than READING_CLOCKS_MIN: "Your chart is still being prepared" */
  preparing: boolean;
}

/** POST /api/self/v3/cards/:id/read */
export type CardReadError = 'unknown_card' | 'card_not_offered' | 'already_reading' | 'spend_cap' | 'off' | 'no_kundli';

/** GET /api/self/v3/catalogue: the picker without card bodies */
export interface SelfV3CatalogueEntry {
  id: SelfCardId;
  group: SelfCardGroup;
  title: string;
  description: string;
  suggested: boolean;
  available: boolean;
  unavailableReason: string | null;
  firstLine: string | null;
  state: CardReadState;
}

// ---------------------------------------------------------------------------------------------------------------------
// Page state
// ---------------------------------------------------------------------------------------------------------------------

export type SelfV3State =
  | { kind: 'ok'; board: SelfV3Response }
  | { kind: 'preparing' }
  | { kind: 'no_kundli' }
  /** the server has v3 off (a 404 without a v3 body): the page shows the v2 board unchanged */
  | { kind: 'v2' }
  | { kind: 'error' };

/** PUT /api/self/v3/layout 200: the layout, plus the cards queued for reading (five or more cards, the reading on) */
export type SelfBoardLayoutSaved = SelfBoardLayoutView & { reading?: { queued: SelfCardId[] } };

export type LayoutSaveResult = { ok: true; layout: SelfBoardLayoutView; queued: SelfCardId[] } | { ok: false; error: LayoutError | 'failed' };

export type CardReadResult = { ok: true; state: CardReadState } | { ok: false; status: number; error: CardReadError | 'failed' };

/** the fewest cards that start the per-card reading (doc 70 §4.3 item 1); three and four still save */
export const MIN_READING_CARDS = 5;

/** the states a card is still being read in: the page polls while any card on the board has one */
export function cardReadPending(state: CardReadState | undefined): boolean {
  return state === 'queued' || state === 'reading';
}

/** The sections a card shows: the person's choice when stored, else the card's defaults; the fixed two always on. */
export function cardSections(layout: SelfBoardLayout, card: Pick<SelfV3CardView, 'id' | 'defaultSections'>): SelfSectionId[] {
  const chosen = layout.sections[card.id] ?? card.defaultSections ?? DEFAULT_SECTIONS;
  const on = new Set<SelfSectionId>([...FIXED_SECTIONS, ...chosen]);
  return SELF_SECTIONS.filter((s) => on.has(s));
}

// ---------------------------------------------------------------------------------------------------------------------
// Calls
// ---------------------------------------------------------------------------------------------------------------------

const TRANSIENT = new Set([502, 503, 504]);
const LAYOUT_ERRORS = new Set<LayoutError>([
  'unknown_template',
  'template_not_live',
  'unknown_card',
  'card_not_offered',
  'duplicate_card',
  'too_few_cards',
  'unknown_section',
  'fixed_section_off',
  'bad_body',
  'unknown_option',
]);

async function call(method: string, path: string, payload?: unknown, extra?: { headers?: Record<string, string>; signal?: AbortSignal }): Promise<Response> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const body = payload === undefined ? undefined : JSON.stringify(payload);
  const headers = await buildApiHeaders({ token, body, method, ...(extra?.headers ? { extra: extra.headers } : {}) });
  return fetch(ledgerApiUrl(path), { method, headers, ...(body !== undefined ? { body } : {}), ...(extra?.signal ? { signal: extra.signal } : {}) });
}

/** the longest a 503's Retry-After is honoured (ms), and the wait when it names none */
const RETRY_AFTER_DEFAULT_MS = 1000;
const RETRY_AFTER_MAX_MS = 5000;

function retryAfterMs(r: Response): number {
  const secs = Number(r.headers?.get('Retry-After'));
  return Number.isFinite(secs) && secs >= 0 ? Math.min(secs * 1000, RETRY_AFTER_MAX_MS) : RETRY_AFTER_DEFAULT_MS;
}

function abortError(): Error {
  const e = new Error('aborted');
  e.name = 'AbortError';
  return e;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function isV3Board(j: unknown): j is SelfV3Response {
  const b = j as Partial<SelfV3Response> | null;
  return !!b && typeof b === 'object' && typeof b.status === 'string' && Array.isArray(b.cards) && !!b.layout && typeof b.layout === 'object' && !!b.clock;
}

function isLayoutView(j: unknown): j is SelfBoardLayoutView {
  const l = j as Partial<SelfBoardLayoutView> | null;
  return !!l && typeof l === 'object' && typeof l.template === 'string' && Array.isArray(l.cards);
}

/**
 * GET /api/self/v3 with the cache in play: sends `If-None-Match` with the ETag selfV3Cache holds (the response is
 * no-store, so the browser keeps nothing itself), answers a 304 with the cached body, stores body and tag on a 200 `ok`
 * board, and retries once after Retry-After on a 503. Throws only an AbortError when `signal` aborts.
 */
export async function fetchSelfV3State(opts?: { signal?: AbortSignal }): Promise<{ state: SelfV3State; notModified: boolean }> {
  const signal = opts?.signal;
  let retried = false;
  let useTag = true;
  for (;;) {
    const held = getSelfV3Cached();
    const tag = useTag ? held?.etag : null;
    let r: Response;
    try {
      r = await call('GET', '/api/self/v3', undefined, { ...(tag ? { headers: { 'If-None-Match': tag } } : {}), ...(signal ? { signal } : {}) });
    } catch (e) {
      if (signal?.aborted || (e as { name?: string } | null)?.name === 'AbortError') throw abortError();
      return { state: { kind: 'error' }, notModified: false };
    }
    if (r.status === 304) {
      if (held) return { state: { kind: 'ok', board: held.data }, notModified: true };
      // a 304 with nothing held (the cache was cleared meanwhile): ask again without a tag, once
      if (!useTag) return { state: { kind: 'error' }, notModified: false };
      useTag = false;
      continue;
    }
    if (r.status === 503 && !retried) {
      retried = true;
      await sleep(retryAfterMs(r), signal);
      continue;
    }
    if (TRANSIENT.has(r.status)) return { state: { kind: 'preparing' }, notModified: false };
    const j = (await r.json().catch(() => null)) as (Partial<SelfV3Response> & { error?: string }) | null;
    if (j?.status === ('no_kundli' as string) || j?.error === 'no_kundli') return { state: { kind: 'no_kundli' }, notModified: false };
    // a 404 without a v3 body: the route is off on this server, the v2 board stands in
    if (r.status === 404) return { state: { kind: 'v2' }, notModified: false };
    if (j?.status === 'preparing' && !isV3Board(j)) return { state: { kind: 'preparing' }, notModified: false };
    if (!r.ok && r.status !== 202) return { state: { kind: 'error' }, notModified: false };
    if (!isV3Board(j)) return { state: r.status === 202 ? { kind: 'preparing' } : { kind: 'error' }, notModified: false };
    // only a finished board is held: a pending one must not be drawn as the next visit's first frame
    if (r.status === 200 && j.status === 'ok') setSelfV3Cached(j, r.headers?.get('ETag') ?? null);
    return { state: { kind: 'ok', board: j }, notModified: false };
  }
}

/** Why `fetchSelfV3` has no board: the page state to show instead */
export class SelfV3FetchError extends Error {
  constructor(public readonly state: Exclude<SelfV3State, { kind: 'ok' }>) {
    super(`self_v3_${state.kind}`);
    this.name = 'SelfV3FetchError';
  }
}

/**
 * The board, conditional on the cached ETag. `notModified: true` means `data` is the cached body itself (same
 * reference), so nothing needs to redraw. Rejects with SelfV3FetchError (`state`: preparing, no_kundli, v2, error) when
 * there is no board, and with an AbortError when `signal` aborts.
 */
export async function fetchSelfV3(opts?: { signal?: AbortSignal }): Promise<{ data: SelfV3Response; notModified: boolean }> {
  const { state, notModified } = await fetchSelfV3State(opts);
  if (state.kind === 'ok') return { data: state.board, notModified };
  throw new SelfV3FetchError(state);
}

/** PUT /api/self/v3/layout failed: `code` is the server's LayoutError, or 'failed' */
export class SelfV3LayoutError extends Error {
  constructor(public readonly code: LayoutError | 'failed') {
    super(`self_v3_layout_${code}`);
    this.name = 'SelfV3LayoutError';
  }
}

/**
 * Save the layout (template, cards, sections, per-card options, board options). The server's answer is the saved
 * layout (plus `reading.queued` when cards were queued). Rejects with SelfV3LayoutError so a caller can roll back. The
 * cached board takes the saved layout and drops its tag, so the next open draws the new layout and fetches in full.
 */
export async function putSelfV3Layout(body: SelfV3LayoutBody): Promise<SelfBoardLayoutSaved> {
  let r: Response;
  try {
    r = await call('PUT', '/api/self/v3/layout', body);
  } catch {
    throw new SelfV3LayoutError('failed');
  }
  const j = (await r.json().catch(() => null)) as (SelfBoardLayoutSaved & { error?: string }) | null;
  if (r.ok && isLayoutView(j)) {
    const held = getSelfV3Cached();
    if (held) {
      const { reading: _reading, ...layoutView } = j;
      setSelfV3Cached({ ...held.data, layout: layoutView }, null);
    }
    return j;
  }
  if (r.status === 400 && j?.error && LAYOUT_ERRORS.has(j.error as LayoutError)) throw new SelfV3LayoutError(j.error as LayoutError);
  throw new SelfV3LayoutError('failed');
}

/** Save the template, the card order and the sections. Never triggers a reading. */
export async function saveSelfV3Layout(layout: SelfBoardLayout): Promise<LayoutSaveResult> {
  try {
    const j = await putSelfV3Layout({
      template: layout.template,
      cards: layout.cards,
      sections: layout.sections,
      ...(layout.options ? { options: layout.options } : {}),
      ...(layout.boardOptions ? { boardOptions: layout.boardOptions } : {}),
    });
    const { reading, ...layoutView } = j;
    return { ok: true, layout: layoutView, queued: Array.isArray(reading?.queued) ? reading.queued : [] };
  } catch (e) {
    return { ok: false, error: e instanceof SelfV3LayoutError ? e.code : 'failed' };
  }
}

/**
 * A layout change that shows at once and is confirmed by the server. `optimistic` is `current` with the patch applied
 * (a patched `options` map or `boardOptions` replaces the stored one: the caller builds the whole next map, e.g. with
 * `withCardOption` or `applyToAllCards`; a patched `cards` list also drops the options of cards that left). `done`
 * resolves with the server's saved layout, which replaces `optimistic`, and rejects when the save fails so the caller can
 * go back to `current`. Debouncing is the caller's job.
 */
export function saveLayoutOptimistic(args: {
  current: SelfBoardLayoutView;
  patch: { options?: Record<string, Partial<CardOptions>>; boardOptions?: Partial<BoardOptions>; cards?: string[] };
  send: typeof putSelfV3Layout;
}): { optimistic: SelfBoardLayoutView; done: Promise<SelfBoardLayoutSaved> } {
  const { current, patch, send } = args;
  const cards = (patch.cards ?? current.cards) as SelfCardId[];
  const options = optionsFor(patch.options ?? current.options, cards);
  const boardOptions = patch.boardOptions ?? current.boardOptions ?? {};
  const optimistic: SelfBoardLayoutView = { ...current, cards, options, boardOptions };
  const done = send({
    template: current.template,
    cards,
    sections: current.sections,
    options,
    boardOptions,
  });
  return { optimistic, done };
}

/** A card's "Is this right?"; true on 204. */
export async function sendSelfV3Confirm(claimId: string, answer: SelfConfirmAnswer): Promise<boolean> {
  try {
    return (await call('POST', '/api/self/v3/confirm', { claimId, answer })).ok;
  } catch {
    return false;
  }
}

const CARD_READ_ERRORS = new Set<CardReadError>(['unknown_card', 'card_not_offered', 'already_reading', 'spend_cap', 'off', 'no_kundli']);

/** Queue or retry one card's reading (doc 70 §4.2). 202 is `{ ok: true, state: 'queued' }`. */
export async function readSelfV3Card(id: SelfCardId): Promise<CardReadResult> {
  let r: Response;
  try {
    r = await call('POST', `/api/self/v3/cards/${encodeURIComponent(id)}/read`);
  } catch {
    return { ok: false, status: 0, error: 'failed' };
  }
  const j = (await r.json().catch(() => null)) as { state?: CardReadState; error?: string } | null;
  if (r.ok) return { ok: true, state: j?.state && CARD_READ_STATES.includes(j.state) ? j.state : 'queued' };
  const error = j?.error && CARD_READ_ERRORS.has(j.error as CardReadError) ? (j.error as CardReadError) : 'failed';
  return { ok: false, status: r.status, error };
}
