/**
 * The phone board's pieces under the header (server docs/dashboards/12): the 4 px progress ticks (one per card, the
 * card on screen lit) and the pull-down strip of card titles.
 *
 * The title strip slides down under the header when the person pulls the card down from its top (or taps the header
 * title). Titles only, scrolled sideways with scroll-snap; the title in the middle is the card on screen and the deck
 * follows it live while the strip is scrolled; a tap picks a title. The board owns `index` and when the strip opens and
 * closes; the strip keeps the active title centred whenever `index` moves (a swipe of the cards included).
 */
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';

/** One tick per card; the card on screen is lit. Decorative: the carousel already announces "3 of 11". */
export function ProgressTicks({ count, index, testId = 'progress-ticks' }: { count: number; index: number; testId?: string }) {
  if (count < 2) return null;
  return (
    <div className="flex h-1 w-full shrink-0 gap-0.5" aria-hidden="true" data-testid={testId} data-index={index}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={`h-full flex-1 rounded-full transition-colors motion-reduce:transition-none ${i === index ? 'bg-teal-300' : i < index ? 'bg-white/35' : 'bg-white/15'}`} data-tick={i} data-on={i === index ? 'true' : 'false'} />
      ))}
    </div>
  );
}

/** a strip scroll counts once it has been still this long */
const SETTLE_MS = 120;
/** a scroll we started is ignored for this long */
const OWN_SCROLL_MS = 450;

export interface TitleStripProps {
  titles: string[];
  index: number;
  open: boolean;
  /** `fromScroll`: the strip was scrolled (the deck follows; the strip stays open); else a tap (the board closes it) */
  onSelect: (i: number, fromScroll: boolean) => void;
  /** any touch, scroll or tap on the strip: the board restarts its idle timer */
  onActivity?: () => void;
  label: string;
  /** an item pinned after the titles, outside their scroll (the board's own controls); give it tabIndex -1 while closed */
  trailing?: ReactNode;
  testId?: string;
}

export default function TitleStrip({ titles, index, open, onSelect, onActivity, label, trailing, testId = 'title-strip' }: TitleStripProps) {
  const list = useRef<HTMLDivElement | null>(null);
  const own = useRef(0);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const live = useRef({ index, onSelect });
  live.current = { index, onSelect };

  // the active title sits in the middle: on open, and whenever the card on screen changes
  useLayoutEffect(() => {
    if (!open) return;
    const el = list.current?.querySelector<HTMLElement>(`[data-title-index="${index}"]`);
    if (!el || typeof el.scrollIntoView !== 'function') return;
    own.current = Date.now();
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, [open, index]);
  useEffect(() => () => void (settle.current && clearTimeout(settle.current)), []);

  /** the title whose middle is nearest the strip's middle */
  const centred = (): number | null => {
    const box = list.current;
    if (!box) return null;
    const mid = box.scrollLeft + box.clientWidth / 2;
    let best: number | null = null;
    let gap = Infinity;
    box.querySelectorAll<HTMLElement>('[data-title-index]').forEach((el) => {
      const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid);
      if (d < gap) {
        gap = d;
        best = Number(el.dataset.titleIndex);
      }
    });
    return best;
  };

  const onScroll = () => {
    onActivity?.();
    if (Date.now() - own.current < OWN_SCROLL_MS) return;
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      settle.current = null;
      const i = centred();
      if (i !== null && i !== live.current.index) live.current.onSelect(i, true);
    }, SETTLE_MS);
  };

  return (
    <div
      className={`grid shrink-0 overflow-hidden transition-[grid-template-rows,opacity] duration-200 motion-reduce:transition-none ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      data-testid={testId}
      data-open={open ? 'true' : 'false'}
      aria-hidden={open ? undefined : true}
    >
      <div className="flex min-h-0 items-center gap-1.5">
        <div
          ref={list}
          role="tablist"
          aria-label={label}
          onScroll={onScroll}
          onTouchStart={onActivity}
          className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto overscroll-x-contain px-[40%] py-1 [scrollbar-width:none]"
          style={{ scrollSnapType: 'x mandatory' }}
          data-testid={`${testId}-list`}
        >
          {titles.map((t, i) => (
            <button
              key={`${i}-${t}`}
              type="button"
              role="tab"
              aria-selected={i === index}
              tabIndex={open ? 0 : -1}
              onClick={() => {
                onActivity?.();
                onSelect(i, false);
              }}
              style={{ scrollSnapAlign: 'center' }}
              className={`inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-full px-3.5 text-[14px] font-semibold transition-colors motion-reduce:transition-none ${i === index ? 'bg-teal-500/20 text-teal-100' : 'text-white/65 hover:text-white'}`}
              data-title-index={i}
              data-testid={`${testId}-title-${i}`}
            >
              {t}
            </button>
          ))}
        </div>
        {/* pinned at the right edge, outside the titles' scroll */}
        {trailing}
      </div>
    </div>
  );
}
