/**
 * Card options (server docs/reading-engine/71 §4.3): how each card on a board reads, chosen by the person. The server
 * validates, stores and applies them; the page mirrors the section rule so a change redraws at once, and the server's
 * answer replaces it. Nothing astrological: the options only pick which stored parts show.
 */

export type CardLength = 'usual' | 'glance' | 'deep';
export type CardView = 'year' | 'now' | 'arc';
export type CardWords = 'plain' | 'terms';
export type CardPlan = 'with' | 'without';

/** the faces a card turns between (default 'read'); the server holds the live list */
export type CardFace = 'read' | 'light' | 'breakdown' | 'research';
/** the tools a card can open (default none) */
export type CardTool = 'table' | 'calendar' | 'dates' | 'timeframe' | 'plan' | 'info';
/** how the periods are grouped (default 'quarters') */
export type CardGroupBy = 'weeks' | 'months' | 'quarters' | 'years' | 'decades';
/** how the groups show (default 'swipe') */
export type CardGroupsAs = 'swipe' | 'accordion';
/** how a card starts (default 'short', with Show more) */
export type CardStart = 'short' | 'full';

export const CARD_FACES: readonly CardFace[] = ['read', 'light', 'breakdown', 'research'];
export const CARD_TOOLS: readonly CardTool[] = ['table', 'calendar', 'dates', 'timeframe', 'plan', 'info'];
export const CARD_GROUP_BYS: readonly CardGroupBy[] = ['weeks', 'months', 'quarters', 'years', 'decades'];

export interface CardOptions {
  length: CardLength;
  view: CardView;
  words: CardWords;
  plan: CardPlan;
  face: CardFace;
  tools: CardTool[];
  groupBy: CardGroupBy;
  groupsAs: CardGroupsAs;
  start: CardStart;
}
/** the four choices the "How this card reads" controls list (the rest are chosen on the card's toolbar and the gear) */
export type CardOptionKey = 'length' | 'view' | 'words' | 'plan';

/** the board-wide gear settings: every card option, plus two that belong to the board */
export interface BoardOptions extends CardOptions {
  /** show "Is this right?" on cards (default true) */
  confirm: boolean;
  /** animate card and period changes (default true) */
  motion: boolean;
}

/** per card id, only the keys the person changed */
export type BoardCardOptions = Record<string, Partial<CardOptions>>;

export const DEFAULT_CARD_OPTIONS: Readonly<CardOptions> = Object.freeze({
  length: 'usual',
  view: 'year',
  words: 'plain',
  plan: 'with',
  face: 'read',
  tools: Object.freeze([]) as unknown as CardTool[],
  groupBy: 'quarters',
  groupsAs: 'swipe',
  start: 'short',
});

/**
 * Cold-start fallback only: the server sends the real, env-driven defaults as `layout.boardDefaults`, and the page uses
 * those as soon as it has them.
 */
export const COLD_BOARD_DEFAULTS: BoardOptions = Object.freeze({
  ...DEFAULT_CARD_OPTIONS,
  confirm: true,
  motion: true,
}) as BoardOptions;

export const CARD_OPTION_KEYS: readonly CardOptionKey[] = ['length', 'view', 'words', 'plan'];
/** every key a card can carry */
export const ALL_CARD_OPTION_KEYS: readonly (keyof CardOptions)[] = [
  'length',
  'view',
  'words',
  'plan',
  'face',
  'tools',
  'groupBy',
  'groupsAs',
  'start',
];

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);
  }
  return a === b;
}

/**
 * The options a card reads with: the card's own choice wins, then the board-wide setting, then the defaults (the
 * server's `boardDefaults`, or COLD_BOARD_DEFAULTS before they arrive). Mirrors the server's merge.
 */
export function effectiveCardOptions(
  card: Partial<CardOptions> | undefined,
  board: Partial<BoardOptions> | undefined,
  defaults: BoardOptions,
): CardOptions {
  const out: Record<string, unknown> = {};
  for (const k of ALL_CARD_OPTION_KEYS) {
    const v = card?.[k] ?? board?.[k] ?? defaults[k];
    out[k] = Array.isArray(v) ? [...v] : v;
  }
  return out as unknown as CardOptions;
}

