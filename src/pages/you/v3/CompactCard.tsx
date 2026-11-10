/**
 * One card in Template 1, Compact (server docs/reading-engine/68 §4.2): today's v2 card look, four across at tablet
 * landscape, filled from the same card view as Seasons. Headline, the current period's text, the sections the person
 * keeps on, and the dates at the bottom. Only the card's body scrolls, inside the card. No strip.
 */
import type { SelfSectionId, SelfV3CardView, SpanReading } from '../../../lib/selfV3Api';
import { CERTAINTY_WORD, V2_WORDS } from '../v2/words';
import { ConfirmSection, LadderSection, PatternSection, SectionsMenu, SensitiveNote, SpanAgreement, cardHeadline, spanToneShown, type CardReading } from './CardParts';
import { currentRail, notReadyBody, spanFor } from './SeasonsCard';
import { SPAN_MODE_WORD, SPAN_TONE_WORD } from './words';

const shell = 'glass flex h-full min-h-0 flex-col rounded-2xl p-4';

export default function CompactCard({
  card,
  sections,
  onSections,
  onDetails,
  focused = false,
  veil = true,
  reading,
}: {
  card: SelfV3CardView;
  sections: SelfSectionId[];
  onSections: (next: SelfSectionId[]) => void;
  onDetails: (card: SelfV3CardView, span?: SpanReading | null, label?: string | null) => void;
  focused?: boolean;
  veil?: boolean;
  reading?: CardReading;
}) {
  const on = (s: SelfSectionId) => sections.includes(s);
  const notReady = notReadyBody(card, veil, reading);
  const now = currentRail(card.rail);
  const span = card.v3 ? spanFor(card, now) : null;
  const certainty = card.v2?.card?.certainty ?? card.v2?.details.certainty;
  const certaintyWord = certainty ? CERTAINTY_WORD[certainty as keyof typeof CERTAINTY_WORD] : undefined;
  return (
    <article className={`${shell} ${focused ? 'ring-1 ring-teal-300/40' : ''}`} data-testid={`v3-card-${card.id}`} data-status={card.status} data-state={card.state} data-template="compact" aria-label={card.title}>
      <header className="flex shrink-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-white">{card.title}</h3>
          {card.v2?.rangeLabel && <p className="text-xs text-white/55">{card.v2.rangeLabel}</p>}
          {card.status === 'pending' && <p className="text-sm text-white/60">{card.description}</p>}
          <SensitiveNote card={card} />
        </div>
        {!notReady && <SectionsMenu card={card} sections={sections} onChange={onSections} />}
      </header>
      {notReady ?? (
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto pr-1.5 [scrollbar-width:thin]" data-testid="card-body" tabIndex={0} aria-label={`${card.title}, more`}>
          {card.status === 'stale' && <p className="mb-1.5 text-xs text-white/55">{V2_WORDS.cardStale}</p>}
          <h4 className="mb-1.5 text-lg font-extrabold leading-snug text-white" data-testid="card-line">
            {cardHeadline(card)}
          </h4>
          {on('stretch') &&
            (span ? (
              <div className="space-y-2 text-[15px] leading-relaxed text-white/80" data-testid="section-stretch">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/55">{SPAN_MODE_WORD[span.mode]}</p>
                <SpanAgreement span={span} />
                <p>{span.asks}</p>
                <p>{span.obstacle}</p>
                <p className="text-white/90">{span.step}</p>
              </div>
            ) : (
              (card.v2?.card?.body ?? []).map((p, i) => (
                <p key={i} className="mt-2 text-[15px] leading-relaxed text-white/75 first-of-type:mt-0">
                  {p}
                </p>
              ))
            ))}
          {on('pattern') && <PatternSection card={card} />}
          {on('ladder') && <LadderSection card={card} />}
          {on('confirm') && card.v3?.confirm && <ConfirmSection confirm={card.v3.confirm} />}
          {card.rail.length > 0 && (
            <ul className="mt-3 grid text-[13px]" data-testid="card-dates">
              {card.rail.map((r, i) => {
                const tone = spanToneShown(card.v3 ? spanFor(card, i) : null, r.tone);
                return (
                  <li key={i} className="grid grid-cols-[1fr_auto] gap-2 border-t border-white/10 py-1.5 text-white/65">
                    <span>{r.note ?? (tone ? SPAN_TONE_WORD[tone] : '')}</span>
                    <b className="font-semibold text-white/90">{r.label}</b>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      <footer className="mt-2 flex shrink-0 items-center justify-between text-[13px] text-white/55">
        {on('details') ? (
          <button type="button" onClick={() => onDetails(card, span, card.rail[now]?.label ?? null)} className="inline-flex min-h-[40px] items-center rounded-lg px-1 text-purple-300 hover:text-purple-200" data-testid="card-details-open">
            {V2_WORDS.chartDetails} ›
          </button>
        ) : (
          <span />
        )}
        {certaintyWord && (card.status === 'ok' || card.status === 'stale') && <span>{certaintyWord}</span>}
      </footer>
    </article>
  );
}
