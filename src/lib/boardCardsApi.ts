/**
 * The Love and Work card picker (server docs/reading-engine/71 §4.5): the catalogue and the person's chosen cards with
 * their options. Self keeps /api/self/v3 (selfV3Api.ts).
 *
 *   GET /api/board/:board/v3/catalogue → { groups, cards }
 *   GET /api/board/:board/v3/layout    → AreaCardsLayout
 *   PUT /api/board/:board/v3/layout    { cards, options } → AreaCardsLayout | 400 { error }
 */
import { buildApiHeaders } from './apiHeaders';
import { effectiveOptions, type BoardCardOptions, type CardOptions } from './cardOptions';
import { ledgerApiUrl } from './ledgerApi';

export type AreaCardsBoard = 'love' | 'work';

export interface AreaCatalogueCard {
  id: string;
  group: string;
  title: string;
  description: string;
  suggested: boolean;
  available: boolean;
  unavailableReason: string | null;
  /** the board's sub-area tags this card shows; '*' is every one */
  subareas: string[];
}

export interface AreaCatalogue {
  groups: Array<{ id: string; title: string }>;
  cards: AreaCatalogueCard[];
}

export interface AreaCardsLayout {
  board: AreaCardsBoard;
  cards: string[];
  options: BoardCardOptions;
  effective: Record<string, { options: CardOptions; notes: string[] }>;
  chosen: boolean;
  updatedAt: string | null;
}

export const AREA_LAYOUT_ERROR_WORD: Record<string, string> = {
  too_few_cards: 'Pick at least one card.',
  card_not_offered: 'One of those cards is not ready yet.',
  unknown_option: 'That choice is not offered yet.',
  failed: 'That did not save. Try again.',
};

async function call(method: string, path: string, payload?: unknown): Promise<Response> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const body = payload === undefined ? undefined : JSON.stringify(payload);
  const headers = await buildApiHeaders({ token, body, method });
  return fetch(ledgerApiUrl(path), {
    method,
    headers,
    ...(body !== undefined ? { body } : {}),
  });
}

function isLayout(j: unknown): j is AreaCardsLayout {
  const l = j as Partial<AreaCardsLayout> | null;
  return !!l && typeof l === 'object' && Array.isArray(l.cards) && typeof l.chosen === 'boolean';
}

export async function fetchAreaCatalogue(board: AreaCardsBoard): Promise<AreaCatalogue | null> {
  try {
    const r = await call('GET', `/api/board/${board}/v3/catalogue`);
    if (!r.ok) return null;
    const j = (await r.json()) as AreaCatalogue;
    return Array.isArray(j?.cards) && Array.isArray(j?.groups) ? j : null;
  } catch {
    return null;
  }
}

export async function fetchAreaLayout(board: AreaCardsBoard): Promise<AreaCardsLayout | null> {
  try {
    const r = await call('GET', `/api/board/${board}/v3/layout`);
    if (!r.ok) return null;
    const j = await r.json();
    return isLayout(j) ? j : null;
  } catch {
    return null;
  }
}

export type AreaLayoutSave = { ok: true; layout: AreaCardsLayout } | { ok: false; error: string };

export async function saveAreaLayout(board: AreaCardsBoard, cards: string[], options: BoardCardOptions): Promise<AreaLayoutSave> {
  try {
    const r = await call('PUT', `/api/board/${board}/v3/layout`, {
      cards,
      options,
    });
    const j = await r.json().catch(() => null);
    if (r.ok && isLayout(j)) return { ok: true, layout: j };
    const err = (j as { error?: string } | null)?.error;
    return {
      ok: false,
      error: err && AREA_LAYOUT_ERROR_WORD[err] ? err : 'failed',
    };
  } catch {
    return { ok: false, error: 'failed' };
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Applying the choice to today's board (doc 71 §4.6)
// ---------------------------------------------------------------------------------------------------------------------

/** the sub-areas the chosen cards show; null: every one (nothing chosen, or a card that covers everything) */
export function allowedSubareas(layout: AreaCardsLayout | null, catalogue: AreaCatalogue | null): Set<string> | null {
  if (!layout?.chosen || !catalogue) return null;
  const chosen = catalogue.cards.filter((c) => layout.cards.includes(c.id));
  if (!chosen.length || chosen.some((c) => c.subareas.includes('*'))) return null;
  return new Set(chosen.flatMap((c) => c.subareas));
}

/** the options of the chosen card that shows this sub-area (a specific card first, then the one that covers all) */
export function optionsForSubarea(key: string, layout: AreaCardsLayout | null, catalogue: AreaCatalogue | null): CardOptions | null {
  if (!layout?.chosen || !catalogue) return null;
  const chosen = layout.cards.map((id) => catalogue.cards.find((c) => c.id === id)).filter((c): c is AreaCatalogueCard => !!c);
  const card = chosen.find((c) => c.subareas.includes(key)) ?? chosen.find((c) => c.subareas.includes('*'));
  return card ? effectiveOptions(layout.options[card.id]) : null;
}

/** a card's View as the boards' time filter */
export const VIEW_TIMEFRAME: Record<CardOptions['view'], 'active_now' | 'next_12m' | 'next_3y'> = { now: 'active_now', year: 'next_12m', arc: 'next_3y' };
