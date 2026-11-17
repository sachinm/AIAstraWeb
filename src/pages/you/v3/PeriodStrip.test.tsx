import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import PeriodStrip from './PeriodStrip';
import { chipPeriods, datesWords, keyDatesOf, periodsOf } from './cardModel';
import { selfV3Fixture } from './selfV3.fixture';
import type { RailItem, SelfV3CardView } from '../../../lib/selfV3Api';

const TODAY = '2026-11-13';
const body = selfV3Fixture().cards.find((c) => c.id === 'body')!;

function railCard(items: Partial<RailItem>[]): SelfV3CardView {
  // standing sent (empty): the v2 body does not stand in for a period's text
  return { ...body, v3: null, standing: [], rail: items.map((o, i) => ({ from: '2026-01-01', to: '2026-02-01', label: '', tone: null, note: null, current: false, span: null, text: [`T${i}.`], ...o })) };
}

describe('the period model', () => {
  it('words the dates by where the period sits against today', () => {
    const item = (from: string, to: string) => ({ from, to }) as RailItem;
    expect(datesWords(item('2026-05-01', '2027-06-03'), TODAY)).toBe('to 3 Jun 2027');
    expect(datesWords(item('2027-01-01', '2028-02-16'), TODAY)).toBe('from 1 Jan 2027');
    expect(datesWords(item('2025-01-01', '2026-11-11'), TODAY)).toBe('1 Jan 2025 – 11 Nov 2026');
  });

  it('never repeats a period: two ending the same day are one', () => {
    const p = periodsOf(railCard([{ from: '2026-05-01', to: '2027-01-01', current: true }, { from: '2026-10-01', to: '2027-01-01' }]), TODAY);
    expect(p).toHaveLength(1);
    expect(p[0]!.current).toBe(true);
  });

  it('orders by start date whatever order the server sent', () => {
    const p = periodsOf(railCard([{ from: '2027-06-03', to: '2027-12-01' }, { from: '2026-12-05', to: '2027-01-01' }, { from: '2026-12-19', to: '2027-06-03' }]), TODAY);
    expect(p.map((x) => x.item.from)).toEqual(['2026-12-05', '2026-12-19', '2027-06-03']);
  });

  it('offers chips only for periods with text, and none when only one has text', () => {
    expect(chipPeriods(periodsOf(railCard([{ text: null }, { from: '2026-02-01', to: '2026-03-01' }]), TODAY))).toHaveLength(0);
    expect(chipPeriods(periodsOf(railCard([{}, { from: '2026-02-01', to: '2026-03-01' }]), TODAY))).toHaveLength(2);
  });

  it('marks key dates that have passed and orders them', () => {
    const k = keyDatesOf({ ...body, keyDates: [{ date: '2027-01-01', label: 'a new phase begins' }, { date: '2026-11-11', label: 'stress clears' }] }, TODAY);
    expect(k.map((x) => [x.date, x.passed])).toEqual([
      ['2026-11-11', true],
      ['2027-01-01', false],
    ]);
  });
});

describe('the period chips', () => {
  const periods = periodsOf(body, TODAY);
  const chips = chipPeriods(periods);

  it('draws one tab per chip, the picked one selected, controlling the reading', () => {
    render(<PeriodStrip cardId="body" periods={periods} chips={chips} selected={0} onSelect={() => {}} panelId="panel" />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[0]).toHaveAttribute('aria-controls', 'panel');
  });

  it('the arrows move to the next and previous chip', () => {
    const onSelect = vi.fn();
    render(<PeriodStrip cardId="body" periods={periods} chips={chips} selected={0} onSelect={onSelect} panelId="panel" />);
    expect(screen.getByTestId('period-prev')).toBeDisabled();
    fireEvent.click(screen.getByTestId('period-next'));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('draws nothing with fewer than two chips', () => {
    const { container } = render(<PeriodStrip cardId="body" periods={periods} chips={chips.slice(0, 1)} selected={0} onSelect={() => {}} panelId="panel" />);
    expect(container).toBeEmptyDOMElement();
  });
});
