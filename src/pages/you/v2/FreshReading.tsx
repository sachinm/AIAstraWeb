/**
 * The fresh-reading control in the Self board row (server docs/billing/03, mockup board row): offline first, so opening
 * the board never builds or costs anything; once the reading's last good day has passed the person may ask for a fresh
 * one, which uses one question. Every date and the "due" answer come from the server (`board.refresh`).
 *
 *   not due   disabled "Good until <last good day>" (its tooltip: when a fresh one may be asked for), line "Made …"
 *   catching up  409 not_ready: "Your board is catching up. Try again in a few minutes." with Try again
 *   first     Love and Work, a lens never read: "Read these cards", line "Free: first reading"
 *   due       primary "Get a fresh reading", line "Uses 1 of your N questions"; the tap opens the consent sheet
 *   building  disabled "Making your fresh reading…" (the page veils the cards and polls)
 *   402       "No questions left" with Upgrade to the plan page
 *   failed    "That did not work. Try again" (the post failed; nothing was counted)
 *   build failed  the fresh build failed (server `refresh.failed`): "That did not work; your question was given back."
 *             with a Try again button that opens the consent sheet again
 *
 * Only a tap on the sheet's confirm button (or, for a lens never read, its free "Read these cards") posts; a page load
 * never does. `freshnessState` picks exactly one of these from the served fields and the last answer, so the chip
 * never says two things at once.
 */
import { useState, type ReactNode } from 'react';
import { Link, useInRouterContext } from 'react-router-dom';
import type { PlanStatus } from '../../../lib/billing';
import { refreshBoard, type RefreshBoard, type RefreshResult } from '../../../lib/boardRefresh';
import type { SelfV2BuildView, SelfV2Refresh } from '../../../lib/selfV2Api';
import Sheet from './Sheet';
import { BUILD_WORDS, V2_WORDS, freshCostLine, freshSheetBody } from './words';
import { AI_UNAVAILABLE_MESSAGE, useAiUnavailable } from '../../../lib/aiStatus';

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

