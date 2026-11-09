/**
 * One area of the Self board v2 (server docs/reading-engine/66 §4.6, mockup §1): group label, title, the range it is
 * true for, the headline, two or three short paragraphs, the patterns the person repeats, the four-step ladder, dates,
 * and a footer with "Chart details ›" and the certainty word. The card's header and footer stay put; only its body
 * scrolls, inside the card.
 *
 * Pending: the loading veil over the card with what the chart says for sure under it. Withheld: one line. Failed: the
 * line that says so, then the sure lines. Chart terms live only in ChartDetails (the sheet), never on the face.
 */
import type { ReactNode } from 'react';
import LoadingVeil from '../../../components/LoadingVeil';
import type { PersonalPattern, SelfV2Area } from '../../../lib/selfV2Api';
import { CERTAINTY_WORD, GROUP_LABEL, V2_WORDS, cardRange, rangeWords, spanWords } from './words';

export const cardShell = 'glass flex h-full min-h-0 flex-col rounded-2xl p-4';

const PATTERN_ICON: Record<PersonalPattern['kind'], { mark: string; cls: string; label: string }> = {
  risk: { mark: '!', cls: 'bg-rose-500/15 text-rose-200', label: 'Watch out' },
  watch: { mark: '~', cls: 'bg-amber-500/15 text-amber-200', label: 'Keep an eye on' },
  strength: { mark: '✓', cls: 'bg-teal-500/15 text-teal-200', label: 'Strength' },
};

const LADDER: Array<{ key: 'best' | 'practical' | 'drift' | 'floor'; label: string; cls: string }> = [
  { key: 'best', label: 'Best', cls: 'text-emerald-300' },
  { key: 'practical', label: 'Practical', cls: 'text-teal-300' },
  { key: 'drift', label: 'Drift', cls: 'text-amber-300' },
  { key: 'floor', label: 'Floor', cls: 'text-rose-300' },
];

function FloorLines({ lines }: { lines: string[] }) {
  if (!lines.length) return null;
  return (
    <ul className="mt-2 space-y-1.5" data-testid="area-floor">
      {lines.map((l, i) => (
        <li key={i} className="rounded-xl bg-white/5 px-3 py-2 text-sm text-white/80">
          {l}
        </li>
      ))}
    </ul>
  );
}

