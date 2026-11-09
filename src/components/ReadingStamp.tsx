/**
 * The line under a board's title saying when its reading was made and the last day it stays as it is (server
 * docs/billing/02 §10). Both dates come from the server. Opening the board again inside that window reuses this reading
 * and uses no question; only a fresh reading after it does.
 */
import { longDate } from '../lib/careerApi';

export function ReadingStamp({ madeAt, validUntil }: { madeAt?: string | null; validUntil?: string | null }) {
  if (!madeAt) return null;
  const made = longDate(madeAt.slice(0, 10));
  const until = validUntil ? longDate(validUntil) : null;
  return (
    <p className="mt-1 text-xs text-white/60" data-testid="reading-stamp">
      <span>Made {made}</span>
      {until && <span> · Good until {until}</span>}
      <span className="text-white/45"> · {until ? 'Opening it again before then uses no question' : 'Opening it again uses no question'}</span>
    </p>
  );
}
