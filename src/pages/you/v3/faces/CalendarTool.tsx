/**
 * Calendar tool: active covered month grids shaded by held period tones, with a clear tone legend and ringed
 * turning-point dates so shifts across the year are immediately legible. Pure date arithmetic over stored server windows.
 */
import type { PeriodView, ToolProps } from '../cardModel';
import { activeCalendarMonths, coveringPeriodForDay, vetCardTools, type CalendarTurningPoint } from '../toolVetting';
import { SPAN_TONE_DOT, SPAN_TONE_WORD, V3_WORDS } from '../words';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHADE = { heavy: 'bg-rose-400/35', mixed: 'bg-amber-300/30', light: 'bg-teal-300/30', none: 'bg-white/10' } as const;
export const CALENDAR_MONTHS = 12;

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** the most specific period covering a day (inner sub-periods win over overarching outer rails; incoming stretch wins on handoff day) */
export function coveringPeriod(periods: PeriodView[], day: string): PeriodView | null {
  return coveringPeriodForDay(periods, day);
}

/** active covered months (up to 12) from the month the earliest period starts in (or `today`'s month when earlier) */
export function calendarMonths(periods: PeriodView[], today: string): Array<{ y: number; m: number }> {
  return activeCalendarMonths(periods, today, CALENDAR_MONTHS);
}

function Month({
  y,
  m,
  periods,
  today,
  turningPointByDay,
  onSelect,
}: {
  y: number;
  m: number;
  periods: PeriodView[];
  today: string;
  turningPointByDay: ReadonlyMap<string, CalendarTurningPoint>;
  onSelect: (i: number) => void;
}) {
  const lead = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const cells: Array<number | null> = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, k) => k + 1)];
  return (
    <section className="self-v3-month" aria-label={`${MONTHS[m]} ${y}`} data-testid={`month-${y}-${m + 1}`}>
      <h5 className="mb-1 text-[12px] font-semibold text-white/85">
        {MONTHS[m]!.slice(0, 3)} {y}
      </h5>
      <div className="grid grid-cols-7 gap-px text-center text-[11px] text-white/85">
        {cells.map((d, k) => {
          if (!d) return <span key={k} />;
          const day = iso(y, m, d);
          const p = coveringPeriod(periods, day);
          const tp = turningPointByDay.get(day);
          const isToday = day === today;
          const ring = isToday ? 'ring-1 ring-white font-bold' : tp ? 'ring-1 ring-amber-200/80 font-semibold' : '';
          const label = `${d} ${MONTHS[m]} ${y}${p?.tone ? `, ${SPAN_TONE_WORD[p.tone]}` : ''}${tp ? `, ${V3_WORDS.turningPoint}: ${tp.summary}` : ''}${isToday ? ', today' : ''}`;
          const cls = `self-v3-day grid h-6 place-items-center rounded ${SHADE[p?.tone ?? 'none']} ${ring}`;
          return p?.selectable ? (
            <button
              key={k}
              type="button"
              aria-label={label}
              title={tp ? `${tp.displayDate} · ${tp.summary}` : undefined}
              onClick={() => onSelect(p.index)}
              className={`${cls} focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60`}
              data-testid={`day-${day}`}
              data-turning-point={tp ? 'true' : undefined}
            >
              {d}
            </button>
          ) : (
            <span key={k} className={`${cls} ${p ? '' : 'opacity-40'}`} aria-label={label} title={tp ? `${tp.displayDate} · ${tp.summary}` : undefined} data-testid={`day-${day}`}>
              {d}
            </span>
          );
        })}
      </div>
    </section>
  );
}

export default function CalendarTool(props: ToolProps) {
  const { card, periods, options, confirmOn, builtOn, onSelect } = props;
  if (!periods.length) return <p className="text-sm text-white/60">{V3_WORDS.nothingYet}</p>;
  const cal =
    props.vetted?.calendar ??
    vetCardTools({ card, periods, options, confirmOn, builtOn, staleCopy: V3_WORDS.staleCardDates }).calendar;
  if (!cal.months.length) return <p className="text-sm text-white/60">{V3_WORDS.nothingYet}</p>;

  return (
    <div className="space-y-3" data-testid="tool-calendar-panel">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/70" data-testid="calendar-legend">
        {cal.activeTones.map((tone) => (
          <span key={tone} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${SPAN_TONE_DOT[tone]}`} aria-hidden="true" />
            <span>{SPAN_TONE_WORD[tone]}</span>
          </span>
        ))}
        {cal.turningPoints.length > 0 && (
          <span className="inline-flex items-center gap-1.5 text-amber-200/90">
            <span className="h-2.5 w-2.5 rounded ring-1 ring-amber-200/80" aria-hidden="true" />
            <span>{V3_WORDS.turningPoint}</span>
          </span>
        )}
      </div>
      <div className="self-v3-months grid gap-4">
        {cal.months.map(({ y, m }) => (
          <Month key={`${y}-${m}`} y={y} m={m} periods={periods} today={cal.today} turningPointByDay={cal.turningPointByDay} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