export function FreshSheet({ plan, onClose, onDone, board = 'self', lens = null }: { plan: PlanStatus | null | undefined; onClose: () => void; onDone: (r: RefreshResult) => void; board?: RefreshBoard; lens?: string | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError(false);
    const r = await refreshBoard(board, { lens });
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

export type FreshState = 'none' | 'building' | 'no_questions' | 'given_back' | 'catching_up' | 'due' | 'first' | 'good' | 'made';

/**
 * The one state the fresh-reading chip shows, from the served `refresh` block and the last answer. Order matters: what
 * is happening now (building) wins over what the person last heard, which wins over the served dates.
 */
export function freshnessState(o: {
  refresh: SelfV2Refresh | undefined;
  building: boolean;
  noQuestions?: boolean;
  buildFailed?: boolean;
  catchingUp?: boolean;
  /** Love and Work: the lens on screen has never been read and none of its cards is being read */
  firstRead?: boolean;
}): FreshState {
  const r = o.refresh;
  if (o.building) return 'building';
  if (o.noQuestions) return 'no_questions';
  if (o.buildFailed) return 'given_back';
  if (o.catchingUp) return 'catching_up';
  if (r?.due) return 'due';
  if (o.firstRead && !r?.madeAt) return 'first';
  if (r?.madeAt && r.validUntil) return 'good';
  if (r?.madeAt) return 'made';
  return 'none';
}

/**
 * The button and its one line. `building`: a fresh reading is being made (the page owns the poll). `onAsk`: open the
 * consent sheet. `noQuestions` / `failed` / `catchingUp`: the last answer from the server. `buildFailed`: the fresh build
 * the person asked for failed and its question was given back (the page stopped polling). `onFirst`: Love and Work, the
 * free first reading of a lens never read. `note`: one line under the chip (what the last ask cost).
 */
export function FreshControl({
  refresh,
  plan,
  building,
  noQuestions,
  failed,
  buildFailed = false,
  catchingUp = false,
  onAsk,
  onFirst,
  note = null,
  compact = false,
}: {
  refresh: SelfV2Refresh | undefined;
  plan: PlanStatus | null | undefined;
  building: boolean;
  noQuestions: boolean;
  failed: boolean;
  buildFailed?: boolean;
  catchingUp?: boolean;
  onAsk: () => void;
  onFirst?: () => void;
  note?: string | null;
  compact?: boolean;
}) {
  const aiDown = useAiUnavailable();
  const state = freshnessState({ refresh, building, noQuestions, buildFailed, catchingUp, firstRead: !!onFirst });
  if (state === 'none') return null;
  const btn = `inline-flex min-h-[40px] items-center whitespace-nowrap rounded-full px-3.5 text-[13px] font-bold ${compact ? 'max-w-[11.5rem]' : 'max-w-[15rem]'}`;
  const primary = `${btn} bg-teal-400 text-[#06051a] shadow-[0_0_0_1px_rgba(45,212,191,0.4)] hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-40`;
  const line = 'mt-0.5 truncate text-[11px] leading-4 text-white/55';
  const wrap = (control: ReactNode, sub: ReactNode) => (
    <div className="flex min-w-0 shrink-0 flex-col items-start" data-testid="fresh-reading" data-fresh={state}>
      {control}
      {sub}
    </div>
  );
  const subLine = (text: string | null) =>
    text ? (
      <p className={line} data-testid="fresh-line">
        {text}
      </p>
    ) : null;
  const aiTitle = aiDown ? AI_UNAVAILABLE_MESSAGE : undefined;

  switch (state) {
    case 'building':
      return wrap(
        <button type="button" disabled aria-live="polite" className={`${btn} cursor-default border border-white/15 bg-white/5 text-white/70`} data-testid="fresh-button" data-state="building">
          <span className="truncate">{W.working}</span>
        </button>,
        subLine(note),
      );
    case 'no_questions':
      return wrap(
        <p className="whitespace-nowrap text-[13px] font-semibold text-white/80" data-testid="fresh-no-questions" data-state="no_questions">
          {W.noQuestions} · <UpgradeLink />
        </p>,
        null,
      );
    case 'given_back':
      return wrap(
        refresh?.due ? (
          <button type="button" onClick={onAsk} disabled={aiDown} title={aiTitle} className={primary} data-testid="fresh-button" data-state="build_failed">
            <span className="truncate">{W.tryAgain}</span>
          </button>
        ) : null,
        <p role="alert" className="mt-0.5 text-[11px] leading-4 text-rose-300" data-testid="fresh-build-failed">
          {W.givenBack}
        </p>,
      );
    case 'catching_up':
      return wrap(
        <button type="button" onClick={!refresh?.due && onFirst ? onFirst : onAsk} disabled={aiDown} title={aiTitle} className={primary} data-testid="fresh-button" data-state="catching_up">
          <span className="truncate">{W.tryAgain}</span>
        </button>,
        <p role="status" className="mt-0.5 max-w-[18rem] text-[11px] leading-4 text-amber-200" data-testid="fresh-catching-up">
          {W.catchingUp}
        </p>,
      );
    case 'due':
      return wrap(
        <button type="button" onClick={onAsk} disabled={aiDown} title={aiTitle} className={primary} data-testid="fresh-button" data-state="due">
          <span className="truncate">{failed ? W.failed : W.get}</span>
        </button>,
        subLine(freshCostLine(plan)),
      );
    case 'first':
      return wrap(
        <button type="button" onClick={onFirst} disabled={aiDown} title={aiTitle} className={primary} data-testid="fresh-button" data-state="first">
          <span className="truncate">{failed ? W.failed : W.readFirst}</span>
        </button>,
        subLine(W.free),
      );
    case 'good':
      return wrap(
        <button
          type="button"
          disabled
          aria-disabled="true"
          title={W.nextFrom(refresh!.validUntil!)}
          className={`${btn} cursor-not-allowed border border-white/10 bg-white/5 text-white/60`}
          data-testid="fresh-button"
          data-state="not_due"
        >
          <span className="truncate">{W.goodUntil(refresh!.validUntil!)}</span>
        </button>,
        subLine(note ?? W.madeOn(refresh!.madeAt!)),
      );
    case 'made':
      // a reading with no end date is never due: only when it was made
      return wrap(null, subLine(note ?? W.madeOn(refresh!.madeAt!)));
  }
}

/**
 * The build chip beside the fresh-reading control (server docs/loading-overlay/05): what the server says about the
 * board's build. Queued or running: "Making your reading · step n of 7" with a tiny bar. Failed or stuck: one plain line
 * with Try again (the page reads the board again, which queues the build again). Ready, none or no `build` (an older
 * server): nothing. `served`: the board's reading is on screen with its dates, so a failed or stuck background build
 * says nothing (the fresh-reading chip is the one state; a card that did not come through has its own Try again).
 */
export function BuildStatus({ build, onRetry, testId = 'build-status', served = false }: { build: SelfV2BuildView | undefined; onRetry: () => void; testId?: string; served?: boolean }) {
  if (!build) return null;
  if (served && (build.state === 'failed' || build.state === 'stuck')) return null;
  if (build.state === 'queued' || build.state === 'running') {
    const where = build.state === 'running' && build.step > 0 ? BUILD_WORDS.step(build.step, build.steps) : BUILD_WORDS.gettingReady;
    const pct = Math.max(0, Math.min(100, build.percent));
    return (
      <div className="flex min-w-0 shrink-0 flex-col items-start gap-1" data-testid={testId} data-state={build.state} role="status" aria-live="polite">
        <p className="whitespace-nowrap text-[12px] font-semibold text-white/80" data-testid={`${testId}-text`}>
          {BUILD_WORDS.making} · {where}
        </p>
        <div className="h-1 w-28 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
          <div className="h-full rounded-full bg-teal-300/80" style={{ width: `${pct}%` }} data-testid={`${testId}-bar`} />
        </div>
      </div>
    );
  }
  if (build.state === 'failed' || build.state === 'stuck') {
    return (
      <div className="flex min-w-0 shrink-0 flex-col items-start" data-testid={testId} data-state={build.state}>
        <p role="alert" className="whitespace-nowrap text-[12px] text-rose-300" data-testid={`${testId}-text`}>
          {build.state === 'failed' ? BUILD_WORDS.failed : BUILD_WORDS.stuck}{' '}
          <button type="button" onClick={onRetry} className="min-h-[32px] font-semibold text-purple-300 underline underline-offset-4 hover:text-purple-200" data-testid={`${testId}-retry`}>
            {BUILD_WORDS.tryAgain}
          </button>
        </p>
      </div>
    );
  }
  return null;
}
