import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { ACROSS_KEY, deckPerView, perViewForWidth, readAcross, useDeckWidth, writeAcross } from './useDeckWidth';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('perViewForWidth (server docs/dashboards/13 §4.3 table)', () => {
  it.each([
    [664, 1], // iPad portrait
    [808, 1], // Surface portrait
    [972, 2], // iPad landscape
    [1160, 2], // Surface landscape
    [1232, 2], // 1440
    [1708, 3], // 1920
    [2352, 4], // 2560
  ])('a %i px deck shows %i Seasons cards', (w, n) => {
    expect(perViewForWidth(w)).toBe(n);
  });

  it('never goes below one or above four', () => {
    expect(perViewForWidth(0)).toBe(1);
    expect(perViewForWidth(300)).toBe(1);
    expect(perViewForWidth(5000)).toBe(4);
  });
});

describe('deckPerView', () => {
  const base = { phone: false, seasons: true, across: 'auto' as const, width: 1708, fallback: 2 };
  it('Seasons follows the measured deck on Auto', () => expect(deckPerView(base)).toBe(3));
  it('falls back to the window rule before the first measure (width 0)', () => expect(deckPerView({ ...base, width: 0 })).toBe(2));
  it('a phone always keeps its own rule', () => expect(deckPerView({ ...base, phone: true, fallback: 1, across: '3' })).toBe(1));
  it('Compact keeps its own rule', () => expect(deckPerView({ ...base, seasons: false, fallback: 4 })).toBe(4));
  it('the gear\'s number wins over the width', () => expect(deckPerView({ ...base, across: '2' })).toBe(2));
});

describe('the "Cards across" choice', () => {
  it('defaults to Auto and is kept per device', () => {
    expect(readAcross()).toBe('auto');
    writeAcross('3');
    expect(localStorage.getItem(ACROSS_KEY)).toBe('3');
    expect(readAcross()).toBe('3');
    writeAcross('auto');
    expect(localStorage.getItem(ACROSS_KEY)).toBeNull();
  });

  it('a stored value it does not know reads as Auto, and blocked storage never throws', () => {
    localStorage.setItem(ACROSS_KEY, '9');
    expect(readAcross()).toBe('auto');
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readAcross()).toBe('auto');
    expect(() => writeAcross('2')).not.toThrow();
    get.mockRestore();
    set.mockRestore();
  });
});

function Probe() {
  const [ref, width] = useDeckWidth();
  return (
    <div ref={ref} data-testid="deck" data-width={width}>
      {width}
    </div>
  );
}

describe('useDeckWidth', () => {
  it('is 0 where ResizeObserver is missing (jsdom)', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    render(<Probe />);
    expect(screen.getByTestId('deck')).toHaveAttribute('data-width', '0');
  });

  it('follows the observer as the deck changes width', () => {
    let fire: ((w: number) => void) | null = null;
    class RO {
      constructor(cb: (e: Array<{ contentRect: { width: number } }>) => void) {
        fire = (w) => cb([{ contentRect: { width: w } }]);
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', RO);
    render(<Probe />);
    act(() => fire!(1708));
    expect(screen.getByTestId('deck')).toHaveAttribute('data-width', '1708');
    act(() => fire!(972));
    expect(screen.getByTestId('deck')).toHaveAttribute('data-width', '972');
  });
});
