import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ReadingStamp } from './ReadingStamp';
import { onUsage } from '../lib/planUsage';

const MADE = '2026-11-09T08:30:00.000Z';
const show = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);
afterEach(() => vi.unstubAllGlobals());

describe('ReadingStamp (server docs/billing/02 §10, 03)', () => {
  it('shows when the reading was made, the last day it holds, and that reopening is free', () => {
    show(<ReadingStamp madeAt={MADE} validUntil="2026-12-03" />);
    expect(screen.getByTestId('reading-stamp').textContent).toBe('Made 9 Nov 2026 · Good until 3 Dec 2026 · Opening it again before then uses no question');
  });

  it('a reading with no end says only when it was made; no date from the server shows nothing', () => {
    const { rerender } = show(<ReadingStamp madeAt={MADE} validUntil={null} />);
    expect(screen.getByTestId('reading-stamp').textContent).toBe('Made 9 Nov 2026 · Opening it again uses no question');
    rerender(<MemoryRouter><ReadingStamp madeAt={null} validUntil="2026-12-03" /></MemoryRouter>);
    expect(screen.queryByTestId('reading-stamp')).toBeNull();
  });

  it('before it is due, the fresh reading is shown as later and cannot be asked for', () => {
    show(<ReadingStamp madeAt={MADE} validUntil="2026-12-03" board="love" refreshDue={false} />);
    expect(screen.getByTestId('refresh-later')).toHaveTextContent('Fresh reading after 3 Dec 2026');
    expect(screen.queryByTestId('refresh-button')).toBeNull();
  });

  it('once due, one tap asks for it, moves the count and reloads the board', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push(`${init.method} ${url}`);
      return new Response(JSON.stringify({ status: 'ok', usage: { used: 4, limit: 20, remaining: 16 } }), { status: 200 });
    }));
    const seen: unknown[] = [];
    const off = onUsage((u) => seen.push(u.used));
    const onRefreshed = vi.fn();
    show(<ReadingStamp madeAt={MADE} validUntil="2026-11-03" board="work" refreshDue onRefreshed={onRefreshed} />);
    expect(screen.getByTestId('reading-stamp')).not.toHaveTextContent('uses no question');
    fireEvent.click(screen.getByTestId('refresh-button'));
    await waitFor(() => expect(onRefreshed).toHaveBeenCalledTimes(1));
    off();
    expect(calls).toEqual([expect.stringMatching(/^POST .*\/api\/boards\/work\/refresh$/)]);
    expect(seen).toEqual([4]);
  });

  it('with no questions left the old reading stays and Upgrade is offered; a failure can be tried again', async () => {
    let status = 402;
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(status === 402 ? { code: 'quota_exhausted', usage: { used: 20, limit: 20, remaining: 0 } } : { error: 'x' }), { status })));
    const { unmount } = show(<ReadingStamp madeAt={MADE} validUntil="2026-11-03" board="self" refreshDue />);
    fireEvent.click(screen.getByTestId('refresh-button'));
    expect(await screen.findByTestId('refresh-no-questions')).toHaveTextContent('No questions left · Upgrade');
    unmount();
    status = 500;
    show(<ReadingStamp madeAt={MADE} validUntil="2026-11-03" board="self" refreshDue />);
    fireEvent.click(screen.getByTestId('refresh-button'));
    await waitFor(() => expect(screen.getByTestId('refresh-button')).toHaveTextContent('That did not work. Try again'));
  });
});
