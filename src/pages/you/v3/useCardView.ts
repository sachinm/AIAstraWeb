/**
 * The state one card keeps while it is on screen: the period it shows. It is remembered for the session so a reload or
 * a swipe away and back lands in the same place (`sessionStorage`, ids and numbers only).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getActivePeriod, setActivePeriod } from '../../../lib/selfV3Cache';
import type { SelfV3CardView } from '../../../lib/selfV3Api';
import { chipPeriods, openPeriod, periodsOf, standingOf, todayIso, type PeriodView } from './cardModel';

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

export interface CardView {
  periods: PeriodView[];
  /** the periods shown as chips (none for a card with one period of its own) */
  chips: PeriodView[];
  standing: string[];
  selected: number | null;
  period: PeriodView | null;
  select: (i: number) => void;
}

export function useCardView(card: SelfV3CardView, voice: 'gentle' | 'direct' = 'gentle'): CardView {
  const today = todayIso();
  const periods = useMemo(() => periodsOf(card, today), [card, today]);
  const chips = useMemo(() => chipPeriods(periods), [periods]);
  const standing = useMemo(() => standingOf(card, voice), [card, voice]);
  const [selected, setSelected] = useState<number | null>(() => openPeriod(periods, getActivePeriod(card.id)));
  // a card read again can lose the period on screen; fall back to where it would open
  useEffect(() => {
    if (selected === null || !periods.some((p) => p.index === selected && p.own)) {
      const next = openPeriod(periods, null);
      if (next !== selected) setSelected(next);
    }
  }, [periods, selected]);
  const select = useCallback(
    (i: number) => {
      if (!chips.some((p) => p.index === i)) return;
      setSelected(i);
      setActivePeriod(card.id, i);
    },
    [card.id, chips],
  );
  const period = periods.find((p) => p.index === selected) ?? null;
  return { periods, chips, standing, selected, period, select };
}
