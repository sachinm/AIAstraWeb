/**
 * The one carousel (server docs/reading-engine/66 mockup §2: "One Carousel and one Chips component serve Self, Love,
 * Work and Lucky times"). A horizontal track of cards with CSS scroll-snap, `perView` cards across, the rightmost
 * visible card dimmed as the peek that invites the swipe. It is controlled: the caller owns `index` (the card in focus)
 * and moves it from chips, arrows, dots, the left and right arrow keys, a touch swipe (native scroll-snap) or a mouse
 * drag.
 *
 * Only the track scrolls, and only sideways; a card's own body is the one vertical scroll, inside the card.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface CarouselProps {
  count: number;
  /** the card in focus */
  index: number;
  onIndexChange: (i: number) => void;
  /** cards across */
  perView: number;
  /** the region's name, e.g. "Self areas" */
  label: string;
  renderSlide: (i: number) => ReactNode;
  /** each slide's name for screen readers */
  slideLabel?: (i: number) => string;
  /** dim the rightmost visible card when more follow it (default true) */
  peek?: boolean;
  /** gap between cards, px */
  gap?: number;
  /** px of the next card left showing past the last full card, so the carousel reads as one (default 0) */
  peekPx?: number;
  className?: string;
  testId?: string;
}

/** The first card on screen for a card in focus: the track cannot scroll past its end. */
export function startFor(index: number, count: number, perView: number): number {
  return Math.max(0, Math.min(index, count - Math.max(1, perView)));
}

const IGNORE_SCROLL_MS = 450;

export default function Carousel({ count, index, onIndexChange, perView, label, renderSlide, slideLabel, peek = true, gap = 14, peekPx = 0, className = '', testId = 'carousel' }: CarouselProps) {
  const track = useRef<HTMLDivElement | null>(null);
  const programmatic = useRef(0);
  const drag = useRef<number | null>(null);
  const across = Math.max(1, Math.min(perView, count || 1));
  const start = startFor(index, count, across);

  const step = useCallback((): number => {
    const t = track.current;
    const a = t?.children[0] as HTMLElement | undefined;
    const b = t?.children[1] as HTMLElement | undefined;
    if (a && b && b.offsetLeft > a.offsetLeft) return b.offsetLeft - a.offsetLeft;
    return a?.offsetWidth ? a.offsetWidth + gap : 0;
  }, [gap]);

  // the focus moved (chip, arrow, key, dot): bring its card on screen
  useLayoutEffect(() => {
    const t = track.current;
    const s = step();
    if (!t || !s) return;
    const left = start * s;
    if (Math.abs(t.scrollLeft - left) < 2) return;
    programmatic.current = Date.now();
    if (typeof t.scrollTo === 'function') t.scrollTo({ left, behavior: 'smooth' });
    else t.scrollLeft = left;
  }, [start, step, across]);

  // a swipe or a trackpad scroll moved the track: the first card on screen takes the focus
  const onScroll = () => {
    if (Date.now() - programmatic.current < IGNORE_SCROLL_MS) return;
    const t = track.current;
    const s = step();
    if (!t || !s) return;
    const first = Math.round(t.scrollLeft / s);
    if (first !== start) onIndexChange(Math.max(0, Math.min(count - 1, first)));
  };

  const move = (d: number) => onIndexChange(Math.max(0, Math.min(count - 1, index + d)));
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      move(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      move(-1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      onIndexChange(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      onIndexChange(count - 1);
    }
  };
  // a mouse has no swipe: a drag of more than 48 px moves one card (touch uses the track's own scroll-snap)
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = e.pointerType === 'mouse' ? e.clientX : null;
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current === null) return;
    const dx = e.clientX - drag.current;
    drag.current = null;
    if (Math.abs(dx) > 48) move(dx < 0 ? 1 : -1);
  };

  useEffect(() => {
    if (index > count - 1 && count > 0) onIndexChange(count - 1);
  }, [count, index, onIndexChange]);

  const trackStyle: CSSProperties = {
    display: 'grid',
    gridAutoFlow: 'column',
    gridAutoColumns: `calc((100% - ${(across - 1) * gap + (peekPx > 0 && count > across ? peekPx + gap : 0)}px) / ${across})`,
    gap: `${gap}px`,
    overflowX: 'auto',
    overflowY: 'hidden',
    scrollSnapType: 'x mandatory',
    overscrollBehaviorX: 'contain',
    scrollbarWidth: 'none',
    height: '100%',
    minHeight: 0,
  };

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className={`relative h-full min-h-0 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 ${className}`}
      data-testid={testId}
      data-index={index}
      data-per-view={across}
    >
      <p className="sr-only" aria-live="polite" data-testid={`${testId}-status`}>
        {slideLabel ? slideLabel(index) : `${index + 1} of ${count}`}
      </p>
      <div ref={track} style={trackStyle} onScroll={onScroll} onPointerDown={onPointerDown} onPointerUp={onPointerUp} data-testid={`${testId}-track`}>
        {Array.from({ length: count }, (_, i) => {
          const visible = i >= start && i < start + across;
          const isPeek = peek && across > 1 && i === start + across - 1 && start + across < count && i !== index;
          return (
            <div
              key={i}
              role="group"
              aria-roledescription="slide"
              aria-label={slideLabel ? slideLabel(i) : `${i + 1} of ${count}`}
              aria-current={i === index ? 'true' : undefined}
              data-slide={i}
              data-visible={visible ? 'true' : 'false'}
              data-peek={isPeek ? 'true' : 'false'}
              // a Tab into a card off screen brings that card into focus
              onFocus={() => {
                if (!visible) onIndexChange(i);
              }}
              style={{ scrollSnapAlign: 'start', minHeight: 0, height: '100%', minWidth: 0 }}
              className={`transition-opacity duration-200 ${isPeek ? 'opacity-[0.55]' : 'opacity-100'}`}
            >
              {renderSlide(i)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const arrowCls =
  'inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80 hover:bg-white/10 disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60';

/** One card back, one card on. */
export function CarouselArrows({ index, count, onIndexChange, testId = 'carousel' }: { index: number; count: number; onIndexChange: (i: number) => void; testId?: string }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" className={arrowCls} aria-label="Previous card" disabled={index <= 0} onClick={() => onIndexChange(Math.max(0, index - 1))} data-testid={`${testId}-prev`}>
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </button>
      <button type="button" className={arrowCls} aria-label="Next card" disabled={index >= count - 1} onClick={() => onIndexChange(Math.min(count - 1, index + 1))} data-testid={`${testId}-next`}>
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}

/** One dot per card; the one in focus is a bar. */
export function CarouselDots({ index, count, onIndexChange, label = (i: number) => `Card ${i + 1}`, testId = 'carousel' }: { index: number; count: number; onIndexChange: (i: number) => void; label?: (i: number) => string; testId?: string }) {
  return (
    <div className="flex items-center justify-center gap-1" data-testid={`${testId}-dots`}>
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          aria-label={label(i)}
          aria-current={i === index ? 'true' : undefined}
          onClick={() => onIndexChange(i)}
          className="inline-flex h-6 min-w-[12px] items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60"
        >
          <span className={`block h-1.5 rounded-full transition-all ${i === index ? 'w-4 bg-teal-300' : 'w-1.5 bg-white/30'}`} />
        </button>
      ))}
    </div>
  );
}
