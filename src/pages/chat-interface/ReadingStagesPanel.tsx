import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { ReadingProgress } from './readingProgress';

/** How long the panel stays after the reading finishes before it folds away. */
export const PANEL_HIDE_DELAY_MS = 1500;
/** Length of the fold animation (skipped with reduced motion). */
export const PANEL_FOLD_MS = 300;
/** How long each line stays before the next one. */
export const LINE_MS = 4500;

export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** What the oracle says while it works. Nothing here names a step, a count or a time: the how stays with us. */
export const ORACLE_LINES = [
  'The oracle is peering through the stars…',
  'Whispering your question to the Moon…',
  'Asking Saturn to stop sulking long enough to answer…',
  'Mercury is being asked to speak clearly. Again.',
  'Sorting your destiny from the cosmic noise…',
  'Consulting the sky’s small print…',
  'Letting Jupiter weigh in, generously as ever…',
  'Polishing your answer until it shines…',
];

type Phase = 'live' | 'folding' | 'gone';

/**
 * The waiting note, shown in the chat just above the AI message being written (outside the message body, so the answer
 * text never moves inside its bubble). It folds away ~1.5 s after the reading finishes.
 */
export const ReadingStagesPanel: React.FC<{ progress?: ReadingProgress; working: boolean }> = ({ working }) => {
  const [phase, setPhase] = useState<Phase>(working ? 'live' : 'gone');
  const [line, setLine] = useState(0);

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

  useEffect(() => {
    if (!working) return undefined;
    const t = setInterval(() => setLine((n) => (n + 1) % ORACLE_LINES.length), LINE_MS);
    return () => clearInterval(t);
  }, [working]);

  if (phase === 'gone') return null;

  return (
    <div
      data-test-id="reading-stages-panel"
      data-phase={phase}
      className={`not-prose grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
        phase === 'folding' ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'
      }`}
    >
      <section
        aria-label="Reading in progress"
        className="min-h-0 overflow-hidden rounded-xl border border-purple-400/30 bg-slate-900/60 px-3 py-2.5 shadow-sm backdrop-blur-sm sm:px-4"
      >
        <p className="flex items-center gap-2 text-sm text-purple-100" aria-live="polite" data-test-id="reading-stages-line">
          <Sparkles className="h-4 w-4 shrink-0 text-purple-300 motion-safe:animate-pulse" aria-hidden />
          <span>{working ? ORACLE_LINES[line] : 'Your reading is ready.'}</span>
        </p>
      </section>
    </div>
  );
};

export default ReadingStagesPanel;
