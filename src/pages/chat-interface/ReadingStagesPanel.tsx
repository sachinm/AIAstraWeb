import React, { useEffect, useId, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, ChevronRight, Circle, Loader2, MinusCircle } from 'lucide-react';
import {
  formatSeconds,
  isFinished,
  panelStages,
  stageCounts,
  stageReason,
  statusWord,
  type ReadingProgress,
  type StageChip,
  type StageStatus,
} from './readingProgress';

/** How long the finished panel stays on screen before it folds away. */
export const PANEL_HIDE_DELAY_MS = 1500;
/** Length of the fold animation (skipped with reduced motion). */
export const PANEL_FOLD_MS = 300;

export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Live clock for the elapsed times; ticks once a second only while `active`. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

function stageElapsed(c: StageChip, now: number): number | null {
  if (c.status === 'waiting') return null;
  if (isFinished(c.status)) return c.ms ?? (c.startedAt !== undefined && c.endedAt !== undefined ? c.endedAt - c.startedAt : null);
  return c.startedAt !== undefined ? now - c.startedAt : null;
}

function totalElapsed(stages: StageChip[], now: number, working: boolean): number | null {
  const starts = stages.map((s) => s.startedAt).filter((n): n is number => n !== undefined);
  if (!starts.length) return null;
  const from = Math.min(...starts);
  if (working) return now - from;
  const ends = stages.map((s) => s.endedAt).filter((n): n is number => n !== undefined);
  return ends.length ? Math.max(...ends) - from : null;
}

const ICON_CLASS = 'h-4 w-4 shrink-0';

const StatusIcon: React.FC<{ status: StageStatus }> = ({ status }) => {
  if (status === 'start') return <Loader2 className={`${ICON_CLASS} text-purple-300 motion-safe:animate-spin`} aria-hidden />;
  if (status === 'done') return <Check className={`${ICON_CLASS} text-green-300`} aria-hidden />;
  if (status === 'failed') return <AlertTriangle className={`${ICON_CLASS} text-amber-300`} aria-hidden />;
  if (status === 'skipped') return <MinusCircle className={`${ICON_CLASS} text-slate-400`} aria-hidden />;
  return <Circle className={`${ICON_CLASS} text-slate-500`} aria-hidden />;
};

const STATUS_TEXT: Record<StageStatus, string> = {
  waiting: 'text-slate-400',
  start: 'text-purple-200',
  done: 'text-green-300',
  failed: 'text-amber-300',
  skipped: 'text-slate-400',
};

/** One row per stage: icon, name, state word and time; a plain reason underneath when there is one. */
export const StageList: React.FC<{ stages: StageChip[]; now: number }> = ({ stages, now }) => (
  <ol className="flex flex-col gap-1.5" data-test-id="reading-stage-list">
    {stages.map((c) => {
      const t = stageElapsed(c, now);
      const reason = stageReason(c);
      return (
        <li key={c.key} data-test-id="reading-stage-row" data-stage={c.name} data-status={c.status} className="min-w-0">
          <div className="flex items-center gap-2 text-sm">
            <StatusIcon status={c.status} />
            <span className={`min-w-0 flex-1 truncate ${c.status === 'waiting' ? 'text-slate-400' : 'text-gray-100'}`}>{c.label}</span>
            <span className={`shrink-0 text-xs ${STATUS_TEXT[c.status]}`} data-test-id="reading-stage-state">
              {statusWord(c.status)}
              {t !== null && <span className="ml-1 tabular-nums text-slate-400">{formatSeconds(t)}</span>}
            </span>
          </div>
          {reason && (
            <p className="ml-6 text-xs leading-snug text-slate-300 break-words" data-test-id="reading-stage-reason">
              {reason}
            </p>
          )}
        </li>
      );
    })}
  </ol>
);

type Phase = 'live' | 'folding' | 'gone';

/**
 * The live stage panel, shown in the chat just above the AI message being written (outside the message body, so the
 * answer text never moves inside its bubble). It folds away ~1.5 s after the reading finishes.
 */
export const ReadingStagesPanel: React.FC<{ progress?: ReadingProgress; working: boolean }> = ({ progress, working }) => {
  const [phase, setPhase] = useState<Phase>(working ? 'live' : 'gone');
  const now = useNow(working && phase === 'live');

  useEffect(() => {
    if (working) {
      setPhase('live');
      return;
    }
    let fold: ReturnType<typeof setTimeout> | undefined;
    const hide = setTimeout(() => {
      if (prefersReducedMotion()) {
        setPhase('gone');
        return;
      }
      setPhase('folding');
      fold = setTimeout(() => setPhase('gone'), PANEL_FOLD_MS);
    }, PANEL_HIDE_DELAY_MS);
    return () => {
      clearTimeout(hide);
      if (fold) clearTimeout(fold);
    };
  }, [working]);

  const stages = panelStages(progress);
  if (phase === 'gone' || stages.length === 0) return null;
  const { finished, total } = stageCounts(stages);
  const elapsed = totalElapsed(stages, now, working);
  // a stream that ended with stages still open (error or stop) is not a finished reading
  const title = working ? 'Preparing your reading' : finished === total ? 'Reading ready' : 'Reading stopped';

  return (
    <div
      data-test-id="reading-stages-panel"
      data-phase={phase}
      className={`not-prose grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
        phase === 'folding' ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'
      }`}
    >
      <section
        aria-label="Reading progress"
        className="min-h-0 overflow-hidden rounded-xl border border-purple-400/30 bg-slate-900/60 px-3 py-2.5 shadow-sm backdrop-blur-sm sm:px-4"
      >
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <h3 className="text-sm font-semibold text-purple-100">{title}</h3>
          <p className="text-xs text-slate-300 tabular-nums" aria-live="polite" data-test-id="reading-stages-count">
            {finished} of {total}
            {elapsed !== null && <span className="ml-2 text-slate-400">{formatSeconds(elapsed)}</span>}
          </p>
        </div>
        <StageList stages={stages} now={now} />
      </section>
    </div>
  );
};

/** "How this reading was made": a small link on a finished answer that re-opens its stage list (closed by default). */
export const ReadingMadeLink: React.FC<{ progress?: ReadingProgress }> = ({ progress }) => {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const stages = panelStages(progress).filter((s) => s.status !== 'waiting');
  if (!stages.length) return null;
  const { finished, total } = stageCounts(stages);
  return (
    <div className="not-prose mt-2" data-test-id="reading-made">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={listId}
        data-test-id="reading-made-toggle"
        className="inline-flex items-center gap-1 text-xs text-purple-300 underline-offset-2 hover:text-purple-100 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded"
      >
        {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
        How this reading was made
      </button>
      {open && (
        <div id={listId} className="mt-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2" data-test-id="reading-made-body">
          <p className="mb-1.5 text-xs text-slate-400">
            {finished} of {total} stages
          </p>
          <StageList stages={stages} now={Date.now()} />
        </div>
      )}
    </div>
  );
};

export default ReadingStagesPanel;
