import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { retryChartBuild, type ChartStatus } from '../Auth/api';

interface Props {
  chart: ChartStatus;
  /** Called with the new state after Retry, so the page shows it without waiting for the next poll. */
  onUpdated?: (chart: ChartStatus) => void;
}

function titleFor(chart: ChartStatus): string {
  if (chart.status === 'failed') return 'We couldn’t finish your chart';
  if (chart.stage === 'facts') return 'Putting your reading together…';
  if (chart.stage === 'gate') return 'Calculating your birth chart…';
  return 'Preparing your chart…';
}

/** What a page shows while the chart is being built, from the state the server reports. */
export default function ChartProgress({ chart, onUpdated }: Props) {
  const [retrying, setRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);

  const retry = async () => {
    setRetrying(true);
    setRetryFailed(false);
    const next = await retryChartBuild();
    setRetrying(false);
    if (next) onUpdated?.(next);
    else setRetryFailed(true);
  };

  if (chart.status === 'failed') {
    return (
      <div data-test-id="chart-progress">
        <h3 className="text-xl font-semibold text-white mb-2">{titleFor(chart)}</h3>
        {chart.last_error && <p className="text-sm text-gray-300 leading-relaxed mb-4">{chart.last_error}</p>}
        {retryFailed && <p className="text-sm text-red-300 mb-4">That didn’t go through. Please try again.</p>}
        <button
          type="button"
          onClick={() => void retry()}
          disabled={retrying}
          className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-60"
        >
          {retrying ? 'Retrying…' : 'Retry'}
        </button>
      </div>
    );
  }

  const showCount = chart.stage === 'gate' && chart.gate_total > 0;
  const percent = showCount ? Math.min(100, Math.round((chart.gate_done / chart.gate_total) * 100)) : 0;
  return (
    <div data-test-id="chart-progress">
      <Loader2 className="h-9 w-9 text-purple-400 animate-spin mx-auto mb-4" aria-hidden="true" />
      <h3 className="text-xl font-semibold text-white mb-2">{titleFor(chart)}</h3>
      {showCount && (
        <>
          <div className="mx-auto mb-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-purple-400 transition-all" style={{ width: `${percent}%` }} />
          </div>
          <p className="text-xs font-medium text-purple-300 mb-2">
            {chart.gate_done} of {chart.gate_total}
          </p>
        </>
      )}
      <p className="text-sm text-gray-300 leading-relaxed">You can leave this page. We’ll keep working, and chat opens as soon as your chart is ready.</p>
    </div>
  );
}
