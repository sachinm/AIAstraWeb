/**
 * One card in Template 2, Seasons (server docs/reading-engine/68 §4.2 wireframe). Left column, about 65 characters
 * wide: the headline and the selected period's text. Right column, "Your year": the rail of three to six periods,
 * each with its dates, a tone dot and the tone written out (never colour alone). The current period is selected on
 * open; tapping another cross-fades the left column. Below the rail: "Is this right?" and "Checked on N of M clocks".
 *
 * A v3 card's period text is "Get through" or "Build", then what it asks, the likely trap and one step. A card filled
 * from the v2 build (Phase A) shows the stored body with the period's own note.
 */
import { useState, type ReactNode } from 'react';
import LoadingVeil from '../../../components/LoadingVeil';
import type { RailItem, SelfSectionId, SelfV3CardView, SpanReading } from '../../../lib/selfV3Api';
import { V2_WORDS } from '../v2/words';
import { ConfirmSection, LadderSection, PatternSection, SectionsMenu, SensitiveNote, cardHeadline } from './CardParts';
import { SPAN_MODE_WORD, SPAN_TONE_DOT, SPAN_TONE_WORD, V3_WORDS } from './words';

export const v3CardShell = 'glass self-v3-card flex h-full min-h-0 flex-col rounded-2xl p-5';

/** the rail bar selected on open: the current one, else the first */
export function currentRail(rail: RailItem[]): number {
  const i = rail.findIndex((r) => r.current);
  return i < 0 ? 0 : i;
}

/** the span a rail bar opens on a v3 card: by id, else by position */
export function spanFor(card: SelfV3CardView, i: number): SpanReading | null {
  const spans = card.v3?.spans ?? [];
  const id = card.rail[i]?.span;
  return (id ? spans.find((s) => s.span === id) : null) ?? spans[i] ?? null;
}

/** The plain line for a card that is not ready, or null when it is. */
export function notReadyBody(card: SelfV3CardView, veil: boolean): ReactNode {
  if (card.status === 'pending') {
    return (
      <div className="relative mt-3 min-h-[120px] flex-1 overflow-hidden rounded-xl" data-testid="card-pending">
        {veil ? (
          <LoadingVeil testId={`card-veil-${card.id}`}>
            <div className="h-full" />
          </LoadingVeil>
        ) : (
          <p className="text-[15px] text-white/65">{V3_WORDS.pendingCard}</p>
        )}
      </div>
    );
  }
  if (card.status === 'failed')
    return (
      <p className="mt-3 text-[15px] text-white/75" data-testid="card-failed">
        {V3_WORDS.cardFailed}
      </p>
    );
  if (card.status === 'withheld' || !cardHeadline(card))
    return (
      <p className="mt-3 text-[15px] text-white/75" data-testid="card-withheld">
        {V2_WORDS.cardWithheld}
      </p>
    );
  return null;
}

function Stretch({ card, railIndex }: { card: SelfV3CardView; railIndex: number }) {
  const item = card.rail[railIndex];
  if (card.v3) {
    const span = spanFor(card, railIndex);
    if (!span) return <p className="mt-4 text-[15px] text-white/60">{V3_WORDS.noText}</p>;
    return (
      <div className="mt-4 space-y-3" data-testid="section-stretch" data-span={span.span}>
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/55" data-testid="stretch-mode">
          {SPAN_MODE_WORD[span.mode]}
          {item ? ` · ${item.label}` : ''}
        </p>
        {span.asks && <p className="text-base leading-relaxed text-white/85" data-testid="stretch-asks">{span.asks}</p>}
        {span.obstacle && <p className="text-base leading-relaxed text-white/75" data-testid="stretch-obstacle">{span.obstacle}</p>}
        {span.step && <p className="rounded-xl bg-white/5 px-3 py-2.5 text-base leading-relaxed text-white/90" data-testid="stretch-step">{span.step}</p>}
      </div>
    );
  }
  const body = card.v2?.card?.body ?? [];
  return (
    <div className="mt-4 space-y-2.5" data-testid="section-stretch">
      {item && (
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/55" data-testid="stretch-mode">
          {item.label}
          {item.note ? ` · ${item.note}` : ''}
        </p>
      )}
      {body.map((p, i) => (
        <p key={i} className="text-base leading-relaxed text-white/80">
          {p}
        </p>
      ))}
    </div>
  );
}

