/**
 * The deck's measured width and the Seasons cards-across rule (server docs/dashboards/13 §4.3). Cards across follows the
 * deck's real width, not the window's, so opening or closing the side rail re-measures (the observer sees the deck
 * change after the rail's transition). Before the first measure, without ResizeObserver, or at width 0 (jsdom) the
 * board falls back to its window-mode rule. The gear's "Cards across" overrides Auto, kept per device.
 */
import { useCallback, useEffect, useState } from 'react';
import type { AcrossChoice } from './words';

/** a Seasons card is at least this wide */
export const SEASONS_MIN_CARD = 420;
/** the gutter between Seasons cards (BoardV3's SEASONS_GAP) */
export const DECK_GAP = 24;
/** the room kept beside the cards: the 40 px peek and the gutter before it */
export const DECK_RESERVE = 64;
export const MAX_ACROSS = 4;

/** Seasons cards across for a deck `width` px wide: clamp(floor((W − 64 + 24) / (420 + 24)), 1, 4) */
export function perViewForWidth(width: number): number {
  const n = Math.floor((width - DECK_RESERVE + DECK_GAP) / (SEASONS_MIN_CARD + DECK_GAP));
  return Math.max(1, Math.min(MAX_ACROSS, n));
}

/** the localStorage key for the gear's "Cards across" (per device) */
export const ACROSS_KEY = 'aa.board.across';

export function readAcross(): AcrossChoice {
  try {
    const v = window.localStorage.getItem(ACROSS_KEY);
    return v === '1' || v === '2' || v === '3' || v === '4' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function writeAcross(v: AcrossChoice): void {
  try {
    if (v === 'auto') window.localStorage.removeItem(ACROSS_KEY);
    else window.localStorage.setItem(ACROSS_KEY, v);
  } catch {
    // storage blocked: the choice holds for this visit only
  }
}

/** the gear's choice, read once and kept in step with storage */
export function useAcross(): [AcrossChoice, (v: AcrossChoice) => void] {
  const [across, setAcrossState] = useState<AcrossChoice>(readAcross);
  const setAcross = useCallback((v: AcrossChoice) => {
    setAcrossState(v);
    writeAcross(v);
  }, []);
  return [across, setAcross];
}

/**
 * A callback ref for the deck and its measured width in px (0 until measured, and always 0 where ResizeObserver is
 * missing).
 */
export function useDeckWidth<T extends HTMLElement = HTMLDivElement>(): [(el: T | null) => void, number] {
  const [el, setEl] = useState<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const measure = (w: number) => setWidth(Math.round(w));
    measure(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      const e = entries[entries.length - 1];
      if (e) measure(e.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, width];
}

/**
 * Cards across for the board: a phone always 1; Compact keeps its window rule; Seasons the gear's number, else the
 * deck's width when measured, else the window rule (`fallback`).
 */
export function deckPerView(opts: { phone: boolean; seasons: boolean; across: AcrossChoice; width: number; fallback: number }): number {
  if (opts.phone || !opts.seasons) return opts.fallback;
  if (opts.across !== 'auto') return Number(opts.across);
  return opts.width > 0 ? perViewForWidth(opts.width) : opts.fallback;
}
