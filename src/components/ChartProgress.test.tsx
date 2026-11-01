import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ChartProgress from './ChartProgress';
import { isChartOpen, retryChartBuild, type ChartStatus, type Me } from '../Auth/api';

vi.mock('../Auth/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../Auth/api')>()),
  retryChartBuild: vi.fn(),
}));

const chart = (over: Partial<ChartStatus> = {}): ChartStatus => ({
  status: 'building',
  stage: 'gate',
  gate_done: 7,
  gate_total: 24,
  rest_done: 0,
  rest_total: 89,
  facts_status: 'pending',
  reading_mode: 'legacy',
  last_error: null,
  ...over,
});

afterEach(() => vi.clearAllMocks());

describe('ChartProgress', () => {
  it('shows the count while the first part builds', () => {
    render(<ChartProgress chart={chart()} />);
    expect(screen.getByText('Calculating your birth chart…')).toBeInTheDocument();
    expect(screen.getByText('7 of 24')).toBeInTheDocument();
  });

  it('names the stage after the first part, with no count', () => {
    render(<ChartProgress chart={chart({ stage: 'facts' })} />);
    expect(screen.getByText('Putting your reading together…')).toBeInTheDocument();
    expect(screen.queryByText(/of 24/)).not.toBeInTheDocument();
  });

  it('offers Retry on failure and passes on the new state', async () => {
    const next = chart({ status: 'pending', stage: null });
    vi.mocked(retryChartBuild).mockResolvedValue(next);
    const onUpdated = vi.fn();
    render(<ChartProgress chart={chart({ status: 'failed', stage: null, last_error: 'Some of the calculations did not finish.' })} onUpdated={onUpdated} />);
    expect(screen.getByText('Some of the calculations did not finish.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(next));
  });

  it('says so when Retry itself fails', async () => {
    vi.mocked(retryChartBuild).mockResolvedValue(null);
    render(<ChartProgress chart={chart({ status: 'failed', stage: null })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText(/didn’t go through/)).toBeInTheDocument();
  });
});

describe('isChartOpen', () => {
  const me = (over: Partial<Me>): Me => ({ profile_complete: true, email_verified: true, kundli_status: 'building', ...over });

  it('follows the build state, and opens chat before the whole chart is done', () => {
    expect(isChartOpen(me({ chart: chart({ status: 'chat_ready', stage: 'rest' }) }))).toBe(true);
    expect(isChartOpen(me({ chart: chart({ status: 'ready', stage: null }) }))).toBe(true);
    expect(isChartOpen(me({ chart: chart() }))).toBe(false);
    expect(isChartOpen(me({ chart: chart({ status: 'failed', stage: null }) }))).toBe(false);
  });

  it('falls back to kundli_status when the build state is missing', () => {
    expect(isChartOpen(me({ kundli_status: 'ready' }))).toBe(true);
    expect(isChartOpen(me({ kundli_status: 'pending', chart: null }))).toBe(false);
  });
});
