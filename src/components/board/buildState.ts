/**
 * The board's build as the server reports it (server docs/loading-overlay/05): when to poll, how long to wait, and the
 * veil's bar. Moved here unchanged from the v2 Self board when the v2 Self reading was retired.
 */
import type { VeilProgress } from '../LoadingVeil';
import type { SelfV2BuildView } from '../../lib/boardTypes';
import { BUILD_STAGE_WORDS } from './words';

/**
 * pending (the board being written) and a clock rebuild: every 10 s; preparing (the chart): every 30 s; a build the
 * server says is queued or running (`board.build`, server docs/loading-overlay/05): every 2 s, so the bar moves
 */
export const V2_POLL_MS = { pending: 10_000, preparing: 30_000, build: 2_000 } as const;
/** after this long waiting the board says so and offers Retry */
export const V2_MAX_WAIT_MS = 6 * 60_000;

/** The server says a build is queued or running now. */
export function buildActive(build: SelfV2BuildView | undefined): boolean {
  return build?.state === 'queued' || build?.state === 'running';
}

/** The server says the build failed or stalled: the page stops polling and the header offers Try again. */
export function buildStopped(build: SelfV2BuildView | undefined): boolean {
  return build?.state === 'failed' || build?.state === 'stuck';
}

/** The veil's bar from the server's build, while one is queued or running; undefined otherwise (no bar). */
export function veilProgress(build: SelfV2BuildView | undefined): VeilProgress | undefined {
  if (!build || !buildActive(build)) return undefined;
  const label = build.state === 'queued' || !build.stage ? BUILD_STAGE_WORDS.queued : BUILD_STAGE_WORDS[build.stage];
  return {
    percent: build.percent,
    nextPercent: build.nextPercent,
    stageExpectedMs: build.stageExpectedMs,
    stageAt: build.stageAt,
    label,
    step: build.state === 'running' ? build.step : 0,
    steps: build.steps,
  };
}
