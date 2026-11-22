/**
 * The fresh-reading control in the Self board row (server docs/billing/03, mockup board row): offline first, so opening
 * the board never builds or costs anything; once the reading's last good day has passed the person may ask for a fresh
 * one, which uses one question. Every date and the "due" answer come from the server (`board.refresh`).
 *
 *   not due   disabled "Fresh reading from <day after Good until>", line "Made … · Good until …"
 *   due       primary "Get a fresh reading", line "Uses 1 of your N questions"; the tap opens the consent sheet
 *   building  disabled "Making your fresh reading…" (the page veils the cards and polls)
 *   402       "No questions left" with Upgrade to the plan page
 *   failed    "That did not work. Try again" (the post failed; nothing was counted)
 *   build failed  the fresh build failed (server `refresh.failed`): "That did not work; your question was given back."
 *             with a Try again button that opens the consent sheet again
 *   locked    the reading gate (`pipeline.locked`): disabled "Building your chart data" with the server's step line,
 *             drawn even before any first reading; a 409 `preparing` or `building` answer is this state, never an error
 *
 * Only a tap on the sheet's confirm button posts; a page load never does.
 */
import { useState } from 'react';
import { Link, useInRouterContext } from 'react-router-dom';
import type { PlanStatus } from '../../../lib/billing';
import { refreshBoard, type RefreshBoard, type RefreshResult } from '../../../lib/boardRefresh';
import type { SelfV2BuildView, SelfV2Refresh } from '../../../lib/selfV2Api';
import Sheet from './Sheet';
import { BUILD_WORDS, PIPELINE_WORDS, V2_WORDS, freshCostLine, freshSheetBody, pipelineLine } from './words';
import { AI_UNAVAILABLE_MESSAGE, useAiUnavailable } from '../../../lib/aiStatus';
import { pipelineLocked, type PipelineView } from '../../../lib/pipelineStatus';

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

export function FreshSheet({ plan, onClose, onDone, board = 'self' }: { plan: PlanStatus | null | undefined; onClose: () => void; onDone: (r: RefreshResult) => void; board?: RefreshBoard }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError(false);
    const r = await refreshBoard(board);
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
 * The reading gate's control (server prep gate): the chart is still being built and prepared, so no reading can be
 * started. Disabled (never clickable or activated from the keyboard), "Building your chart data", and under it the
 * server's line with "· n of m"; the retry sentence when the server says some calculations are being tried again.
 */
export function LockedControl({ pipeline, btn, line, testId = 'fresh' }: { pipeline: PipelineView; btn: string; line: string; testId?: string }) {
  const sub = pipelineLine(pipeline);
  return (
    <div className="flex min-w-0 shrink-0 flex-col items-start" data-testid={`${testId}-reading`} data-locked="true">
      <button type="button" disabled aria-disabled="true" className={`${btn} cursor-not-allowed border border-white/15 bg-white/5 text-white/70`} data-testid={`${testId}-button`} data-state="locked">
        <span className="truncate">{PIPELINE_WORDS.label}</span>
      </button>
      <p role="status" aria-live="polite" className={pipeline.stage === 'blocked' ? 'mt-0.5 text-[11px] leading-4 text-amber-200/80' : line} data-testid={`${testId}-locked-line`} data-stage={pipeline.stage}>
        {sub}
      </p>
    </div>
  );
}

/**
 * The button and its one line. `building`: a fresh reading is being made (the page owns the poll). `onAsk`: open the
 * consent sheet. `noQuestions` / `failed`: the last answer from the server. `buildFailed`: the fresh build the person
 * asked for failed and its question was given back (the page stopped polling).
 */
export function FreshControl({
  refresh,
  plan,
  building,
  noQuestions,
  failed,
  buildFailed = false,
  onAsk,
  compact = false,
  pipeline = null,
}: {
  refresh: SelfV2Refresh | undefined;
  plan: PlanStatus | null | undefined;
  building: boolean;
  noQuestions: boolean;
  failed: boolean;
  buildFailed?: boolean;
  onAsk: () => void;
  compact?: boolean;
  /** the reading gate: while `locked`, the control is always drawn, disabled, with the server's step line */
  pipeline?: PipelineView | null;
}) {
  const aiDown = useAiUnavailable();
  const btn = `inline-flex min-h-[40px] items-center whitespace-nowrap rounded-full px-3.5 text-[13px] font-bold ${compact ? 'max-w-[11.5rem]' : 'max-w-[15rem]'}`;
  const line = 'mt-0.5 truncate text-[11px] leading-4 text-white/55';
  if (pipelineLocked(pipeline)) return <LockedControl pipeline={pipeline!} btn={btn} line={line} />;
  if (!refresh || (!refresh.madeAt && !refresh.due && !building)) return null;

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
  } else if (buildFailed) {
    control = refresh.due ? (
      <button type="button" onClick={onAsk} disabled={aiDown} title={aiDown ? AI_UNAVAILABLE_MESSAGE : undefined} className={`${btn} bg-teal-400 text-[#06051a] shadow-[0_0_0_1px_rgba(45,212,191,0.4)] hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-40`} data-testid="fresh-button" data-state="build_failed">
        <span className="truncate">{W.tryAgain}</span>
      </button>
    ) : null;
    return (
      <div className="flex min-w-0 shrink-0 flex-col items-start" data-testid="fresh-reading">
        {control}
        <p role="alert" className="mt-0.5 text-[11px] leading-4 text-rose-300" data-testid="fresh-build-failed">
          {W.givenBack}
        </p>
      </div>
    );
  } else if (refresh.due) {
    control = (
      <button type="button" onClick={onAsk} disabled={aiDown} title={aiDown ? AI_UNAVAILABLE_MESSAGE : undefined} className={`${btn} bg-teal-400 text-[#06051a] shadow-[0_0_0_1px_rgba(45,212,191,0.4)] hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-40`} data-testid="fresh-button" data-state="due">
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

/**
 * The build chip beside the fresh-reading control (server docs/loading-overlay/05): what the server says about the
 * board's build. Queued or running: "Making your reading · step n of 7" with a tiny bar. Failed or stuck: one plain line
 * with Try again (the page reads the board again, which queues the build again). Ready, none or no `build` (an older
 * server): nothing.
 */
export function BuildStatus({ build, onRetry, testId = 'build-status' }: { build: SelfV2BuildView | undefined; onRetry: () => void; testId?: string }) {
  if (!build) return null;
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
