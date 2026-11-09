/**
 * The line under a board's title (server docs/billing/02 §10, 03): when its reading was made, the last day it holds, and
 * the one control that makes a new one. Boards are offline first: opening one never costs a question; a fresh reading is
 * offered once the server says it is due, and takes one question. Every date and the "due" answer come from the server.
 */
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { longDate } from '../lib/careerApi';
import { refreshBoard, type RefreshBoard } from '../lib/boardRefresh';

type Ask = 'idle' | 'working' | 'no_questions' | 'failed';

export function ReadingStamp({
  madeAt,
  validUntil,
  board,
  refreshDue,
  onRefreshed,
}: {
  madeAt?: string | null;
  validUntil?: string | null;
  /** with a board, the line carries the fresh-reading control */
  board?: RefreshBoard;
  refreshDue?: boolean;
  /** the fresh reading was made (or, for You, is being made): reload the board */
  onRefreshed?: () => void;
}) {
  const [ask, setAsk] = useState<Ask>('idle');
  if (!madeAt) return null;
  const made = longDate(madeAt.slice(0, 10));
  const until = validUntil ? longDate(validUntil) : null;

  const run = async () => {
    if (!board) return;
    setAsk('working');
    const r = await refreshBoard(board);
    if (r.kind === 'made' || r.kind === 'building') {
      setAsk('idle');
      onRefreshed?.();
    } else if (r.kind === 'no_questions') setAsk('no_questions');
    else if (r.kind === 'not_due') {
      setAsk('idle');
      onRefreshed?.();
    } else setAsk('failed');
  };

  const chip = 'ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] leading-4 align-middle';
  let control: ReactNode = null;
  if (board) {
    if (ask === 'working')
      control = (
        <span className={`${chip} border-white/15 text-white/60`} data-testid="refresh-working" aria-live="polite">
          Making your fresh reading…
        </span>
      );
    else if (ask === 'no_questions')
      control = (
        <span className={`${chip} border-white/15 text-white/70`} data-testid="refresh-no-questions">
          No questions left ·{' '}
          <Link to="/pricing" className="ml-1 font-medium text-purple-300 underline">
            Upgrade
          </Link>
        </span>
      );
    else if (refreshDue)
      control = (
        <button type="button" onClick={() => void run()} className={`${chip} border-purple-400/50 bg-purple-500/15 font-medium text-purple-200 hover:bg-purple-500/25`} data-testid="refresh-button">
          {ask === 'failed' ? 'That did not work. Try again' : 'Get a fresh reading · uses 1 question'}
        </button>
      );
    else if (until)
      control = (
        <span className={`${chip} border-white/10 text-white/45`} data-testid="refresh-later" aria-disabled="true">
          Fresh reading after {until}
        </span>
      );
  }

  return (
    <p className="mt-1 text-xs text-white/60" data-testid="reading-stamp">
      <span>Made {made}</span>
      {until && <span> · Good until {until}</span>}
      {!refreshDue && <span className="text-white/45"> · {until ? 'Opening it again before then uses no question' : 'Opening it again uses no question'}</span>}
      {control}
    </p>
  );
}
