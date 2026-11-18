/**
 * The Self board v3 at /dashboard/you: the one v3 board (pages/board/v3/BoardV3.tsx, server docs/dashboards/10 W2) on
 * Self. Its helpers are re-exported here for the callers and tests that import them from this file.
 */
import BoardV3 from '../../board/v3/BoardV3';

export { PEEK_PX, READING_POLL_MS, SEASONS_GAP, perViewFor, readingLine, readingPending, signInHref } from '../../board/v3/BoardV3';

export default function SelfBoardV3() {
  return <BoardV3 board="self" />;
}
