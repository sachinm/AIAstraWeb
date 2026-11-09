/**
 * The Oracle's waiting note on the You reading (server docs/reading-engine/64 §4): while the synthesis is written in
 * the background, each panel shows its code card with a soft overlay that rotates the same playful lines as General
 * Reading's waiting note; when the synthesis lands the overlay lifts and the panel's Oracle lines and plan appear in
 * place. Nothing here names a step, a count, a time or the engine.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import { ORACLE_LINES, LINE_MS, prefersReducedMotion } from '../chat-interface/ReadingStagesPanel';
import LoadingVeil from '../../components/LoadingVeil';

export { ORACLE_LINES, LINE_MS };

/** The line index for a panel: panels start on different lines so the page does not read as one repeated sentence. */
export function useOracleLine(offset = 0): string {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => x + 1), LINE_MS);
    return () => clearInterval(t);
  }, []);
  return ORACLE_LINES[(i + offset) % ORACLE_LINES.length]!;
}

/** One rotating line with the sparkle, for the page-level note above the panels. */
export function OracleWaitLine({ offset = 0, testId = 'oracle-wait-line' }: { offset?: number; testId?: string }) {
  const line = useOracleLine(offset);
  return (
    <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-purple-200" data-testid={testId}>
      <Sparkles className={`h-4 w-4 shrink-0 ${prefersReducedMotion() ? '' : 'animate-pulse'}`} aria-hidden="true" />
      <span>{line}</span>
    </p>
  );
}

/**
 * Wraps a panel. While `waiting`, the panel sits faintly visible under the app's one loading veil (LoadingVeil: a
 * translucent blurred layer, a chart illustration, a rotating line); when `waiting` turns false the veil fades out
 * (instantly with reduced motion) and the panel's own content is fully shown. `offset` is kept for callers; each veil
 * now picks its own random starting line.
 */
export function OracleVeil({ waiting, panelId, children }: { waiting: boolean; offset?: number; panelId: string; children: ReactNode }) {
  const [shown, setShown] = useState(waiting);
  useEffect(() => {
    if (waiting) {
      setShown(true);
      return;
    }
    if (prefersReducedMotion()) {
      setShown(false);
      return;
    }
    const t = setTimeout(() => setShown(false), 400);
    return () => clearTimeout(t);
  }, [waiting]);
  return (
    <div className="relative" data-testid={`oracle-veil-${panelId}`} data-waiting={waiting ? 'true' : 'false'} aria-busy={waiting}>
      {shown ? (
        <LoadingVeil testId={`oracle-veil-note-${panelId}`} leaving={!waiting}>
          {children}
        </LoadingVeil>
      ) : (
        children
      )}
    </div>
  );
}
