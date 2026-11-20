/**
 * The Outlook tab of a card on tablet and desktop (server docs/dashboards/13 §4.3, plan revision 2 §6). The stretch
 * picker and the headline sit above it in the card frame; then the plain story (`v3.plain.story`, when served), then a
 * row of icon buttons that picks one short section at a time:
 *
 *   Why we think so, What to do (the default: Why, Do and Avoid, what the stretch builds in you, the stretch's own text
 *   and the pattern line) · Key dates (a thin start-to-end bar marking today) · How the systems read it (the count, the
 *   agreeing and testing clocks) · The ladder · The gift and the knot (with how sure, and what the chart shows for the
 *   stretch)
 *
 * The technical story and the long reading are on the Astrology Reading tab and in the "i" sheet.
 *
 * A section with nothing served has no button. The section picked is held by the card frame, so it survives a switch
 * of tab or stretch; it is never stored. Nothing astrological is computed: it lays out what the server sent and does
 * date arithmetic for the bar.
 */
import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { CalendarRange, Gift, Lightbulb, ListOrdered, Scale } from 'lucide-react';
import { certaintyWord, chartShows, StoryProse, storyParagraphs, withoutSpanIds } from './AstrologyView';
import { nameOr } from '../../../lib/plainLabel';
import type { CardOptions } from '../../../lib/cardOptions';
import type { SelfV3CardView } from '../../../lib/selfV3Api';
import { analysisSpan, STEP_WORD, SystemList, VIEW_WORDS } from './CardViews';
import { spanToneShown } from './CardParts';
import { dayWords, keyDatesOf, patternLine, planSteps, todayIso, whatToDo, type PeriodView } from './cardModel';
import { body, label } from './faces/parts';
import { OUTLOOK_WORDS, SPAN_TONE_WORD, V3_WORDS } from './words';

export interface OutlookViewProps {
  card: SelfV3CardView;
  /** the stretch on screen, or null when the card has none of its own */
  period: PeriodView | null;
  periods: readonly PeriodView[];
  standing: string[];
  options: Pick<CardOptions, 'plan'>;
  /** feature switches the board passes down */
  showWhy: boolean;
  showDates: boolean;
  /** "See the astrology reading": switches the card to its Astrology Reading tab */
  onAstrology?: () => void;
  /** the section on screen and its change (held by the card frame); default the overview */
  section?: OutlookSection;
  onSection?: (s: OutlookSection) => void;
}

export type OutlookSection = 'overview' | 'dates' | 'systems' | 'ladder' | 'chart';

/** the toolbar, in order: each section's name (tooltip and aria-label) and icon */
export const OUTLOOK_SECTIONS: ReadonlyArray<{ id: OutlookSection; title: string; Icon: typeof Lightbulb }> = [
  { id: 'overview', title: OUTLOOK_WORDS.whyAndTodo, Icon: Lightbulb },
  { id: 'dates', title: V3_WORDS.keyDates, Icon: CalendarRange },
  { id: 'systems', title: VIEW_WORDS.systems, Icon: Scale },
  { id: 'ladder', title: VIEW_WORDS.ladder, Icon: ListOrdered },
  { id: 'chart', title: OUTLOOK_WORDS.giftAndKnot, Icon: Gift },
];

/**
 * The plain Why: the card's own sentence when the server wrote one, else a line from the counts it served ("5 of 7
 * timing systems read this stretch as mixed"); null when there is neither. A split stretch carries no tone word.
 */
export function whyLine(card: SelfV3CardView, period: PeriodView | null): string | null {
  const own = card.v3?.why?.trim();
  if (own) return own;
  const span = analysisSpan(card, period);
  const ofPeriod = !!period && !!span && period.span === span;
  if (span?.agreement && span.agreement.of > 0) {
    const tone = spanToneShown(span, span.tone);
    return tone
      ? OUTLOOK_WORDS.countedTone(span.agreement.agree, span.agreement.of, SPAN_TONE_WORD[tone].toLowerCase(), ofPeriod)
      : OUTLOOK_WORDS.countedSplit(span.agreement.agree, span.agreement.of, ofPeriod);
  }
  const all = card.v3?.agreement;
  if (all && all.of > 0) return OUTLOOK_WORDS.countedSplit(all.agree, all.of, false);
  return null;
}

