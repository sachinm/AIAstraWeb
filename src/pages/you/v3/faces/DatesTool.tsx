/**
 * Dates tool: chronological turning-point timeline.
 * Instead of repeating the PeriodStrip pills, this surfaces exact transition dates, whether each date is past, active,
 * today, the next shift ahead, or a later horizon, what shifts at that boundary, and clock backing — jumping straight to
 * the stretch when tapped.
 */
import type { ToolProps } from '../cardModel';
import { vetCardTools, type DateMilestoneStatus } from '../toolVetting';
import { SPAN_TONE_DOT, SPAN_TONE_WORD, V3_WORDS } from '../words';

const STATUS_BADGE: Record<DateMilestoneStatus, { label: string; cls: string }> = {
  now: { label: V3_WORDS.statusNow, cls: 'bg-teal-400/25 text-teal-200' },
  started: { label: V3_WORDS.statusStarted, cls: 'bg-teal-400/15 text-teal-200/90' },
  next: { label: V3_WORDS.statusNext, cls: 'bg-amber-400/20 text-amber-200' },
  upcoming: { label: V3_WORDS.statusAhead, cls: 'bg-purple-400/20 text-purple-200' },
  past: { label: V3_WORDS.statusPast, cls: 'bg-white/10 text-white/60' },
};

export default function DatesTool(props: ToolProps) {
  const { card, periods, period, options, confirmOn, builtOn, onSelect } = props;
  const dates =
    props.vetted?.dates ??
    vetCardTools({ card, periods, options, confirmOn, builtOn, staleCopy: V3_WORDS.staleCardDates }).dates;

  if (!dates.milestones.length) return <p className="text-sm text-white/60">{V3_WORDS.nothingYet}</p>;

  return (
    <ul className="grid gap-1.5" data-testid="tool-dates-panel">
      {dates.milestones.map((m, idx) => {
        const selectable = m.periodIndex !== null;
        const selected = selectable && m.periodIndex === period?.index;
        const status = STATUS_BADGE[m.status];
        const badgeText = m.relativeLabel ? `${status.label} · ${m.relativeLabel}` : status.label;
        const metaBits = [m.tone ? SPAN_TONE_WORD[m.tone] : null, m.modeWord, m.agreementLabel].filter(Boolean);
        return (
          <li key={m.id}>
            <button
              type="button"
              disabled={!selectable}
              aria-pressed={selectable ? selected : undefined}
              onClick={() => m.periodIndex !== null && onSelect(m.periodIndex)}
              className={`self-v3-btn grid w-full grid-cols-[12px_1fr_auto] items-start gap-2.5 rounded-xl border px-3 py-2 text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 disabled:opacity-75 ${
                selected
                  ? 'border-teal-300/50 bg-teal-500/10 text-white'
                  : 'border-white/10 bg-white/[0.03] text-white/80 enabled:hover:bg-white/[0.06]'
              }`}
              data-testid={`date-${idx}`}
              data-status={m.status}
            >
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${SPAN_TONE_DOT[m.tone ?? 'none']}`} aria-hidden="true" />
              <span className="min-w-0 space-y-0.5">
                <span className="flex flex-wrap items-center gap-2">
                  <b className="font-semibold text-white">{m.displayDate}</b>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${status.cls}`} data-testid={`date-status-${idx}`}>
                    {badgeText}
                  </span>
                  <span className="font-medium text-white/90">{m.title}</span>
                </span>
                {m.detail && <span className="block text-[13px] leading-snug text-white/70">{m.detail}</span>}
              </span>
              {metaBits.length > 0 && <span className="shrink-0 whitespace-nowrap pt-0.5 text-xs font-semibold text-white/65">{metaBits.join(' · ')}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
