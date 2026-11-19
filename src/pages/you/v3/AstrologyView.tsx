/**
 * The Astrology Reading tab of a card on tablet and desktop (server docs/dashboards/13 §4.3): the chart-language
 * reasoning the server stored with the card. The gift, the knot, what the chart shows for the picked stretch, the
 * certainty word, which clocks agree, and on Self the card's chart details. Absent text is simply not drawn; a card with
 * none of it says "Nothing more to show for this card yet." Nothing is computed here.
 */
import type { AreaCertainty } from '../../../lib/selfV2Api';
import type { SelfV3CardView } from '../../../lib/selfV3Api';
import { ChartDetails } from '../v2/AreaCard';
import { CERTAINTY_WORD } from '../v2/words';
import { analysisSpan, detailsArea, SystemList, VIEW_WORDS } from './CardViews';
import type { PeriodView } from './cardModel';
import { label } from './faces/parts';
import { OUTLOOK_WORDS } from './words';

/** the certainty word for a stored enum; null for anything the page has no word for */
export function certaintyWord(certainty: string | null | undefined): string | null {
  const key = certainty?.trim().toLowerCase();
  return key && Object.prototype.hasOwnProperty.call(CERTAINTY_WORD, key) ? CERTAINTY_WORD[key as AreaCertainty] : null;
}

/** what the chart shows for the picked stretch: matched by its span id */
export function chartShows(card: SelfV3CardView, period: PeriodView | null): string | null {
  const id = period?.span?.span ?? period?.item.span ?? null;
  if (!id) return null;
  return card.v3?.chart?.spans?.find((s) => s?.span === id)?.shows?.trim() || null;
}

export default function AstrologyView({ card, period, showDetails }: { card: SelfV3CardView; period: PeriodView | null; showDetails: boolean }) {
  const chart = card.v3?.chart ?? null;
  const gift = chart?.gift?.trim() || null;
  const knot = chart?.knot?.trim() || null;
  const shows = chartShows(card, period);
  const certainty = certaintyWord(chart?.certainty);
  const span = analysisSpan(card, period);
  const clocks = (span?.clocks ?? []).filter((c) => !!c.label?.trim());
  const agreeing = clocks.filter((c) => c.agrees);
  const testing = clocks.filter((c) => !c.agrees);
  const area = detailsArea(card);
  // the older chart details are the same card read by an earlier build: shown only when this card has no chart reading
  const hasDetails = showDetails && !gift && !knot && !shows && (!!area.details.headline?.trim() || (area.details.paragraphs ?? []).some((p) => !!p?.trim()));
  if (!gift && !knot && !shows && !certainty && !clocks.length && !hasDetails)
    return (
      <p className="text-center text-[15px] text-white/60" data-testid="astrology-empty">
        {OUTLOOK_WORDS.nothing}
      </p>
    );
  const block = (testId: string, title: string, text: string) => (
    <section data-testid={testId}>
      <h4 className={label}>{title}</h4>
      <p className="mt-1 text-[15px] leading-relaxed text-white/85">{text}</p>
    </section>
  );
  return (
    <div key={period?.index ?? -1} className="self-v3-fade self-v3-astrology space-y-4" data-testid="astrology-view">
      {gift && block('astrology-gift', OUTLOOK_WORDS.gift, gift)}
      {knot && block('astrology-knot', OUTLOOK_WORDS.knot, knot)}
      {shows && block('astrology-shows', OUTLOOK_WORDS.shows, shows)}
      {certainty && (
        <p className="text-[13px] text-white/60" data-testid="astrology-certainty">
          {OUTLOOK_WORDS.certainty}: <b className="font-semibold text-white/85">{certainty}</b>
        </p>
      )}
      {clocks.length > 0 && (
        <section data-testid="astrology-clocks">
          <h4 className={label}>{OUTLOOK_WORDS.clocks}</h4>
          {agreeing.length > 0 && <SystemList title={VIEW_WORDS.agreeing} items={agreeing} testId="astrology-agreeing" />}
          {testing.length > 0 && <SystemList title={VIEW_WORDS.testing} items={testing} testId="astrology-testing" />}
        </section>
      )}
      {hasDetails && (
        <section data-testid="astrology-details">
          <ChartDetails area={area} showEvidence={false} />
        </section>
      )}
    </div>
  );
}
