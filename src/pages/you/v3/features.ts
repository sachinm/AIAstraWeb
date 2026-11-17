/**
 * What the Self board may show (doc 75, "Feature switches and premium"). The server decides and the page only renders:
 * `board.features.allowed` lists the cards and in-card features on for this person, and `locked` the premium ones the
 * plan does not cover (shown with a lock, never their content). An `off` key is simply absent.
 *
 * A server that does not send `features` yet gets the foundation set: every card it offers, Read and Short, periods,
 * key dates, "Is this right?" and Why; the card chat, voice and Compact stay off until the server lists them.
 */
import type { SelfCardId, SelfV3CardView, SelfV3Response } from '../../../lib/selfV3Api';

export type FeatureKey =
  | 'feature.face.short'
  | 'feature.periods'
  | 'feature.key_dates'
  | 'feature.why_panel'
  | 'feature.card_chat'
  | 'feature.confirm'
  | 'feature.voice'
  | 'feature.compact';

/** on when the server sends no features list */
const FOUNDATION: ReadonlySet<FeatureKey> = new Set<FeatureKey>(['feature.face.short', 'feature.periods', 'feature.key_dates', 'feature.why_panel', 'feature.confirm']);

export type FeatureState = { on: true } | { on: false; locked: false } | { on: false; locked: true; minPlan: string };

export const cardKey = (id: SelfCardId | string) => `card.self.${id}`;

export function featureState(board: Pick<SelfV3Response, 'features'> | null | undefined, key: string): FeatureState {
  const f = board?.features;
  if (!f || !Array.isArray(f.allowed)) {
    if (key.startsWith('card.')) return { on: true };
    return FOUNDATION.has(key as FeatureKey) ? { on: true } : { on: false, locked: false };
  }
  if (f.allowed.includes(key)) return { on: true };
  const lock = f.locked?.find((l) => l.key === key);
  return lock ? { on: false, locked: true, minPlan: lock.minPlan } : { on: false, locked: false };
}

export const featureOn = (board: Pick<SelfV3Response, 'features'> | null | undefined, key: string): boolean => featureState(board, key).on;

/** a card on the board: shown, shown locked ("Part of Plus"), or not shown at all */
export function cardAccess(board: Pick<SelfV3Response, 'features'> | null | undefined, id: SelfCardId): 'on' | 'locked' | 'off' {
  const f = board?.features;
  // a list that names no cards at all switches no card
  if (f && Array.isArray(f.allowed) && !f.allowed.some((k) => k.startsWith('card.')) && !f.locked?.some((l) => l.key.startsWith('card.'))) return 'on';
  const s = featureState(board, cardKey(id));
  return s.on ? 'on' : s.locked ? 'locked' : 'off';
}

/** "Part of Plus" from the plan code the server names */
export function planWord(minPlan: string): string {
  if (!minPlan) return 'Plus';
  return minPlan.charAt(0).toUpperCase() + minPlan.slice(1);
}

// ---------------------------------------------------------------------------------------------------------------------
// Card names, in the header (the server sends `title` and `subtitle`; these stand in until it does)
// ---------------------------------------------------------------------------------------------------------------------

/** the old names a server may still send, and the new ones that replace them */
const RENAMES: Readonly<Record<string, string>> = {
  'What bothers you': 'What’s weighing on you',
  'Gifts & knots': 'Your strengths and sticking points',
  'In short': 'Your life right now',
  Chapters: 'Your life phases: before, now, next',
  'This year': 'Your year',
};

const SUBTITLES: Partial<Record<SelfCardId, string>> = {
  body: 'How to pace yourself',
  mind: 'How you reason, decide and worry',
  stuck: 'What presses on you, and until when',
  drive: 'What pushes you, and what it is for',
  yogas: 'What comes easily, and what tangles',
  presence: 'How other people read you',
  lagna: 'Your nature, in plain words',
  diagnosis: 'The one thing to know now',
  chapters: 'Where you have been, where you are, what comes next',
  year: 'Birthday to birthday',
};

export function cardTitle(card: Pick<SelfV3CardView, 'title'>): string {
  return RENAMES[card.title] ?? card.title;
}

export function cardSubtitle(card: Pick<SelfV3CardView, 'id' | 'subtitle'>): string | null {
  const s = card.subtitle?.trim();
  return s || SUBTITLES[card.id] || null;
}

/** cards left out of the suggested set (This chapter repeats Your life phases) */
export const NOT_SUGGESTED: ReadonlySet<SelfCardId> = new Set<SelfCardId>(['chapter']);
