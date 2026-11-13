/**
 * The slim footer every ready card carries, on every face: "Is this right?" (when the board keeps it on and the card
 * has a claim to check), how many clocks agree, and "Chart details", which is never hidden behind a face, a tool or a
 * setting.
 */
import type { SelfV3CardView } from '../../../lib/selfV3Api';
import { ConfirmSection } from './CardParts';
import { V3_WORDS } from './words';

export default function CardFooter({ card, confirmOn, onDetails, compact = false }: { card: SelfV3CardView; confirmOn: boolean; onDetails: () => void; compact?: boolean }) {
  const confirm = confirmOn ? card.v3?.confirm : null;
  const agreement = card.v3?.agreement;
  return (
    <footer className="self-v3-footer mt-2 flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-white/10 pt-2" data-testid="card-footer">
      <div className="min-w-0 flex-1">{confirm && <ConfirmSection confirm={confirm} slim />}</div>
      <div className="flex shrink-0 items-center gap-3 text-[13px] text-white/60">
        {agreement && !compact && (
          <span data-testid="card-agreement">{V3_WORDS.checkedOn(agreement.agree, agreement.of)}</span>
        )}
        <button type="button" onClick={onDetails} className="self-v3-btn inline-flex items-center rounded-lg px-1 font-medium text-purple-300 hover:text-purple-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60" data-testid="card-details-open">
          {V3_WORDS.seeDetails}
        </button>
      </div>
    </footer>
  );
}
