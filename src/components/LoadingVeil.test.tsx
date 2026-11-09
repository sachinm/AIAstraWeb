import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoadingVeil from './LoadingVeil';
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
    expect(screen.getByTestId('veil').querySelector('img')).toHaveAttribute('src', 'blob:art');
    expect(screen.getByTestId('veil').getAttribute('data-art')).toMatch(/^(south|north)$/);
    unmount();
    expect(revoke).toHaveBeenCalledWith('blob:art');
    vi.unstubAllGlobals();
  });
});
