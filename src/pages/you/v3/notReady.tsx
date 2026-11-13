/** The plain line for a card that is not ready, or null when it is. With the per-card reading on, the card's own state. */
import type { ReactNode } from 'react';
import LoadingVeil from '../../../components/LoadingVeil';
import type { SelfV3CardView } from '../../../lib/selfV3Api';
import { V2_WORDS } from '../v2/words';
import { ReadStateBody, cardHeadline, showsReadState, type CardReading } from './CardParts';
import { V3_WORDS } from './words';

export function notReadyBody(card: SelfV3CardView, veil: boolean, reading?: CardReading): ReactNode {
  if (reading && showsReadState(card, reading)) return <ReadStateBody card={card} reading={reading} />;
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
