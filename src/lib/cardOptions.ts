/**
 * Card options (server docs/reading-engine/71 §4.3): how each card on a board reads, chosen by the person. The server
 * validates, stores and applies them; the page mirrors the section rule so a change redraws at once, and the server's
 * answer replaces it. Nothing astrological: the options only pick which stored parts show.
 */

export type CardLength = 'usual' | 'glance' | 'deep';
export type CardView = 'year' | 'now' | 'arc';
export type CardWords = 'plain' | 'terms';
export type CardPlan = 'with' | 'without';

export interface CardOptions {
  length: CardLength;
  view: CardView;
  words: CardWords;
  plan: CardPlan;
}
export type CardOptionKey = keyof CardOptions;

/** per card id, only the keys the person changed */
export type BoardCardOptions = Record<string, Partial<CardOptions>>;

export const DEFAULT_CARD_OPTIONS: Readonly<CardOptions> = Object.freeze({
  length: 'usual',
  view: 'year',
  words: 'plain',
  plan: 'with',
});

export const CARD_OPTION_KEYS: readonly CardOptionKey[] = ['length', 'view', 'words', 'plan'];

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
  return { ...DEFAULT_CARD_OPTIONS, ...(chosen ?? {}) };
}

/** only the keys that differ from the default, as the server stores them */
export function changedOnly(o: Partial<CardOptions>): Partial<CardOptions> {
  const out: Partial<CardOptions> = {};
  for (const k of CARD_OPTION_KEYS) if (o[k] !== undefined && o[k] !== DEFAULT_CARD_OPTIONS[k]) (out as Record<string, string>)[k] = o[k] as string;
  return out;
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
