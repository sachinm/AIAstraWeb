/**
 * The reading gate (server prep gate): while a new person's chart is still being built and prepared, no reading may be
 * started on any board. The server says where the build stands in a `pipeline` block on the board GETs
 * (`GET /api/self/v2`, `GET /api/self/v3`, `GET /api/board/:board/v3`) and refuses a reading started too early with
 * HTTP 409 `{ error, code: 'preparing', pipeline }`. Absent on an older server: read as not locked.
 *
 * The block is the server's; the page only shows it. Every control that starts a reading is disabled while
 * `pipeline.locked` and says "Building your chart data" with the server's line under it.
 */

export type PipelineStage = 'registered' | 'pulling' | 'checking' | 'chart_ready' | 'preparing' | 'ready' | 'blocked' | 'paused';

export interface PipelineView {
  stage: PipelineStage;
  done: number;
  total: number;
  /** one plain sentence from the server, e.g. "Getting your chart", "Preparing Love" */
  line: string;
  /** true: no reading may be started */
  locked: boolean;
  reason: 'chart' | 'building' | 'preparing' | null;
}

/** while locked, the board is read again this often (the board's overall wait cap still applies) */
export const PIPELINE_POLL_MS = 5_000;

const STAGES = new Set<PipelineStage>(['registered', 'pulling', 'checking', 'chart_ready', 'preparing', 'ready', 'blocked', 'paused']);

/** a `pipeline` block as the page reads it; null when absent or not a block */
export function readPipeline(raw: unknown): PipelineView | null {
  const p = raw as Partial<PipelineView> | null | undefined;
  if (!p || typeof p !== 'object' || typeof p.locked !== 'boolean') return null;
  const num = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0);
  const reason = p.reason === 'chart' || p.reason === 'building' || p.reason === 'preparing' ? p.reason : null;
  return {
    stage: typeof p.stage === 'string' && STAGES.has(p.stage) ? p.stage : 'preparing',
    done: num(p.done),
    total: num(p.total),
    line: typeof p.line === 'string' ? p.line : '',
    locked: p.locked,
    reason,
  };
}

/** true when the block says no reading may be started */
export function pipelineLocked(p: PipelineView | null | undefined): boolean {
  return !!p?.locked;
}

/**
 * A refused start (HTTP 409 `code: 'preparing'`): the pipeline it carries, or a locked stand-in when the body has none.
 * Null for any other answer.
 */
export function refusedPipeline(status: number, body: unknown): PipelineView | null {
  const j = body as { code?: unknown; error?: unknown; pipeline?: unknown } | null;
  if (status !== 409 || !j || (j.code !== 'preparing' && j.error !== 'preparing')) return null;
  return readPipeline(j.pipeline) ?? { stage: 'preparing', done: 0, total: 0, line: '', locked: true, reason: 'preparing' };
}

export const PIPELINE_EVENT = 'aiastra:pipeline';

/** tell the page a start was refused because the chart is still being prepared */
export function announcePipeline(p: PipelineView): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<PipelineView>(PIPELINE_EVENT, { detail: p }));
}

/** calls `apply` with each refused start's pipeline; returns the unsubscribe */
export function onPipelineAnnounced(apply: (p: PipelineView) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const h = (e: Event) => {
    const p = readPipeline((e as CustomEvent<PipelineView>).detail);
    if (p) apply(p);
  };
  window.addEventListener(PIPELINE_EVENT, h);
  return () => window.removeEventListener(PIPELINE_EVENT, h);
}