const DAY_MS = 86_400_000;
const dayNum = (iso: string) => Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / DAY_MS);

/** the stretch the bar spans: the picked period's dates, else the first to the last period; null without dates */
export function stretchSpan(period: PeriodView | null, periods: readonly PeriodView[]): { from: string; to: string } | null {
  if (period) return { from: period.item.from.slice(0, 10), to: period.item.to.slice(0, 10) };
  if (!periods.length) return null;
  const from = periods.map((p) => p.item.from.slice(0, 10)).sort()[0]!;
  const ends = periods.map((p) => p.item.to.slice(0, 10)).sort();
  const to = ends[ends.length - 1]!;
  return { from, to };
}

/** where a day sits on the bar, 0–100; null when it is outside the stretch */
export function barAt(span: { from: string; to: string }, day: string): number | null {
  const a = dayNum(span.from);
  const b = dayNum(span.to);
  const d = dayNum(day);
  if (!(b > a) || d < a || d > b) return null;
  return ((d - a) / (b - a)) * 100;
}

function StretchBar({ span, dates, today }: { span: { from: string; to: string }; dates: ReadonlyArray<{ date: string }>; today: string }) {
  const at = barAt(span, today);
  return (
    <div className="mt-2" data-testid="outlook-stretch-bar" data-from={span.from} data-to={span.to}>
      <div className="relative h-1.5 rounded-full bg-teal-300/30" role="img" aria-label={`${OUTLOOK_WORDS.stretchBar}: ${dayWords(span.from)} – ${dayWords(span.to)}`}>
        {dates.map((k) => {
          const x = barAt(span, k.date);
          return x === null ? null : <span key={k.date} className="absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 rounded bg-white/60" style={{ left: `${x}%` }} aria-hidden="true" />;
        })}
        {at !== null && (
          <span
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0e1650] bg-white"
            style={{ left: `${at}%` }}
            title={OUTLOOK_WORDS.today}
            data-testid="outlook-bar-today"
            aria-hidden="true"
          />
        )}
      </div>
      <div className="mt-1 flex justify-between gap-2 text-[13px] text-white/60">
        <span data-testid="outlook-bar-from">{dayWords(span.from)}</span>
        <span data-testid="outlook-bar-to">{dayWords(span.to)}</span>
      </div>
    </div>
  );
}

