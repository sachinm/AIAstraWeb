/**
 * The board's shape for the window (phone, portrait, landscape, wide, two-fold), shared by the boards. Moved here
 * unchanged from the v2 Self board when the v2 Self reading was retired.
 */
import { useEffect, useState } from 'react';

export type BoardMode = 'phone' | 'portrait' | 'landscape' | 'wide' | 'xwide' | 'ultrawide' | 'duo';

function mq(q: string): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(q).matches;
  } catch {
    return false;
  }
}

/**
 * The board's shape for this window. A two-fold reports two horizontal viewport segments; where the browser does not,
 * a touch screen at least 1200 wide and at most 740 tall is read as one spanned across its hinge.
 */
export function boardMode(w: number, h: number, segments = mq('(horizontal-viewport-segments: 2)'), coarse = mq('(pointer: coarse)')): BoardMode {
  if (segments || (w >= 1200 && h <= 740 && coarse)) return 'duo';
  if (w >= 2300) return 'ultrawide';
  if (w >= 1680) return 'xwide';
  if (w >= 1440) return 'wide';
  if (w >= 1100) return 'landscape';
  if (w >= 768) return 'portrait';
  return 'phone';
}

export const PER_VIEW: Record<BoardMode, number> = { phone: 1, portrait: 2, landscape: 3, wide: 4, xwide: 4, ultrawide: 5, duo: 1 };

export function useBoardMode(): BoardMode {
  const read = () => (typeof window === 'undefined' ? 'landscape' : boardMode(window.innerWidth, window.innerHeight));
  const [mode, setMode] = useState<BoardMode>(read);
  useEffect(() => {
    const on = () => setMode(read());
    window.addEventListener('resize', on);
    let seg: MediaQueryList | null = null;
    try {
      seg = typeof window.matchMedia === 'function' ? window.matchMedia('(horizontal-viewport-segments: 2)') : null;
      seg?.addEventListener?.('change', on);
    } catch {
      seg = null;
    }
    return () => {
      window.removeEventListener('resize', on);
      seg?.removeEventListener?.('change', on);
    };
  }, []);
  return mode;
}
