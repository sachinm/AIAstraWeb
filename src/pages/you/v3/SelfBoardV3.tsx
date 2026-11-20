/**
 * The Self board v3 at /dashboard/you: the one v3 board (pages/board/v3/BoardV3.tsx, server docs/dashboards/10 W2) on
 * Self. Its helpers are re-exported here for the callers and tests that import them from this file.
 */
import type { ReactNode } from 'react';
import BoardV3 from '../../board/v3/BoardV3';

export { PEEK_PX, READING_POLL_MS, SEASONS_GAP, perViewFor, readingLine, readingPending, signInHref } from '../../board/v3/BoardV3';

/** `legacy`: what shows when the server has v3 off (the route, pages/you/YouPage, passes the legacy You page) */
export default function SelfBoardV3({ legacy = null }: { legacy?: ReactNode }) {
  return <BoardV3 board="self" legacy={legacy} />;
}
