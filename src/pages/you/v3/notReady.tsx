/** The plain line for a card that is not ready, or null when it is. With the per-card reading on, the card's own state. */
import type { ReactNode } from 'react';
import { selfGroupOf } from '../../../components/boardCards/cardArtRegistry';
import LoadingVeil from '../../../components/LoadingVeil';
import { cardReadPending, type SelfV3CardView } from '../../../lib/selfV3Api';
import { V2_WORDS } from '../v2/words';
import { ReadStateBody, cardHeadline, showsReadState, type CardReading } from './CardParts';
import { V3_WORDS } from './words';

function hasCardContent(card: SelfV3CardView): boolean {
  if (cardHeadline(card)) return true;
  if (Array.isArray(card.standing) && card.standing.some((s) => !!s?.trim())) return true;
  if (card.rail?.some((r) => !!r.headline?.trim() || !!r.name?.trim() || (Array.isArray(r.text) && r.text.some((t) => !!t?.trim())))) return true;
  if (card.v2?.card?.body && card.v2.card.body.some((b) => !!b?.trim())) return true;
  if (card.v3?.spans && card.v3.spans.length > 0) return true;
  return false;
}

export function notReadyBody(card: SelfV3CardView, veil: boolean, reading?: CardReading): ReactNode {
  // a card the server does not offer yet (Love and Work: "Coming soon") says so and nothing else
  if (card.available === false)
    return (
      <p className="mt-3 text-[15px] text-white/75" data-testid="card-coming-soon">
        {card.unavailableReason || V3_WORDS.comingSoon}
      </p>
    );
  // a Love or Work card queued or being read again keeps the text it already has on screen (server docs/dashboards/10:
  // on the first open of the day a card with a stored reading can be queued while its text is served). Self unchanged.
  const keepsText = selfGroupOf(card.id) === null && cardReadPending(card.state) && hasCardContent(card);
  if (reading && showsReadState(card, reading) && !keepsText) return <ReadStateBody card={card} reading={reading} />;
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
  if (card.status === 'withheld' || !hasCardContent(card))
    return (
      <p className="mt-3 text-[15px] text-white/75" data-testid="card-withheld">
        {V2_WORDS.cardWithheld}
      </p>
    );
  return null;
}
