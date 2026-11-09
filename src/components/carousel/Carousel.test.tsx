import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { useState } from 'react';
import Carousel, { CarouselArrows, CarouselDots, startFor } from './Carousel';
import Chips, { useSeenCounts } from './Chips';

function Harness({ count = 6, perView = 3 }: { count?: number; perView?: number }) {
  const [i, setI] = useState(0);
  return (
    <>
      <CarouselArrows index={i} count={count} onIndexChange={setI} />
      <CarouselDots index={i} count={count} onIndexChange={setI} />
      <Carousel count={count} index={i} onIndexChange={setI} perView={perView} label="Cards" renderSlide={(n) => <button type="button">card {n}</button>} />
    </>
  );
}

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('Carousel', () => {
  it('is a labelled carousel region of slides', () => {
    render(<Harness />);
    const region = screen.getByRole('region', { name: 'Cards' });
    expect(region).toHaveAttribute('aria-roledescription', 'carousel');
    const slides = within(region).getAllByRole('group');
    expect(slides).toHaveLength(6);
    expect(slides[0]).toHaveAttribute('aria-roledescription', 'slide');
  });

  it('arrows, dots and keys move one card; Home and End jump', () => {
    render(<Harness />);
    const region = screen.getByTestId('carousel');
    fireEvent.click(screen.getByTestId('carousel-next'));
    expect(region).toHaveAttribute('data-index', '1');
    fireEvent.keyDown(region, { key: 'ArrowRight' });
    expect(region).toHaveAttribute('data-index', '2');
    fireEvent.keyDown(region, { key: 'ArrowLeft' });
    expect(region).toHaveAttribute('data-index', '1');
    fireEvent.keyDown(region, { key: 'End' });
    expect(region).toHaveAttribute('data-index', '5');
    expect(screen.getByTestId('carousel-next')).toBeDisabled();
    fireEvent.keyDown(region, { key: 'Home' });
    expect(region).toHaveAttribute('data-index', '0');
    fireEvent.click(within(screen.getByTestId('carousel-dots')).getAllByRole('button')[4]!);
    expect(region).toHaveAttribute('data-index', '4');
  });

  it('a mouse drag moves one card', () => {
    // jsdom has no PointerEvent: a MouseEvent with pointerType stands in
    if (typeof window.PointerEvent === 'undefined') {
      class PE extends MouseEvent {
        pointerType: string;
        constructor(type: string, init: MouseEventInit & { pointerType?: string } = {}) {
          super(type, init);
          this.pointerType = init.pointerType ?? 'mouse';
        }
      }
      vi.stubGlobal('PointerEvent', PE);
    }
    render(<Harness />);
    const track = screen.getByTestId('carousel-track');
    fireEvent.pointerDown(track, { pointerType: 'mouse', clientX: 300 });
    fireEvent.pointerUp(track, { pointerType: 'mouse', clientX: 200 });
    expect(screen.getByTestId('carousel')).toHaveAttribute('data-index', '1');
  });

  it('dims the rightmost visible card as the peek, and focus on a hidden card brings it on screen', () => {
    render(<Harness />);
    const slides = within(screen.getByTestId('carousel-track')).getAllByRole('group');
    expect(slides.map((s) => s.getAttribute('data-peek'))).toEqual(['false', 'false', 'true', 'false', 'false', 'false']);
    act(() => within(slides[5]!).getByRole('button').focus());
    expect(screen.getByTestId('carousel')).toHaveAttribute('data-index', '5');
  });

  it('the first card on screen never passes the end', () => {
    expect(startFor(0, 12, 3)).toBe(0);
    expect(startFor(5, 12, 3)).toBe(5);
    expect(startFor(11, 12, 3)).toBe(9);
    expect(startFor(2, 2, 3)).toBe(0);
  });
});

describe('Chips', () => {
  const groups = [
    { id: 'now', label: 'Now', items: [{ id: 'a', label: 'A', count: 2 }, { id: 'b', label: 'B' }] },
    { id: 'you', label: 'You', items: [{ id: 'c', label: 'C' }] },
  ];

  it('groups chips under their labels with the red count', () => {
    let picked = '';
    render(<Chips groups={groups} activeId="a" onSelect={(id) => (picked = id)} />);
    expect(screen.getByTestId('chips-label-now')).toHaveTextContent('Now');
    expect(screen.getByTestId('chips-a')).toHaveAttribute('aria-selected', 'true');
    expect(within(screen.getByTestId('chips-a')).getByTestId('chip-count')).toHaveTextContent('2');
    fireEvent.click(screen.getByTestId('chips-c'));
    expect(picked).toBe('c');
  });

  it('compact: group names with the active card, a tap opens the group', () => {
    render(<Chips groups={groups} activeId="b" onSelect={() => {}} compact />);
    expect(screen.getByTestId('chips-group-now')).toHaveTextContent('Now· B');
    expect(screen.queryByTestId('chips-c')).toBeNull();
    fireEvent.click(screen.getByTestId('chips-group-you'));
    expect(screen.getByTestId('chips-c')).toBeInTheDocument();
  });

  it('counts what changed since the last visit, nothing on a first visit, and clears when seen', () => {
    const first = renderHook(() => useSeenCounts('k', { a: ['h1', 'p1'], b: ['h2'] }));
    expect(first.result.current.counts).toEqual({});
    first.unmount();
    const next = renderHook(() => useSeenCounts('k', { a: ['h1-new', 'p1', 'p2'], b: ['h2'] }));
    expect(next.result.current.counts).toEqual({ a: 2 });
    act(() => next.result.current.markSeen('a'));
    expect(next.result.current.counts).toEqual({});
  });

  it('works with storage blocked', () => {
    const orig = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error('blocked');
    };
    try {
      const h = renderHook(() => useSeenCounts('k', { a: ['x'] }));
      expect(h.result.current.counts).toEqual({});
    } finally {
      Storage.prototype.getItem = orig;
    }
  });
});
