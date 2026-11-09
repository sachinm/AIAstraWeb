/**
 * The fresh-reading control in the Self board row (server docs/billing/03, mockup board row): offline first, so opening
 * the board never builds or costs anything; once the reading's last good day has passed the person may ask for a fresh
 * one, which uses one question. Every date and the "due" answer come from the server (`board.refresh`).
 *
 *   not due   disabled "Fresh reading from <day after Good until>", line "Made … · Good until …"
 *   due       primary "Get a fresh reading", line "Uses 1 of your N questions"; the tap opens the consent sheet
 *   building  disabled "Making your fresh reading…" (the page veils the cards and polls)
 *   402       "No questions left" with Upgrade to the plan page
 *   failed    "That did not work. Try again" (nothing was counted)
 *
 * Only a tap on the sheet's confirm button posts; a page load never does.
 */
import { useState } from 'react';
import { Link, useInRouterContext } from 'react-router-dom';
import type { PlanStatus } from '../../../lib/billing';
import { refreshBoard, type RefreshResult } from '../../../lib/boardRefresh';
import type { SelfV2Refresh } from '../../../lib/selfV2Api';
import Sheet from './Sheet';
import { V2_WORDS, freshCostLine, freshSheetBody } from './words';

const W = V2_WORDS.fresh;
const PLAN_PAGE = '/pricing';

function UpgradeLink() {
  const routed = useInRouterContext();
  const cls = 'font-semibold text-purple-300 underline underline-offset-4 hover:text-purple-200';
  return routed ? (
    <Link to={PLAN_PAGE} className={cls} data-testid="fresh-upgrade">
      {W.upgrade}
    </Link>
  ) : (
    <a href={PLAN_PAGE} className={cls} data-testid="fresh-upgrade">
      {W.upgrade}
    </a>
  );
}

export function FreshSheet({ plan, onClose, onDone }: { plan: PlanStatus | null | undefined; onClose: () => void; onDone: (r: RefreshResult) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError(false);
    const r = await refreshBoard('self');
    setBusy(false);
    if (r.kind === 'error') setError(true);
    else onDone(r);
  };
  return (
    <Sheet title={W.sheetTitle} onClose={onClose} testId="fresh-sheet">
      <p className="text-sm text-white/75" data-testid="fresh-sheet-body">
        {freshSheetBody(plan)}
      </p>
      {error && (
        <p className="mt-2 text-sm text-rose-300" role="alert" data-testid="fresh-sheet-error">
          {W.failed}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onClose} className="min-h-[44px] flex-1 rounded-xl border border-white/15 px-3 text-sm font-bold text-white/80 hover:bg-white/5" data-testid="fresh-not-now">
          {V2_WORDS.notNow}
        </button>
        <button type="button" disabled={busy} onClick={() => void confirm()} className="min-h-[44px] flex-1 rounded-xl bg-teal-400 px-3 text-sm font-bold text-[#06051a] disabled:opacity-40" data-testid="fresh-confirm">
          {W.confirm}
        </button>
      </div>
    </Sheet>
  );
}

/**
 * The button and its one line. `building`: a fresh reading is being made (the page owns the poll). `onAsk`: open the
 * consent sheet. `noQuestions` / `failed`: the last answer from the server.
 */
export function FreshControl({
  refresh,
  plan,
  building,
  noQuestions,
  failed,
  onAsk,
  compact = false,
}: {
  refresh: SelfV2Refresh | undefined;
  plan: PlanStatus | null | undefined;
  building: boolean;
  noQuestions: boolean;
  failed: boolean;
  onAsk: () => void;
  compact?: boolean;
}) {
  if (!refresh || (!refresh.madeAt && !refresh.due && !building)) return null;
  const btn = `inline-flex min-h-[40px] items-center whitespace-nowrap rounded-full px-3.5 text-[13px] font-bold ${compact ? 'max-w-[11.5rem]' : 'max-w-[15rem]'}`;
  const line = 'mt-0.5 truncate text-[11px] leading-4 text-white/55';

  let control;
  let sub: string | null = null;
  if (building) {
    control = (
      <button type="button" disabled aria-live="polite" className={`${btn} cursor-default border border-white/15 bg-white/5 text-white/70`} data-testid="fresh-button" data-state="building">
        <span className="truncate">{W.working}</span>
      </button>
    );
  } else if (noQuestions) {
    control = (
      <p className="whitespace-nowrap text-[13px] font-semibold text-white/80" data-testid="fresh-no-questions" data-state="no_questions">
        {W.noQuestions} · <UpgradeLink />
      </p>
    );
  } else if (refresh.due) {
    control = (
      <button type="button" onClick={onAsk} className={`${btn} bg-teal-400 text-[#06051a] shadow-[0_0_0_1px_rgba(45,212,191,0.4)] hover:bg-teal-300`} data-testid="fresh-button" data-state="due">
        <span className="truncate">{failed ? W.failed : W.get}</span>
      </button>
    );
    sub = freshCostLine(plan);
  } else if (refresh.validUntil) {
    control = (
      <button type="button" disabled aria-disabled="true" className={`${btn} cursor-not-allowed border border-white/10 bg-white/5 text-white/45`} data-testid="fresh-button" data-state="not_due">
        <span className="truncate">{W.from(refresh.validUntil)}</span>
      </button>
    );
    sub = refresh.madeAt ? W.made(refresh.madeAt, refresh.validUntil) : null;
  } else {
    // a reading with no end date is never due: only when it was made
    sub = refresh.madeAt ? W.made(refresh.madeAt, null) : null;
    control = null;
  }

  return (
    <div className="flex min-w-0 shrink-0 flex-col items-start" data-testid="fresh-reading">
      {control}
      {sub && (
        <p className={line} data-testid="fresh-line">
          {sub}
        </p>
      )}
    </div>
  );
}
