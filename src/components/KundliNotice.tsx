import { useMe } from '../Auth/ProfileGate';
import { READY_NOTICE } from '../Auth/readyNotice';

/** Shown on the dashboard and chat until the chart is ready (me.kundli_status === 'ready'). */
export default function KundliNotice() {
  const me = useMe();
  if (!me || me.kundli_status === 'ready') return null;
  return (
    <div role="status" className="mx-4 mt-3 rounded-lg border border-purple-400/30 bg-purple-500/15 px-4 py-3 text-sm text-purple-100">
      {READY_NOTICE}
    </div>
  );
}
