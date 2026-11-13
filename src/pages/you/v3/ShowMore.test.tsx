import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ShowMore from './ShowMore';
import { groupPeriods, hiddenCounts, periodsOf, resolveGroupsAs, showMoreLabel } from './cardModel';
import { selfV3Fixture } from './selfV3.fixture';

describe('showMoreLabel', () => {
  it('names what is waiting, from real counts only', () => {
    expect(showMoreLabel({ paragraphs: 3, windows: 0, steps: 0 })).toBe('Show more: 3 more paragraphs');
    expect(showMoreLabel({ paragraphs: 1, windows: 2, steps: 0 })).toBe('Show more: 1 more paragraph and 2 dated windows');
    expect(showMoreLabel({ paragraphs: 2, windows: 1, steps: 4 })).toBe('Show more: 2 more paragraphs, 1 dated window and 4 steps to take');
    expect(showMoreLabel({ paragraphs: 0, windows: 0, steps: 1 })).toBe('Show more: 1 step to take');
  });

  it('is counted from the card: Body & energy holds two more paragraphs, two other windows and the plan', () => {
    const card = selfV3Fixture().cards.find((c) => c.id === 'body')!;
    const periods = periodsOf(card);
    expect(hiddenCounts(periods[0]!, [], periods, 4)).toEqual({ paragraphs: 2, windows: 2, steps: 4 });
  });
});

describe('ShowMore', () => {
  const props = { cardId: 'body', lead: <p>The lead.</p>, rest: <p>The rest.</p>, label: 'Show more: 1 more paragraph' };

  it('clamps the lead and says what is hidden; a tap asks to expand', () => {
    const onToggle = vi.fn();
    render(<ShowMore {...props} expanded={false} onToggle={onToggle} canExpand />);
    expect(screen.getByText('The lead.').parentElement).toHaveAttribute('data-clamped', 'true');
    expect(screen.queryByText('The rest.')).toBeNull();
    expect(screen.getByTestId('show-more-toggle')).toHaveTextContent('Show more: 1 more paragraph');
    fireEvent.click(screen.getByTestId('show-more-toggle'));
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('expanded shows the rest and "Show less" folds it back', () => {
    const onToggle = vi.fn();
    render(<ShowMore {...props} expanded onToggle={onToggle} canExpand />);
    expect(screen.getByText('The rest.')).toBeInTheDocument();
    expect(screen.getByTestId('show-more-toggle')).toHaveTextContent('Show less');
    expect(screen.getByTestId('show-more-toggle')).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByTestId('show-more-toggle'));
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it('with nothing to reveal there is no button and no clamp', () => {
    render(<ShowMore {...props} expanded={false} onToggle={() => {}} canExpand={false} />);
    expect(screen.queryByTestId('show-more-toggle')).toBeNull();
    expect(screen.getByText('The lead.').parentElement).toHaveAttribute('data-clamped', 'false');
  });
});

describe('By timeframe grouping', () => {
  it('groups the periods by the timeframe each starts in', () => {
    const periods = periodsOf(selfV3Fixture().cards.find((c) => c.id === 'stuck')!);
    expect(groupPeriods(periods, 'years').map((g) => [g.label, g.periods.length])).toEqual([['2026', 2], ['2027', 1]]);
    expect(groupPeriods(periods, 'quarters').map((g) => g.label)).toEqual(['Apr to Jun 2026', 'Oct to Dec 2026', 'Apr to Jun 2027']);
    expect(groupPeriods(periods, 'decades').map((g) => g.label)).toEqual(['2020s']);
  });

  it('a touch screen always gets the swipe', () => {
    expect(resolveGroupsAs('accordion', true)).toBe('swipe');
    expect(resolveGroupsAs('accordion', false)).toBe('accordion');
    expect(resolveGroupsAs('swipe', false)).toBe('swipe');
  });
});