function Body({ area }: { area: SelfV2Area }) {
  const card = area.card;
  if (area.status === 'withheld' || (area.status === 'ok' && !card)) {
    return (
      <p className="text-sm text-white/75" data-testid="area-withheld">
        {V2_WORDS.cardWithheld}
      </p>
    );
  }
  if (area.status === 'failed') {
    return (
      <>
        <p className="text-sm text-white/75" data-testid="area-failed">
          {V2_WORDS.cardFailed}
        </p>
        <FloorLines lines={area.floor} />
      </>
    );
  }
  if (area.status === 'pending' || !card) return <FloorLines lines={area.floor} />;
  return (
    <>
      <h3 className="mb-1.5 text-lg font-extrabold leading-snug text-white" data-testid="area-headline">
        {card.headline}
      </h3>
      {card.body.map((p, i) => (
        <p key={i} className="mt-2 text-[15px] leading-relaxed text-white/75 first-of-type:mt-0">
          {p}
        </p>
      ))}
      {card.patterns.length > 0 && (
        <ul className="mt-3 space-y-2" data-testid="area-patterns">
          {card.patterns.map((pt, i) => {
            const ic = PATTERN_ICON[pt.kind];
            const span = spanWords(pt.since, pt.until);
            return (
              <li key={i} className="grid grid-cols-[28px_1fr] items-start gap-2.5 rounded-xl bg-white/5 px-3 py-2.5 text-sm" data-kind={pt.kind}>
                <span className={`grid h-7 w-7 place-items-center rounded-lg text-sm font-extrabold ${ic.cls}`} role="img" aria-label={ic.label}>
                  {ic.mark}
                </span>
                <span>
                  <span className="text-white/90">{pt.text}</span>
                  {span && <span className="mt-0.5 block text-xs text-white/50">{span}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {card.ladder && (
        <ul className="mt-3 grid gap-1.5" data-testid="area-ladder">
          {LADDER.map((s) => (
            <li key={s.key} className="grid grid-cols-[84px_1fr] gap-2.5 rounded-xl bg-white/5 px-3 py-2 text-sm">
              <b className={`self-center text-xs font-bold uppercase tracking-wide ${s.cls}`}>{s.label}</b>
              <span className="text-white/75">{card.ladder![s.key]}</span>
            </li>
          ))}
        </ul>
      )}
      {card.dates.length > 0 && (
        <ul className="mt-3 grid text-[13px]" data-testid="area-dates">
          {card.dates.map((d, i) => (
            <li key={i} className="grid grid-cols-[1fr_auto] gap-2 border-t border-white/10 py-1.5 text-white/65">
              <span>{d.label}</span>
              <b className="font-semibold text-white/90">{rangeWords(d.from, d.to)}</b>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function AreaCard({ area, nextCheck, onDetails, focused = false }: { area: SelfV2Area; nextCheck: string | null; onDetails: (a: SelfV2Area) => void; focused?: boolean }) {
  // the server's range line when it sends one; the inferred line only for a board built before it did
  const range = area.rangeLabel !== undefined ? area.rangeLabel : cardRange(area, nextCheck);
  const certainty = area.card?.certainty ?? area.details.certainty;
  const scrollBody: ReactNode = (
    <div className="mt-2 min-h-0 flex-1 overflow-y-auto pr-1.5 [scrollbar-width:thin]" data-testid="area-body" tabIndex={0} aria-label={`${area.title}, more`}>
      {area.id === 'body' && <p className="mb-2 text-xs text-white/55" data-testid="area-body-note">{V2_WORDS.bodyNote}</p>}
      <Body area={area} />
    </div>
  );
  return (
    <article className={`${cardShell} ${focused ? 'ring-1 ring-teal-300/40' : ''}`} data-testid={`area-card-${area.id}`} data-status={area.status} aria-label={area.title}>
      <header className="shrink-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/45">{GROUP_LABEL[area.group]}</p>
        <h2 className="text-base font-bold text-white">{area.title}</h2>
        {range && (
          <p className="text-xs text-white/55" data-testid="area-range">
            {range}
          </p>
        )}
      </header>
      {area.status === 'pending' ? (
        <div className="relative mt-2 min-h-0 flex-1 overflow-hidden" data-testid="area-pending">
          <LoadingVeil testId={`area-veil-${area.id}`}>
            <div className="h-full overflow-y-auto" data-testid="area-body">
              <FloorLines lines={area.floor} />
            </div>
          </LoadingVeil>
        </div>
      ) : (
        scrollBody
      )}
      <footer className="mt-2 flex shrink-0 items-center justify-between text-[13px] text-white/55">
        <button type="button" onClick={() => onDetails(area)} className="inline-flex min-h-[40px] items-center rounded-lg px-1 text-purple-300 hover:text-purple-200" data-testid="area-details-open">
          {V2_WORDS.chartDetails} ›
        </button>
        {certainty && area.status === 'ok' && <span data-testid="area-certainty">{CERTAINTY_WORD[certainty]}</span>}
      </footer>
    </article>
  );
}

/**
 * Chart details for one area: the server's own words with chart terms allowed. No timings, technique ids or claim ids;
 * evidence keys only for a practitioner (`profile.role === 'practitioner'` on the board).
 */
export function ChartDetails({ area, showEvidence = false }: { area: SelfV2Area; showEvidence?: boolean }) {
  const d = area.details;
  const nothing = !d.headline && !(d.paragraphs && d.paragraphs.length) && !(showEvidence && d.evidence.length);
  return (
    <div className="space-y-2 text-sm text-white/80" data-testid="area-details">
      {d.headline && <p className="font-semibold text-white">{d.headline}</p>}
      {(d.paragraphs ?? []).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {d.certainty && <p className="text-xs text-white/55">{CERTAINTY_WORD[d.certainty]}</p>}
      {showEvidence && d.evidence.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-white/50" data-testid="area-evidence">
          {d.evidence.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {nothing && <p className="text-white/60">Nothing more to show for this card yet.</p>}
    </div>
  );
}
