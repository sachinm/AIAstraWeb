import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoadingVeil, { PIECES, shufflePieces } from './LoadingVeil';
import { LOADING_QUIPS } from '../lib/loadingQuips';
import { LINE_MS } from '../pages/chat-interface/ReadingStagesPanel';
import * as art from '../lib/overlayArt';

beforeEach(() => {
  vi.useFakeTimers();
  document.documentElement.classList.remove('light');
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('LoadingVeil', () => {
  it('shows one of the quips and moves to the next after LINE_MS', () => {
    vi.spyOn(art, 'getOverlayArt').mockResolvedValue(null);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    render(<LoadingVeil testId="veil" note="Your chart is still being prepared." />);
    const line = screen.getByTestId('veil-line');
    expect(line).toHaveTextContent(LOADING_QUIPS[0]!);
    expect(screen.getByTestId('veil-note')).toHaveTextContent('Your chart is still being prepared.');
    act(() => {
      vi.advanceTimersByTime(LINE_MS);
    });
    expect(line).toHaveTextContent(LOADING_QUIPS[1]!);
    expect(screen.getByTestId('veil')).toHaveAttribute('data-art', 'none');
    expect(screen.getByTestId('veil')).toHaveAttribute('data-theme', 'dark');
  });

  it('draws the skeleton beneath, the foreground on top, and fills the viewport when asked', () => {
    vi.spyOn(art, 'getOverlayArt').mockResolvedValue(null);
    render(
      <LoadingVeil fullScreen testId="veil" foreground={<button type="button">Retry</button>}>
        <div data-testid="skeleton" />
      </LoadingVeil>
    );
    expect(screen.getByTestId('veil').className).toContain('load-veil--fixed');
    expect(screen.getByTestId('skeleton').parentElement).toHaveClass('load-veil__under');
    expect(screen.getByRole('button', { name: 'Retry' }).parentElement).toHaveClass('load-veil__front');
    expect(screen.getByTestId('veil').querySelector('.load-veil__bottom')).toContainElement(screen.getByRole('button', { name: 'Retry' }));
  });

  it('puts the brand and the quip above the chart, the note below, and all 21 pieces beside it in a shuffled order', () => {
    vi.spyOn(art, 'getOverlayArt').mockResolvedValue(null);
    render(<LoadingVeil testId="veil" note="Your chart is still being prepared." />);
    const veil = screen.getByTestId('veil');
    const top = veil.querySelector('.load-veil__top')!;
    expect(top).toContainElement(screen.getByTestId('veil-brand'));
    expect(top).toContainElement(screen.getByTestId('veil-line'));
    expect(screen.getByTestId('veil-brand')).toHaveTextContent('AdAstra AI');
    expect(veil.querySelector('.load-veil__bottom')).toContainElement(screen.getByTestId('veil-note'));
    expect(screen.getByTestId('veil-stage')).not.toHaveTextContent(/[a-z]{3}/i);
    expect(veil.querySelectorAll('.load-veil__tile')).toHaveLength(PIECES.length);
    expect(veil.querySelectorAll('.load-veil__col')).toHaveLength(4);
    // no key, no decrypted art: an empty glass slab holds the place, and no chart is in the page
    expect(screen.getByTestId('veil-slab')).toBeInTheDocument();
    expect(screen.queryByTestId('veil-chart')).toBeNull();
    expect(veil.innerHTML).not.toContain('>12</text>');
  });

  it('shuffles the pieces into four columns that hold every graha and rashi once', () => {
    const cols = shufflePieces(() => 0.3);
    expect(cols).toHaveLength(4);
    const names = cols.flat().map((p) => p.name).sort();
    expect(names).toEqual(PIECES.map((p) => p.name).sort());
    expect(PIECES.filter((p) => p.kind === 'graha')).toHaveLength(9);
    expect(PIECES.filter((p) => p.kind === 'rashi')).toHaveLength(12);
  });

  it('shows the illustration for the current theme once it decrypts, and revokes it on unmount', async () => {
    document.documentElement.classList.add('light');
    const get = vi.spyOn(art, 'getOverlayArt').mockResolvedValue(new Blob(['<svg/>'], { type: 'image/svg+xml' }));
    const create = vi.fn(() => 'blob:art');
    const revoke = vi.fn();
    vi.stubGlobal('URL', Object.assign(Object.create(URL), { createObjectURL: create, revokeObjectURL: revoke }));
    const { unmount } = render(<LoadingVeil testId="veil" />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(get).toHaveBeenCalledWith(expect.stringMatching(/^(south|north)$/), 'light');
    // painted onto a canvas, never an <img> anyone can save
    expect(screen.getByTestId('veil-chart').tagName).toBe('CANVAS');
    expect(screen.getByTestId('veil').querySelector('img')).toBeNull();
    expect(screen.getByTestId('veil').getAttribute('data-art')).toMatch(/^(south|north)$/);
    unmount();
    expect(revoke).toHaveBeenCalledWith('blob:art');
    vi.unstubAllGlobals();
  });
});
