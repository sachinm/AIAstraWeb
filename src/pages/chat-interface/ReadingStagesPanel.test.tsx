import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReadingStagesPanel, { LINE_MS, ORACLE_LINES, PANEL_FOLD_MS, PANEL_HIDE_DELAY_MS } from './ReadingStagesPanel';

const queryPanel = () => document.querySelector('[data-test-id="reading-stages-panel"]');

describe('ReadingStagesPanel', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('shows one cosmic line while the reading is written, with no stage names, counts or times', () => {
    render(<ReadingStagesPanel working progress={undefined} />);
    expect(screen.getByText(ORACLE_LINES[0]!)).toBeInTheDocument();
    const text = queryPanel()!.textContent ?? '';
    expect(text).not.toMatch(/\d/);
    expect(text).not.toMatch(/stage|dasha|transit|nakshatra|cross-check|facts/i);
  });

  it('moves to the next line on a timer', () => {
    render(<ReadingStagesPanel working progress={undefined} />);
    act(() => {
      vi.advanceTimersByTime(LINE_MS);
    });
    expect(screen.getByText(ORACLE_LINES[1]!)).toBeInTheDocument();
  });

  it('says the reading is ready, then folds away', () => {
    const { rerender } = render(<ReadingStagesPanel working progress={undefined} />);
    rerender(<ReadingStagesPanel working={false} progress={undefined} />);
    expect(screen.getByText('Your reading is ready.')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(PANEL_HIDE_DELAY_MS + PANEL_FOLD_MS + 50);
    });
    expect(queryPanel()).toBeNull();
  });

  it('renders nothing for an old answer that was never being written', () => {
    render(<ReadingStagesPanel working={false} progress={undefined} />);
    expect(queryPanel()).toBeNull();
  });
});
