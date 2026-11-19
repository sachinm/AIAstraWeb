/**
 * The slim footer of a ready card: "Is this right?" when the board keeps it on and the card has a claim to check.
 *
 * `pinned` (tablet and desktop, server docs/dashboards/13 §4.3): the footer sits outside the card's scroll, between the
 * view and the chat input, with a top fade so the text scrolls under it. One line from a 500 px card, two under it.
 */
import type { SelfV3CardView } from '../../../lib/selfV3Api';
import { ConfirmSection } from './CardParts';

export default function CardFooter({ card, confirmOn, pinned = false }: { card: SelfV3CardView; confirmOn: boolean; pinned?: boolean }) {
  const confirm = confirmOn ? card.v3?.confirm : null;
  if (!confirm) return null;
  if (pinned)
    return (
      <footer className="self-v3-footer self-v3-pinned relative shrink-0 border-t border-white/10 pt-2" data-testid="card-footer" data-pinned="true">
        <ConfirmSection key={confirm.claimId} confirm={confirm} />
      </footer>
    );
  return (
    <footer className="self-v3-footer mt-2 shrink-0 border-t border-white/10 pt-2" data-testid="card-footer">
      <ConfirmSection key={confirm.claimId} confirm={confirm} />
    </footer>
  );
}
