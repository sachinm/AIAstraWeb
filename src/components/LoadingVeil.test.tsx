import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoadingVeil, { PIECES, VEIL_PROGRESS_AFTER_MS, VEIL_PROGRESS_TICK_MS, easedPercent, resetVeilHandoffForTests, shufflePieces, type VeilProgress } from './LoadingVeil';
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

  it('renders a full-screen veil on <body>, outside any page container that could trap it', () => {
    vi.spyOn(art, 'getOverlayArt').mockResolvedValue(null);
    render(
      <div style={{ backdropFilter: 'blur(6px)' }} data-testid="panel">
        <LoadingVeil fullScreen testId="veil" />
      </div>
    );
    expect(screen.getByTestId('veil').parentElement).toBe(document.body);
    expect(screen.getByTestId('panel')).not.toContainElement(screen.getByTestId('veil'));
  });

  it('a full-screen veil that follows another at once keeps its line, chart and pieces, with no entrance', () => {
    resetVeilHandoffForTests();
    vi.spyOn(art, 'getOverlayArt').mockResolvedValue(null);
    const first = render(<LoadingVeil fullScreen testId="a" />);
    const line = screen.getByTestId('a-line').textContent;
    const chart = screen.getByTestId('a').getAttribute('data-chart');
    const pieces = [...screen.getByTestId('a').querySelectorAll('.load-veil__tile')].map((t) => t.getAttribute('title'));
    first.unmount();
    render(<LoadingVeil fullScreen testId="b" />);
    expect(screen.getByTestId('b-line').textContent).toBe(line);
    expect(screen.getByTestId('b').getAttribute('data-chart')).toBe(chart);
    expect([...screen.getByTestId('b').querySelectorAll('.load-veil__tile')].map((t) => t.getAttribute('title'))).toEqual(pieces);
    expect(screen.getByTestId('b').className).not.toContain('load-veil--animate');
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

describe('LoadingVeil progress', () => {
  const stage = (over: Partial<VeilProgress> = {}): VeilProgress => ({
    percent: 20,
    nextPercent: 35,
    stageExpectedMs: 10_000,
    stageAt: new Date(Date.now()).toISOString(),
    label: 'Sorting what matters now',
    step: 2,
    steps: 7,
    ...over,
  });
  const now = () => Number(screen.getByTestId('veil-progress').getAttribute('aria-valuenow'));

  it('shows no bar for the first 5 s, then a bar between this stage and the next with the step in words', () => {
    vi.spyOn(art, 'getOverlayArt').mockResolvedValue(null);
    render(<LoadingVeil testId="veil" progress={stage()} />);
    expect(screen.queryByTestId('veil-progress')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(VEIL_PROGRESS_AFTER_MS + 1000);
    });
    const bar = screen.getByTestId('veil-progress');
    expect(bar).toHaveAttribute('role', 'progressbar');
    expect(now()).toBeGreaterThan(20);
    expect(now()).toBeLessThan(35);
    expect(screen.getByTestId('veil-progress-label')).toHaveTextContent('Sorting what matters now · Step 2 of 7');
    // sits under the brand line, above the quip
    const top = screen.getByTestId('veil').querySelector('.load-veil__top')!;
    expect(top).toContainElement(bar);
  });

  it('never goes back when a later answer has the same stage, and never reaches the next floor', () => {
    vi.spyOn(art, 'getOverlayArt').mockResolvedValue(null);
    const { rerender } = render(<LoadingVeil testId="veil" progress={stage()} />);
    act(() => {
      vi.advanceTimersByTime(9000);
    });
    const before = now();
    expect(before).toBeGreaterThan(20);
    // the same stage again, stamped later (its eased share would restart from 0)
    rerender(<LoadingVeil testId="veil" progress={stage({ stageAt: new Date(Date.now()).toISOString() })} />);
    act(() => {
      vi.advanceTimersByTime(VEIL_PROGRESS_TICK_MS);
    });
    expect(now()).toBeGreaterThanOrEqual(before);
    act(() => {
      vi.advanceTimersByTime(10 * 60_000);
    });
    expect(now()).toBeLessThan(35);
  });

  it('easedPercent: the floor without timing, at most 90% of the way, never past the next floor', () => {
    const at = Date.parse('2026-11-09T10:00:00Z');
    const p = { percent: 40, nextPercent: 70, stageExpectedMs: 20_000, stageAt: new Date(at).toISOString() };
    expect(easedPercent({ ...p, stageExpectedMs: null }, at + 60_000)).toBe(40);
    expect(easedPercent({ ...p, stageAt: null }, at + 60_000)).toBe(40);
    expect(easedPercent(p, at - 5000)).toBe(40);
    const mid = easedPercent(p, at + 10_000);
    expect(mid).toBeGreaterThan(40);
    expect(mid).toBeLessThan(easedPercent(p, at + 20_000));
    expect(easedPercent(p, at + 1e9)).toBeCloseTo(67, 5);
    expect(easedPercent({ ...p, percent: 100, nextPercent: 100 }, at)).toBe(100);
  });
});
