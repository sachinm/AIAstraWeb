import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import PeriodStrip, { PeriodDots } from './PeriodStrip';
import { periodsOf } from './cardModel';
import { selfV3Fixture } from './selfV3.fixture';

const card = (id: string) => selfV3Fixture().cards.find((c) => c.id === id)!;

describe('PeriodStrip', () => {
  it('offers a period only when it has words of its own or is the current one', () => {
    const periods = periodsOf(card('stuck'));
    expect(periods.map((p) => p.selectable)).toEqual([true, true, false]);
    const onSelect = vi.fn();
    render(<PeriodStrip cardId="stuck" periods={periods} selected={0} onSelect={onSelect} />);
    expect(screen.getByTestId('period-0')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('period-2')).toBeDisabled();
    fireEvent.click(screen.getByTestId('period-1'));
    expect(onSelect).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByTestId('period-2'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('the arrows step to the next period that can be picked, skipping the ones without words', () => {
    const periods = periodsOf(card('stuck'));
    const onSelect = vi.fn();
    render(<PeriodStrip cardId="stuck" periods={periods} selected={1} onSelect={onSelect} />);
    expect(screen.getByTestId('period-next')).toBeDisabled();
    fireEvent.click(screen.getByTestId('period-prev'));
    expect(onSelect).toHaveBeenCalledWith(0);
  });

  it('each v3 span is a period with its own text and tone', () => {
    const periods = periodsOf(card('body'));
    expect(periods.every((p) => p.own && p.selectable)).toBe(true);
    expect(periods[0]!.text![0]).toContain('guard your evenings');
    expect(periods[2]!.text![0]).toContain('A good stretch to build strength');
    expect(periods[0]!.text).not.toEqual(periods[2]!.text);
  });

  it('draws nothing for one period; the dots count only the periods that can be picked', () => {
    const one = periodsOf(card('stuck')).slice(0, 1);
    const { container } = render(<PeriodStrip cardId="x" periods={one} selected={0} onSelect={() => {}} />);
    expect(container).toBeEmptyDOMElement();
    render(<PeriodDots periods={periodsOf(card('stuck'))} selected={0} onSelect={() => {}} />);
    expect(screen.getByTestId('period-dots').querySelectorAll('button')).toHaveLength(2);
  });
});
