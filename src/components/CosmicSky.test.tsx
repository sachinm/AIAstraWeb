import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CosmicSky from './CosmicSky';

const scenes = (c: HTMLElement) => [...c.querySelectorAll('[data-scene]')].map((l) => l.getAttribute('data-scene'));

describe('CosmicSky timing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'Image',
      class {
        src = '';
        decode = () => Promise.resolve();
      }
    );
    // what a Windows PC with animation effects off reports; the scenes must still change there
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('starts on a random scene, not always the same one', () => {
    const seen = new Set<string | null>();
    for (let i = 0; i < 40; i++) {
      const { container, unmount } = render(<CosmicSky />);
      seen.add(scenes(container)[0]);
      unmount();
    }
    expect(seen.size).toBeGreaterThan(5);
  });

  it('holds a scene for 120 seconds, then changes, with reduced motion on', async () => {
    const { container } = render(<CosmicSky />);
    const start = scenes(container)[0];
    await act(() => vi.advanceTimersByTimeAsync(119_000));
    expect(scenes(container)).toEqual([start]);
    await act(() => vi.advanceTimersByTimeAsync(1_500));
    const during = scenes(container);
    expect(during).toHaveLength(2);
    expect(during[0]).toBe(start);
    await act(() => vi.advanceTimersByTimeAsync(3_000));
    const after = scenes(container);
    expect(after).toHaveLength(1);
    expect(after[0]).not.toBe(start);
  });
});