export default function OutlookView({
  card,
  period,
  periods,
  standing,
  options,
  showWhy,
  showDates,
  onAstrology,
  section = 'overview',
  onSection,
}: OutlookViewProps) {
  const toolRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const today = todayIso();
  const why = showWhy ? whyLine(card, period) : null;
  const todo = whatToDo(card, period);
  const paragraphs = [...(period?.text ?? []), ...standing];
  const ownText = period?.text?.length ?? 0;
  const dates = showDates ? keyDatesOf(card, today) : [];
  const stretch = showDates ? stretchSpan(period, periods) : null;
  const span = analysisSpan(card, period);
  const clocks = (span?.clocks ?? []).filter((c) => !!c.label?.trim());
  const agreeing = clocks.filter((c) => c.agrees);
  const testing = clocks.filter((c) => !c.agrees);
  const steps = planSteps(card, options);
  const pattern = patternLine(card);
  const chart = card.v3?.chart ?? null;
  const gift = withoutSpanIds(chart?.gift) || null;
  const knot = withoutSpanIds(chart?.knot) || null;
  const shows = chartShows(card, period);
  const certainty = certaintyWord(chart?.certainty);
  const hasTodo = !!(todo.best || todo.avoid);
  const growth = period?.span?.growth?.trim() || null;
  const plain = storyParagraphs(card.v3?.plain?.story).length > 0;
  const has: Record<OutlookSection, boolean> = {
    overview: !!why || hasTodo || !!growth || paragraphs.length > 0 || !!pattern,
    dates: !!stretch || dates.length > 0,
    systems: clocks.length > 0 || !!span?.agreement,
    ladder: steps.length > 0,
    chart: !!gift || !!knot || !!shows || !!certainty,
  };
  const tools = OUTLOOK_SECTIONS.filter((t) => has[t.id]);
  if (!tools.length && !plain)
    return (
      <p className="text-center text-[15px] text-white/60" data-testid="outlook-empty">
        {V3_WORDS.noText}
      </p>
    );
  // the picked section, else the first one this card has
  const on: OutlookSection | null = has[section] ? section : (tools[0]?.id ?? null);
  const pick = (id: OutlookSection) => onSection?.(id);
  // arrow keys move along the toolbar (Tab reaches every button too)
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    const i = tools.findIndex((t) => t.id === on);
    const next = tools[(i + d + tools.length) % tools.length]!;
    e.preventDefault();
    pick(next.id);
    toolRefs.current[tools.indexOf(next)]?.focus();
  };

  const todoBlock = hasTodo && (
    <section className="o-todo" data-testid="section-todo">
      <h4 className={label}>{V3_WORDS.whatToDo}</h4>
      <ul className="self-v3-todo-list mt-1.5 grid gap-1.5">
        {todo.best && (
          <li className="grid grid-cols-[72px_1fr] gap-2.5 rounded-xl bg-white/5 px-3 py-2 text-[15px]" data-testid="todo-best">
            <b className="self-center text-[13px] font-bold text-emerald-300">{V3_WORDS.doThis}</b>
            <span className="text-white/85">{todo.best}</span>
          </li>
        )}
        {todo.avoid && (
          <li className="grid grid-cols-[72px_1fr] gap-2.5 rounded-xl bg-white/5 px-3 py-2 text-[15px]" data-testid="todo-avoid">
            <b className="self-center text-[13px] font-bold text-amber-300">{V3_WORDS.avoid}</b>
            <span className="text-white/85">{todo.avoid}</span>
          </li>
        )}
      </ul>
    </section>
  );
  const textBlock = (testId: string, title: string, text: string) => (
    <section data-testid={testId}>
      <h4 className={label}>{title}</h4>
      <p className="mt-1 text-[15px] leading-relaxed text-white/85">{text}</p>
    </section>
  );

  let pane: ReactNode = null;
  switch (on) {
    case 'overview':
      pane = (
        <>
          {why && (
            <section className="o-why" data-testid="outlook-why">
              <h4 className={label}>{OUTLOOK_WORDS.why}</h4>
              <p className="mt-1 text-[15px] text-white/85" data-testid="outlook-why-line">
                {why}
              </p>
              {onAstrology && (
                <button type="button" onClick={onAstrology} className="mt-1 text-[13px] font-semibold text-purple-300 underline underline-offset-4 hover:text-purple-200" data-testid="outlook-see-astrology">
                  {OUTLOOK_WORDS.seeAstrology}
                </button>
              )}
            </section>
          )}
          {todoBlock}
          {growth && (
            <section data-testid="outlook-growth">
              <h4 className={label}>{OUTLOOK_WORDS.growth}</h4>
              <p className="mt-1 text-[15px] text-white/85">{growth}</p>
            </section>
          )}
          {paragraphs.length > 0 && (
            <div className="o-text space-y-3" data-testid="outlook-text">
              {paragraphs.map((t, i) => (
                <p key={i} className={body} data-testid={i < ownText ? 'stretch-text' : 'card-standing'}>
                  {t}
                </p>
              ))}
            </div>
          )}
          {pattern && (
            <section className="o-pattern" data-testid="section-pattern">
              <h4 className={label}>{V3_WORDS.pattern}</h4>
              <p className="mt-0.5 text-[15px] text-white/85">{pattern}</p>
            </section>
          )}
        </>
      );
      break;
    case 'dates':
      pane = (
        <section className="o-dates" data-testid="key-dates">
          <h4 className={label}>{V3_WORDS.keyDates}</h4>
          {stretch && <StretchBar span={stretch} dates={dates} today={today} />}
          {dates.length > 0 && (
            <ul className="mt-1.5 grid gap-1">
              {dates.map((k) => (
                <li key={`${k.date}-${k.label}`} className={`flex gap-2 text-[15px] ${k.passed ? 'text-white/45' : 'text-white/85'}`} data-testid="key-date" data-passed={k.passed ? 'true' : 'false'}>
                  <b className="shrink-0 font-semibold">{dayWords(k.date, { short: true, today })}:</b>{' '}
                  <span>
                    {k.label}
                    {k.passed && <span className="ml-1.5 text-[13px] italic">({V3_WORDS.passed})</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      );
      break;
    case 'systems':
      pane = (
        <section className="o-systems" data-testid="analysis-systems">
          <h4 className={label}>{VIEW_WORDS.systems}</h4>
          {span?.agreement && (
            <p className="mt-1 text-[15px] text-white/85" data-testid="analysis-agreement">
              {VIEW_WORDS.agree(span.agreement.agree, span.agreement.of)}
              {period?.label ? <span className="text-white/55"> · {period.label}</span> : null}
            </p>
          )}
          {agreeing.length > 0 && <SystemList title={VIEW_WORDS.agreeing} items={agreeing} testId="analysis-agreeing" />}
          {testing.length > 0 && <SystemList title={VIEW_WORDS.testing} items={testing} testId="analysis-testing" />}
        </section>
      );
      break;
    case 'ladder':
      pane = (
        <section className="o-ladder" data-testid="analysis-ladder">
          <h4 className={label}>{VIEW_WORDS.ladder}</h4>
          <ol className="mt-1.5 grid gap-1.5">
            {steps.map((s) => (
              <li key={s.key} className="grid grid-cols-[88px_1fr] gap-2.5 rounded-xl bg-white/5 px-3 py-2 text-[15px]" data-testid={`ladder-${s.key}`}>
                <b className="self-center text-[13px] font-bold text-teal-200">{nameOr(STEP_WORD, s.key)}</b>
                <span className="text-white/85">{s.text}</span>
              </li>
            ))}
          </ol>
        </section>
      );
      break;
    case 'chart':
      pane = (
        <>
          {gift && textBlock('astrology-gift', OUTLOOK_WORDS.gift, gift)}
          {knot && textBlock('astrology-knot', OUTLOOK_WORDS.knot, knot)}
          {certainty && (
            <p className="text-[13px] text-white/60" data-testid="astrology-certainty">
              {OUTLOOK_WORDS.certainty}: <b className="font-semibold text-white/85">{certainty}</b>
            </p>
          )}
          {shows && textBlock('astrology-shows', OUTLOOK_WORDS.shows, shows)}
        </>
      );
      break;
  }

  return (
    <div className="self-v3-outlook-wrap" data-testid="outlook-view" data-section={on ?? ''}>
      {plain && (
        <div className="mb-3">
          <StoryProse text={card.v3?.plain?.story} testId="outlook-plain-story" />
        </div>
      )}
      {tools.length > 1 && (
        <div role="toolbar" aria-label={OUTLOOK_WORDS.toolbar} onKeyDown={onKey} className="self-v3-outlook-tools mb-3 flex flex-wrap gap-1" data-testid="outlook-tools">
          {tools.map((t, i) => (
            <button
              key={t.id}
              ref={(el) => void (toolRefs.current[i] = el)}
              type="button"
              aria-pressed={t.id === on}
              aria-label={t.title}
              title={t.title}
              onClick={() => pick(t.id)}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full border focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70 ${t.id === on ? 'border-teal-300/50 bg-teal-500/20 text-teal-100' : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'}`}
              data-testid={`outlook-tool-${t.id}`}
            >
              <t.Icon className="h-4 w-4" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      {on && (
        <div key={`${on}-${period?.index ?? -1}`} className="self-v3-fade self-v3-outlook" data-testid={`outlook-pane-${on}`}>
          {pane}
        </div>
      )}
    </div>
  );
}
