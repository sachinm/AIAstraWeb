/**
 * Calendar tool: month grids (twelve on a wide card, three on a narrow one: selfBoardV3.css hides the rest). A day is
 * shaded by the tone of the period that covers it (and says the tone in words to a screen reader), today is ringed, and
 * a tap on a day opens the period that covers it when that period has words of its own. Date arithmetic only.
 */
import type { PeriodView, ToolProps } from '../cardModel';
import { SPAN_TONE_WORD, V3_WORDS } from '../words';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHADE = { heavy: 'bg-rose-400/35', mixed: 'bg-amber-300/30', light: 'bg-teal-300/30', none: 'bg-white/10' } as const;
export const CALENDAR_MONTHS = 12;

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** the period that covers a day, the first one when ranges touch */
export function coveringPeriod(periods: PeriodView[], day: string): PeriodView | null {
  return periods.find((p) => p.item.from.slice(0, 10) <= day && day <= p.item.to.slice(0, 10)) ?? null;
}

/** the first twelve months from the month the earliest period starts in (or `today`'s month when it starts earlier) */
export function calendarMonths(periods: PeriodView[], today: string): Array<{ y: number; m: number }> {
  const first = periods.map((p) => p.item.from.slice(0, 10)).sort()[0] ?? today;
  const from = first > today ? first : today;
  const y0 = Number(from.slice(0, 4));
  const m0 = Number(from.slice(5, 7)) - 1;
  return Array.from({ length: CALENDAR_MONTHS }, (_, k) => ({ y: y0 + Math.floor((m0 + k) / 12), m: (m0 + k) % 12 }));
}

function Month({ y, m, periods, today, onSelect }: { y: number; m: number; periods: PeriodView[]; today: string; onSelect: (i: number) => void }) {
  const lead = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const cells: Array<number | null> = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, k) => k + 1)];
  return (
    <section className="self-v3-month" aria-label={`${MONTHS[m]} ${y}`} data-testid={`month-${y}-${m + 1}`}>
      <h5 className="mb-1 text-[12px] font-semibold text-white/80">
        {MONTHS[m]!.slice(0, 3)} {y}
      </h5>
      <div className="grid grid-cols-7 gap-px text-center text-[11px] text-white/80">
        {cells.map((d, k) => {
          if (!d) return <span key={k} />;
          const day = iso(y, m, d);
          const p = coveringPeriod(periods, day);
          const ring = day === today ? 'ring-1 ring-white' : '';
          const label = `${d} ${MONTHS[m]} ${y}${p?.tone ? `, ${SPAN_TONE_WORD[p.tone]}` : ''}${day === today ? ', today' : ''}`;
          const cls = `self-v3-day grid h-6 place-items-center rounded ${SHADE[p?.tone ?? 'none']} ${ring}`;
          return p?.selectable ? (
            <button key={k} type="button" aria-label={label} onClick={() => onSelect(p.index)} className={`${cls} focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60`} data-testid={`day-${day}`}>
              {d}
            </button>
          ) : (
            <span key={k} className={`${cls} ${p ? '' : 'opacity-40'}`} aria-label={label} data-testid={`day-${day}`}>
              {d}
            </span>
          );
        })}
      </div>
    </section>
  );
}

export default function CalendarTool({ periods, onSelect }: ToolProps) {
  if (!periods.length) return <p className="text-sm text-white/60">{V3_WORDS.nothingYet}</p>;
  const now = new Date();
  const today = iso(now.getFullYear(), now.getMonth(), now.getDate());
  return (
    <div className="self-v3-months grid gap-4" data-testid="tool-calendar-panel">
      {calendarMonths(periods, today).map(({ y, m }) => (
        <Month key={`${y}-${m}`} y={y} m={m} periods={periods} today={today} onSelect={onSelect} />
      ))}
    </div>
  );
}
