/**
 * How the board's layout turns into what a card reads with, and back into what the server stores: only the keys that
 * differ. The card's own choices win over the board-wide settings, which win over the server's defaults
 * (`layout.boardDefaults`, or COLD_BOARD_DEFAULTS before they arrive). Nothing here is astrological.
 */
import {
  COLD_BOARD_DEFAULTS,
  applyToAllCards,
  diffFromDefaults,
  effectiveCardOptions,
  type BoardCardOptions,
  type BoardOptions,
  type CardOptions,
} from '../../../lib/cardOptions';
import type { SelfBoardLayoutView } from '../../../lib/selfV3Api';

type L = Pick<SelfBoardLayoutView, 'options' | 'boardOptions' | 'boardDefaults' | 'cards'>;

export const defaultsOf = (l: Pick<L, 'boardDefaults'>): BoardOptions => l.boardDefaults ?? COLD_BOARD_DEFAULTS;

/** the board-wide settings in force */
export function boardNow(l: Pick<L, 'boardOptions' | 'boardDefaults'>): BoardOptions {
  const d = defaultsOf(l);
  return { ...d, ...(l.boardOptions ?? {}), tools: [...(l.boardOptions?.tools ?? d.tools)] } as BoardOptions;
}

/** what one card reads with */
export function cardNow(l: Pick<L, 'options' | 'boardOptions' | 'boardDefaults'>, id: string): CardOptions {
  return effectiveCardOptions(l.options?.[id], l.boardOptions, defaultsOf(l));
}

/** a card keeps choices of its own when any key is stored for it */
export function hasOwnOptions(l: Pick<L, 'options'>, id: string): boolean {
  return Object.keys(l.options?.[id] ?? {}).length > 0;
}

export function ownCount(l: Pick<L, 'options' | 'cards'>): number {
  return l.cards.filter((id) => hasOwnOptions(l, id)).length;
}

/** the per-card map after a change to one card: keys equal to the board-wide setting are dropped (the card follows it) */
export function withCardChange(l: Pick<L, 'options' | 'boardOptions' | 'boardDefaults'>, id: string, patch: Partial<CardOptions>): BoardCardOptions {
  const base = effectiveCardOptions(undefined, l.boardOptions, defaultsOf(l));
  const own = diffFromDefaults({ ...(l.options?.[id] ?? {}), ...patch }, base);
  const next: BoardCardOptions = { ...(l.options ?? {}) };
  if (Object.keys(own).length) next[id] = own;
  else delete next[id];
  return next;
}

/** the board-wide map after a change: only the keys that differ from the server's defaults are kept */
export function withBoardChange(l: Pick<L, 'boardOptions' | 'boardDefaults'>, patch: Partial<BoardOptions>): Partial<BoardOptions> {
  const d = defaultsOf(l);
  const merged = { ...(l.boardOptions ?? {}), ...patch } as Partial<BoardOptions>;
  const out: Partial<BoardOptions> = diffFromDefaults(merged, d);
  if (merged.confirm !== undefined && merged.confirm !== d.confirm) out.confirm = merged.confirm;
  if (merged.motion !== undefined && merged.motion !== d.motion) out.motion = merged.motion;
  return out;
}

/** "Apply to all cards": every card's own choice is dropped */
export const clearOwn = (l: Pick<L, 'options'>): BoardCardOptions => applyToAllCards(l.options);
