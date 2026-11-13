/**
 * The period strip: one 36 px pill per period (its dates and its tone written out), scrolling sideways and snapping,
 * with arrows to the previous and next period that can be picked. A period is a button only when it can be picked
 * (it has words of its own, or it is the current one); the others show greyed and are not reachable. The dots below
 * the reading column are the same choice again for a thumb.
 */
import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { neighbour, type PeriodView } from './cardModel';
import { SPAN_TONE_DOT, SPAN_TONE_WORD, V3_WORDS } from './words';

export interface PeriodStripProps {
  cardId: string;
  periods: PeriodView[];
  selected: number;
  onSelect: (i: number) => void;
}

const arrow = 'self-v3-btn inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/75 hover:bg-white/10 disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60';

export default function PeriodStrip({ cardId, periods, selected, onSelect }: PeriodStripProps) {
  const row = useRef<HTMLUListElement | null>(null);
  // keep the chosen pill in view when it changes by arrow, swipe or dots
  useEffect(() => {
    const el = row.current?.querySelector<HTMLElement>(`[data-period="${selected}"]`);
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selected]);
  if (periods.length < 2) return null;
  const prev = neighbour(periods, selected, -1);
  const next = neighbour(periods, selected, 1);
  return (
    <nav className="flex min-w-0 shrink-0 items-center gap-1" aria-label={V3_WORDS.periods} data-testid={`period-strip-${cardId}`}>
      <button type="button" className={arrow} disabled={prev === null} onClick={() => prev !== null && onSelect(prev)} aria-label={V3_WORDS.prevPeriod} data-testid="period-prev">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>
      <ul ref={row} className="self-v3-strip flex min-w-0 flex-1 snap-x snap-mandatory gap-1.5 overflow-x-auto [scrollbar-width:none]" role="tablist" aria-label={V3_WORDS.periods}>
        {periods.map((p) => {
          const on = p.index === selected;
          return (
            <li key={`${p.item.from}-${p.index}`} className="shrink-0 snap-start">
              <button
                type="button"
                role="tab"
                aria-selected={on}
                disabled={!p.selectable}
                tabIndex={on ? 0 : -1}
                data-period={p.index}
                data-current={p.current ? 'true' : 'false'}
                data-own={p.own ? 'true' : 'false'}
                onClick={() => onSelect(p.index)}
                className={`self-v3-pill inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 disabled:cursor-default disabled:opacity-40 ${
                  on ? 'border-teal-300/50 bg-teal-500/15 text-white' : 'border-white/10 bg-white/[0.04] text-white/75 enabled:hover:bg-white/10'
                }`}
                data-testid={`period-${p.index}`}
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${SPAN_TONE_DOT[p.tone ?? 'none']}`} aria-hidden="true" />
                <span className="whitespace-nowrap">{p.item.label}</span>
                {p.tone && <span className="whitespace-nowrap text-white/60" data-testid={`period-tone-${p.index}`}>{SPAN_TONE_WORD[p.tone]}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <button type="button" className={arrow} disabled={next === null} onClick={() => next !== null && onSelect(next)} aria-label={V3_WORDS.nextPeriod} data-testid="period-next">
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </nav>
  );
}

/** the dots under the reading column: one per period that can be picked */
export function PeriodDots({ periods, selected, onSelect }: Omit<PeriodStripProps, 'cardId'>) {
  const pickable = periods.filter((p) => p.selectable);
  if (pickable.length < 2) return null;
  return (
    <div className="flex shrink-0 items-center justify-center gap-1" role="group" aria-label={V3_WORDS.periods} data-testid="period-dots">
      {pickable.map((p, k) => (
        <button
          key={p.index}
          type="button"
          onClick={() => onSelect(p.index)}
          aria-label={V3_WORDS.periodN(k + 1, pickable.length)}
          aria-current={p.index === selected}
          className="self-v3-dot grid h-6 w-6 place-items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60"
        >
          <span className={`block h-2 rounded-full transition-all ${p.index === selected ? 'w-5 bg-teal-300' : 'w-2 bg-white/30'}`} />
        </button>
      ))}
    </div>
  );
}
