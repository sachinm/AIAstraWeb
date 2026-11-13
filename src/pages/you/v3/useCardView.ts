/**
 * The state one card keeps while it is on screen: the period it shows, whether its Read face is expanded, and whether
 * the pointer is a finger. The period and the expansion are remembered for the session so a reload or a swipe away
 * and back lands in the same place (`sessionStorage`, ids and numbers only).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CardOptions } from '../../../lib/cardOptions';
import { getActivePeriod, setActivePeriod } from '../../../lib/selfV3Cache';
import type { SelfV3CardView } from '../../../lib/selfV3Api';
import { openPeriod, periodsOf, standingOf, type PeriodView } from './cardModel';

const COARSE = '(pointer: coarse)';

function coarseNow(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(COARSE).matches;
  } catch {
    return false;
  }
}

/** true on a touch screen; follows the media query as it changes */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(coarseNow);
  useEffect(() => {
    let mq: MediaQueryList | null = null;
    try {
      mq = typeof window.matchMedia === 'function' ? window.matchMedia(COARSE) : null;
    } catch {
      mq = null;
    }
    if (!mq) return;
    const on = () => setCoarse(!!mq?.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq?.removeEventListener?.('change', on);
  }, []);
  return coarse;
}

/** touch handlers: a clear sideways swipe calls `onNext` (finger moves left) or `onPrev` (finger moves right) */
export function swipeHandlers(onPrev: () => void, onNext: () => void) {
  let start: { x: number; y: number } | null = null;
  return {
    onTouchStart: (e: { touches: ArrayLike<{ clientX: number; clientY: number }> }) => {
      const t = e.touches[0];
      start = t ? { x: t.clientX, y: t.clientY } : null;
    },
    onTouchEnd: (e: { changedTouches: ArrayLike<{ clientX: number; clientY: number }> }) => {
      const t = e.changedTouches[0];
      if (!start || !t) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      start = null;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 2) return;
      if (dx < 0) onNext();
      else onPrev();
    },
  };
}

const moreKey = (cardId: string, index: number) => `astra.selfv3.more.${cardId}.${index}`;

function readMore(cardId: string, index: number): boolean | null {
  try {
    const v = window.sessionStorage.getItem(moreKey(cardId, index));
    return v === '1' ? true : v === '0' ? false : null;
  } catch {
    return null;
  }
}

function writeMore(cardId: string, index: number, on: boolean): void {
  try {
    window.sessionStorage.setItem(moreKey(cardId, index), on ? '1' : '0');
  } catch {
    /* a private window keeps nothing; the card still works */
  }
}

export interface CardView {
  periods: PeriodView[];
  standing: string[];
  selected: number;
  period: PeriodView | null;
  select: (i: number) => void;
  expanded: boolean;
  setExpanded: (v: boolean) => void;
}

export function useCardView(card: SelfV3CardView, options: Pick<CardOptions, 'start'>): CardView {
  const periods = useMemo(() => periodsOf(card), [card]);
  const standing = useMemo(() => standingOf(card), [card]);
  const [selected, setSelected] = useState(() => openPeriod(card, periods, getActivePeriod(card.id)));
  // a card read again can lose the period on screen; fall back to where it would open
  useEffect(() => {
    if (!periods[selected]?.selectable) setSelected(openPeriod(card, periods, null));
  }, [card, periods, selected]);
  const select = useCallback(
    (i: number) => {
      if (!periods[i]?.selectable) return;
      setSelected(i);
      setActivePeriod(card.id, i);
    },
    [card.id, periods],
  );
  const [more, setMore] = useState<Record<number, boolean>>({});
  const expanded = more[selected] ?? readMore(card.id, selected) ?? options.start === 'full';
  const setExpanded = useCallback(
    (v: boolean) => {
      setMore((m) => ({ ...m, [selected]: v }));
      writeMore(card.id, selected, v);
    },
    [card.id, selected],
  );
  return { periods, standing, selected, period: periods[selected] ?? null, select, expanded, setExpanded };
}
