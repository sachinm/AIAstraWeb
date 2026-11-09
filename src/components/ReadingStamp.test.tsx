import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReadingStamp } from './ReadingStamp';

describe('ReadingStamp (server docs/billing/02 §10)', () => {
  it('shows when the reading was made, the last day it holds, and that reopening is free', () => {
    render(<ReadingStamp madeAt="2026-11-09T08:30:00.000Z" validUntil="2026-12-03" />);
    expect(screen.getByTestId('reading-stamp').textContent).toBe('Made 9 Nov 2026 · Good until 3 Dec 2026 · Opening it again before then uses no question');
  });

  it('a reading with no end says only when it was made; no date from the server shows nothing', () => {
    const { rerender } = render(<ReadingStamp madeAt="2026-11-09T08:30:00.000Z" validUntil={null} />);
    expect(screen.getByTestId('reading-stamp').textContent).toBe('Made 9 Nov 2026 · Opening it again uses no question');
    rerender(<ReadingStamp madeAt={null} validUntil="2026-12-03" />);
    expect(screen.queryByTestId('reading-stamp')).toBeNull();
  });
});
