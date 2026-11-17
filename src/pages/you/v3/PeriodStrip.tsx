/**
 * The period chips (doc 75): one named, dated chip per period that has words of its own ("Heavy stretch · to 3 Jun
 * 2027"), in date order, scrolling sideways, with arrows to the previous and next. Past periods are greyed. A card with
 * one period of its own shows no chips. The chips are tabs over the card's reading (`panelId`).
 */
import { useEffect, useRef, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { neighbour, type PeriodView } from './cardModel';
import { SPAN_TONE_DOT, V3_WORDS } from './words';

export interface PeriodStripProps {
  cardId: string;
  periods: PeriodView[];
  chips: PeriodView[];
  selected: number | null;
  onSelect: (i: number) => void;
  /** the id of the reading the chips control */
  panelId: string;
}

const arrow =
  'self-v3-btn inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/75 hover:bg-white/10 disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60';

export default function PeriodStrip({ cardId, periods, chips, selected, onSelect, panelId }: PeriodStripProps) {
  const row = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = row.current?.querySelector<HTMLElement>(`[data-period="${selected}"]`);
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selected]);
  if (chips.length < 2) return null;
  const prev = neighbour(periods, selected, -1);
  const next = neighbour(periods, selected, 1);
  const onKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    const to = e.key === 'ArrowRight' ? next : e.key === 'ArrowLeft' ? prev : null;
    if (to === null) return;
    e.preventDefault();
    onSelect(to);
    (row.current?.querySelector(`[data-period="${to}"]`) as HTMLElement | null)?.focus();
  };
  return (
    <div className="flex min-w-0 shrink-0 items-center gap-1" data-testid={`period-strip-${cardId}`}>
      <button type="button" className={arrow} disabled={prev === null} onClick={() => prev !== null && onSelect(prev)} aria-label={V3_WORDS.prevPeriod} data-testid="period-prev">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>
      <div ref={row} className="self-v3-strip flex min-w-0 flex-1 snap-x snap-mandatory gap-1.5 overflow-x-auto [scrollbar-width:none]" role="tablist" aria-label={V3_WORDS.periods} onKeyDown={onKeys}>
        {chips.map((p) => {
          const on = p.index === selected;
          return (
            <button
              key={`${p.item.from}-${p.index}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={panelId}
              tabIndex={on ? 0 : -1}
              data-period={p.index}
              data-current={p.current ? 'true' : 'false'}
              data-past={p.past ? 'true' : 'false'}
              onClick={() => onSelect(p.index)}
              className={`self-v3-pill inline-flex h-9 shrink-0 snap-start items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 ${
                on ? 'border-teal-300/50 bg-teal-500/15 text-white' : p.past ? 'border-white/5 bg-transparent text-white/40 hover:text-white/60' : 'border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/10'
              }`}
              data-testid={`period-${p.index}`}
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${p.past ? 'bg-white/20' : SPAN_TONE_DOT[p.tone ?? 'none']}`} aria-hidden="true" />
              <span className="whitespace-nowrap">{p.label}</span>
              {p.past && <span className="sr-only">{V3_WORDS.passed}</span>}
            </button>
          );
        })}
      </div>
      <button type="button" className={arrow} disabled={next === null} onClick={() => next !== null && onSelect(next)} aria-label={V3_WORDS.nextPeriod} data-testid="period-next">
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