/** only the keys that differ from `base`, as the server stores them; `tools` is compared as an ordered list */
export function diffFromDefaults(opts: Partial<CardOptions>, base: CardOptions): Partial<CardOptions> {
  const out: Record<string, unknown> = {};
  for (const k of ALL_CARD_OPTION_KEYS) {
    const v = opts[k];
    if (v !== undefined && !sameValue(v, base[k])) out[k] = Array.isArray(v) ? [...v] : v;
  }
  return out as Partial<CardOptions>;
}

/** "Apply to all cards": every card's own choice is dropped, so the board-wide setting reads everywhere */
export function applyToAllCards(_layoutOptions?: BoardCardOptions): BoardCardOptions {
  return {};
}

/** the words for each choice, default first (doc 71 §4.3) */
export const CARD_OPTION_WORDS: {
  readonly [K in CardOptionKey]: {
    label: string;
    choices: ReadonlyArray<{ value: CardOptions[K]; label: string }>;
  };
} = {
  length: {
    label: 'Length',
    choices: [
      { value: 'usual', label: 'The usual' },
      { value: 'glance', label: 'A glance' },
      { value: 'deep', label: 'Deep' },
    ],
  },
  view: {
    label: 'View',
    choices: [
      { value: 'year', label: 'This year' },
      { value: 'now', label: 'Now' },
      { value: 'arc', label: 'The long arc' },
    ],
  },
  words: {
    label: 'Words',
    choices: [
      { value: 'plain', label: 'Plain words' },
      { value: 'terms', label: 'Chart terms' },
    ],
  },
  plan: {
    label: 'Plan',
    choices: [
      { value: 'with', label: 'With a plan' },
      { value: 'without', label: 'Without' },
    ],
  },
};

export const CARD_OPTIONS_TITLE = 'How this card reads';

export function effectiveOptions(chosen: Partial<CardOptions> | undefined): CardOptions {
  return { ...DEFAULT_CARD_OPTIONS, ...(chosen ?? {}), tools: [...(chosen?.tools ?? DEFAULT_CARD_OPTIONS.tools)] };
}

/** only the keys that differ from the default, as the server stores them */
export function changedOnly(o: Partial<CardOptions>): Partial<CardOptions> {
  return diffFromDefaults(o, DEFAULT_CARD_OPTIONS);
}

/** the next options map with one card's choice set (a card back on every default leaves the map) */
export function withCardOption(all: BoardCardOptions, id: string, key: CardOptionKey, value: string): BoardCardOptions {
  const one = changedOnly({
    ...(all[id] ?? {}),
    [key]: value,
  } as Partial<CardOptions>);
  const next = { ...all };
  if (Object.keys(one).length) next[id] = one;
  else delete next[id];
  return next;
}

/** keep only the cards still on the board */
export function optionsFor(all: BoardCardOptions | undefined, cards: readonly string[]): BoardCardOptions {
  return Object.fromEntries(Object.entries(all ?? {}).filter(([id]) => cards.includes(id)));
}

export type OptionSection = 'line' | 'year' | 'stretch' | 'confirm' | 'pattern' | 'ladder' | 'details';

/** Self (doc 71 §4.3): glance = line and year; usual = the four defaults; deep adds the pattern (and the ladder with a plan); chart terms adds Chart details */
export function sectionsFor(chosen: Partial<CardOptions> | undefined): OptionSection[] {
  const o = effectiveOptions(chosen);
  const on = new Set<OptionSection>(['line', 'year']);
  if (o.length !== 'glance') {
    on.add('stretch');
    on.add('confirm');
  }
  if (o.length === 'deep') {
    on.add('pattern');
    if (o.plan === 'with') on.add('ladder');
  }
  if (o.words === 'terms') on.add('details');
  const order: OptionSection[] = ['line', 'year', 'stretch', 'confirm', 'pattern', 'ladder', 'details'];
  return order.filter((s) => on.has(s));
}

export function isCardOptions(j: unknown): j is BoardCardOptions {
  return !!j && typeof j === 'object' && !Array.isArray(j);
}
