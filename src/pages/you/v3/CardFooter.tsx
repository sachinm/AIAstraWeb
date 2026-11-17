/** The slim footer of a ready card: "Is this right?" when the board keeps it on and the card has a claim to check. */
import type { SelfV3CardView } from '../../../lib/selfV3Api';
import { ConfirmSection } from './CardParts';

export default function CardFooter({ card, confirmOn }: { card: SelfV3CardView; confirmOn: boolean }) {
  const confirm = confirmOn ? card.v3?.confirm : null;
  if (!confirm) return null;
  return (
    <footer className="self-v3-footer mt-2 shrink-0 border-t border-white/10 pt-2" data-testid="card-footer">
      <ConfirmSection key={confirm.claimId} confirm={confirm} />
    </footer>
  );
}
