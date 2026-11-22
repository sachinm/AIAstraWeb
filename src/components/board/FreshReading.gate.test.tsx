/**
 * The fresh-reading control under the reading gate (server prep gate): locked, it is always drawn (even before any first
 * reading), disabled, "Building your chart data" with the server's line and "· n of m"; blocked says the retry
 * sentence; open or absent, it is exactly as before.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FreshControl } from './FreshReading';
import { PIPELINE_WORDS, pipelineLine } from './words';
import type { PipelineView } from '../../lib/pipelineStatus';
import type { SelfV2Refresh } from '../../lib/boardTypes';

const LOCKED: PipelineView = { stage: 'preparing', done: 3, total: 7, line: 'Preparing Work', locked: true, reason: 'preparing' };
const NEVER: SelfV2Refresh = { madeAt: null, validUntil: null, due: false };
const DUE: SelfV2Refresh = { madeAt: '2026-10-20T09:00:00Z', validUntil: '2026-11-08', due: true };

function show(refresh: SelfV2Refresh | undefined, pipeline: PipelineView | null | undefined, onAsk = vi.fn()) {
  render(<FreshControl refresh={refresh} plan={null} building={false} noQuestions={false} failed={false} onAsk={onAsk} pipeline={pipeline} />);
  return onAsk;
}

afterEach(cleanup);

describe('FreshControl and the reading gate', () => {
  it('locked with no reading ever made (and no refresh block at all): drawn, disabled, with the line', () => {
    for (const refresh of [NEVER, undefined]) {
      const onAsk = show(refresh, LOCKED);
      const b = screen.getByTestId('fresh-button');
      expect(b).toBeDisabled();
      expect(b).toHaveAttribute('aria-disabled', 'true');
      expect(b).toHaveTextContent('Building your chart data');
      expect(screen.getByTestId('fresh-locked-line').textContent).toBe('Preparing Work · 3 of 7');
      expect(screen.getByTestId('fresh-locked-line')).toHaveAttribute('aria-live', 'polite');
      fireEvent.click(b);
      fireEvent.keyDown(b, { key: 'Enter' });
      expect(onAsk).not.toHaveBeenCalled();
      cleanup();
    }
  });

  it('locked over a due reading: still the locked control', () => {
    show(DUE, LOCKED);
    expect(screen.getByTestId('fresh-button')).toHaveAttribute('data-state', 'locked');
  });

  it('blocked: the retry sentence', () => {
    show(DUE, { ...LOCKED, stage: 'blocked' });
    expect(screen.getByTestId('fresh-locked-line')).toHaveTextContent(PIPELINE_WORDS.blocked);
  });

  it('no count when the server gives none', () => {
    expect(pipelineLine({ ...LOCKED, total: 0 })).toBe('Preparing Work');
    expect(pipelineLine({ ...LOCKED, line: '', total: 0 })).toBe('');
  });

  it('open or absent: exactly as before', () => {
    for (const p of [null, undefined, { ...LOCKED, locked: false, stage: 'ready' as const }]) {
      show(NEVER, p);
      expect(screen.queryByTestId('fresh-reading')).toBeNull();
      cleanup();
      const onAsk = show(DUE, p);
      const b = screen.getByTestId('fresh-button');
      expect(b).toBeEnabled();
      expect(b).toHaveAttribute('data-state', 'due');
      fireEvent.click(b);
      expect(onAsk).toHaveBeenCalledTimes(1);
      cleanup();
    }
  });
});