export function YearRail({ card, selected, onSelect }: { card: SelfV3CardView; selected: number; onSelect: (i: number) => void }) {
  if (!card.rail.length) return null;
  return (
    <section aria-label={V3_WORDS.yourYear} data-testid="section-year">
      <h4 className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/50">{V3_WORDS.yourYear}</h4>
      <ul className="mt-2 grid gap-1.5" data-testid="year-rail">
        {card.rail.map((r, i) => {
          const on = i === selected;
          return (
            <li key={`${r.from}-${i}`}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(i)}
                className={`grid min-h-[44px] w-full grid-cols-[12px_1fr_auto] items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 ${
                  on ? 'border-teal-300/50 bg-teal-500/10 text-white' : 'border-white/10 bg-white/[0.03] text-white/75 hover:bg-white/5'
                }`}
                data-testid={`rail-${i}`}
                data-current={r.current ? 'true' : 'false'}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${SPAN_TONE_DOT[r.tone ?? 'none']}`} aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{r.label}</span>
                  {!card.v3 && r.note && <span className="block truncate text-xs text-white/55">{r.note}</span>}
                </span>
                {r.tone && <span className="text-xs font-semibold text-white/70" data-testid={`rail-tone-${i}`}>{SPAN_TONE_WORD[r.tone]}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function SeasonsCard({
  card,
  sections,
  onSections,
  onDetails,
  focused = false,
  veil = true,
}: {
  card: SelfV3CardView;
  sections: SelfSectionId[];
  onSections: (next: SelfSectionId[]) => void;
  onDetails: (card: SelfV3CardView) => void;
  focused?: boolean;
  veil?: boolean;
}) {
  const [railIndex, setRailIndex] = useState(() => currentRail(card.rail));
  const on = (s: SelfSectionId) => sections.includes(s);
  const notReady = notReadyBody(card, veil);
  const headline = cardHeadline(card);
  const confirm = card.v3?.confirm ?? null;

  return (
    <article className={`${v3CardShell} ${focused ? 'ring-1 ring-teal-300/40' : ''}`} data-testid={`v3-card-${card.id}`} data-status={card.status} aria-label={card.title}>
      <header className="flex shrink-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[13px] font-bold uppercase tracking-[0.08em] text-white/70">{card.title}</h3>
          {card.status === 'pending' && <p className="mt-0.5 text-sm text-white/60">{card.description}</p>}
          {card.status === 'stale' && (
            <p className="mt-0.5 text-xs text-white/55" data-testid="card-stale">
              {V2_WORDS.cardStale}
            </p>
          )}
          <SensitiveNote card={card} />
        </div>
        {!notReady && <SectionsMenu card={card} sections={sections} onChange={onSections} />}
      </header>
      {notReady ?? (
        <div className="self-v3-seasons mt-3 min-h-0 flex-1">
          <div className="self-v3-left min-h-0 overflow-y-auto pr-1 [scrollbar-width:thin]" data-testid="card-left">
            <p className="max-w-[65ch] text-xl font-bold leading-snug text-white" data-testid="card-line">
              {headline}
            </p>
            <div key={railIndex} className="self-v3-fade max-w-[65ch]">
              {on('stretch') && <Stretch card={card} railIndex={railIndex} />}
            </div>
            {on('pattern') && <PatternSection card={card} />}
            {on('ladder') && <LadderSection card={card} />}
          </div>
          <div className="self-v3-right min-h-0" data-testid="card-right">
            <YearRail card={card} selected={railIndex} onSelect={setRailIndex} />
            {on('confirm') && confirm && <ConfirmSection confirm={confirm} />}
            {card.v3?.agreement && (
              <p className="mt-3 text-sm text-white/60" data-testid="card-agreement">
                {V3_WORDS.checkedOn(card.v3.agreement.agree, card.v3.agreement.of)}
              </p>
            )}
            {on('details') && (
              <button type="button" onClick={() => onDetails(card)} className="mt-3 inline-flex min-h-[40px] items-center rounded-lg px-1 text-sm text-purple-300 hover:text-purple-200" data-testid="card-details-open">
                {V2_WORDS.chartDetails} ›
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
