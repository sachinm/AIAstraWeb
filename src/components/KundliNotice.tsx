import { useMe } from '../Auth/ProfileGate';
import { READY_NOTICE } from '../Auth/readyNotice';
import type { Me } from '../Auth/api';

export const LEGACY_MODE_NOTICE = 'Detailed chart readings are still being prepared. Answers for now use your basic chart.';
export const BUILD_FAILED_NOTICE = 'We couldn’t finish your chart. Open chat to try again.';

function noticeFor(me: Me): string | null {
  const chart = me.chart;
  if (!chart) return me.kundli_status === 'ready' ? null : READY_NOTICE;
  if (chart.status === 'failed') return BUILD_FAILED_NOTICE;
  if (chart.status !== 'chat_ready' && chart.status !== 'ready') return READY_NOTICE;
  if (chart.reading_mode === 'legacy') return LEGACY_MODE_NOTICE;
  if (chart.status === 'ready') return null;
  return 'You can ask now. Your full chart is still being calculated, and answers get more detailed as it completes.';
}

/** Shown on the dashboard and chat until the full chart is ready and chat answers from it. */
export default function KundliNotice() {
  const me = useMe();
  const notice = me && noticeFor(me);
  if (!notice) return null;
  return (
    <div role="status" className="mx-4 mt-3 rounded-lg border border-purple-400/30 bg-purple-500/15 px-4 py-3 text-sm text-purple-100">
      {notice}
    </div>
  );
}
