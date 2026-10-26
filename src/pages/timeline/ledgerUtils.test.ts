import { describe, expect, it } from 'vitest';
import type { LifeEvent } from '../../lib/ledgerApi';
import {
  buildYearStrip,
  categoryLabel,
  categoryLabels,
  cleanAttributes,
  formatEventDate,
  formFieldForServerField,
  isFutureDate,
  normaliseDate,
  parseDateParts,
  placeEvent,
  stripYears,
  toInputValue,
} from './ledgerUtils';

const ev = (id: string, date: string, p: LifeEvent['date_precision'], category = 'job_change'): LifeEvent => ({
  id,
  category,
  date,
  date_precision: p,
  place: null,
  attributes: {},
});

describe('parseDateParts', () => {
  it('reads year, month and day forms', () => {
    expect(parseDateParts('2014')).toEqual({ year: 2014 });
    expect(parseDateParts('2014-03')).toEqual({ year: 2014, month: 3 });
    expect(parseDateParts('2014-03-12')).toEqual({ year: 2014, month: 3, day: 12 });
  });
  it('rejects impossible dates and junk', () => {
    expect(parseDateParts('2014-13')).toBeNull();
    expect(parseDateParts('2015-02-29')).toBeNull();
    expect(parseDateParts('2016-02-29')).toEqual({ year: 2016, month: 2, day: 29 });
    expect(parseDateParts('March 2014')).toBeNull();
    expect(parseDateParts('')).toBeNull();
    expect(parseDateParts(null)).toBeNull();
  });
});

describe('normaliseDate', () => {
  it('cuts to the precision', () => {
    expect(normaliseDate('2014-03-12', 'year')).toBe('2014');
    expect(normaliseDate('2014-03-12', 'month')).toBe('2014-03');
    expect(normaliseDate('2014-03-12', 'day')).toBe('2014-03-12');
    expect(normaliseDate('2014-3', 'month')).toBe('2014-03');
  });
  it('returns null when the input lacks parts the precision needs', () => {
    expect(normaliseDate('2014', 'month')).toBeNull();
    expect(normaliseDate('2014-03', 'day')).toBeNull();
    expect(normaliseDate('', 'year')).toBeNull();
  });
});

describe('toInputValue', () => {
  it('converts stored dates to each input type', () => {
    expect(toInputValue('2014-03-01', 'month')).toBe('2014-03');
    expect(toInputValue('2014-01-01', 'year')).toBe('2014');
    expect(toInputValue('2014', 'day')).toBe('2014-01-01');
    expect(toInputValue('2014-03', 'day')).toBe('2014-03-01');
    expect(toInputValue('nope', 'day')).toBe('');
  });
});

describe('isFutureDate', () => {
  const today = new Date(2026, 9, 26); // 26 Oct 2026
  it('compares at the precision', () => {
    expect(isFutureDate('2027', 'year', today)).toBe(true);
    expect(isFutureDate('2026', 'year', today)).toBe(false);
    expect(isFutureDate('2026-11', 'month', today)).toBe(true);
    expect(isFutureDate('2026-10', 'month', today)).toBe(false);
    expect(isFutureDate('2026-10-27', 'day', today)).toBe(true);
    expect(isFutureDate('2026-10-26', 'day', today)).toBe(false);
    expect(isFutureDate('2025-12-31', 'day', today)).toBe(false);
  });
});

describe('formatEventDate', () => {
  it('states the date at its precision', () => {
    expect(formatEventDate('2014-01-01', 'year')).toBe('2014');
    expect(formatEventDate('2014-03-01', 'month')).toBe('March 2014');
    expect(formatEventDate('2014-03-12', 'day')).toBe('12 March 2014');
  });
});

describe('stripYears', () => {
  it('gives the current year and the 17 before, oldest first', () => {
    const ys = stripYears(new Date(2026, 5, 1), 18);
    expect(ys).toHaveLength(18);
    expect(ys[0]).toBe(2009);
    expect(ys[17]).toBe(2026);
  });
});

describe('placeEvent', () => {
  it('marks year-precision events as whole-year', () => {
    expect(placeEvent(ev('a', '2014-01-01', 'year'))).toMatchObject({ year: 2014, kind: 'year', offset: 0 });
  });
  it('places month events at the start of their month', () => {
    const p = placeEvent(ev('a', '2014-07-01', 'month'))!;
    expect(p).toMatchObject({ year: 2014, kind: 'point', month: 7 });
    expect(p.offset).toBeCloseTo(6 / 12);
  });
  it('places day events within the month', () => {
    const p = placeEvent(ev('a', '2014-07-16', 'day'))!;
    expect(p.offset).toBeGreaterThan(6 / 12);
    expect(p.offset).toBeLessThan(7 / 12);
  });
  it('returns null for an unreadable date', () => {
    expect(placeEvent(ev('a', 'x', 'day'))).toBeNull();
  });
});

describe('buildYearStrip', () => {
  it('buckets events by year, sorts points and counts events outside the strip', () => {
    const years = [2013, 2014, 2015];
    const { columns, outside } = buildYearStrip(
      [
        ev('late', '2014-11-03', 'day'),
        ev('whole', '2014-01-01', 'year'),
        ev('early', '2014-02-01', 'month'),
        ev('old', '2001-05-01', 'month'),
        ev('bad', 'x', 'day'),
      ],
      years
    );
    expect(columns.map((c) => c.year)).toEqual(years);
    const y2014 = columns[1]!;
    expect(y2014.wholeYear.map((p) => p.event.id)).toEqual(['whole']);
    expect(y2014.points.map((p) => p.event.id)).toEqual(['early', 'late']);
    expect(columns[0]!.points).toHaveLength(0);
    expect(outside).toBe(2);
  });
});

describe('category labels', () => {
  it('maps codes to labels across markers and falls back to the code', () => {
    const labels = categoryLabels({
      markers: [
        { id: 'work', label: 'Work', categories: [{ code: 'job_change', label: 'Job change' }] },
        { id: 'home', label: 'Home', categories: [{ code: 'relocation', label: 'Relocation' }] },
      ],
      attributes: [],
      precisions: ['day', 'month', 'year'],
      years: 18,
      interview: true,
    });
    expect(categoryLabel(labels, 'relocation')).toBe('Relocation');
    expect(categoryLabel(labels, 'some_code')).toBe('some code');
    expect(categoryLabel(categoryLabels(null), 'job_change')).toBe('job change');
  });
});

describe('cleanAttributes', () => {
  it('drops empty values and trims', () => {
    expect(cleanAttributes({ direction: ' north ', role: '', note: '   ' })).toEqual({ direction: 'north' });
  });
});

describe('formFieldForServerField', () => {
  const keys = ['direction', 'role'];
  it('maps server fields to form fields', () => {
    expect(formFieldForServerField('category', keys)).toBe('category');
    expect(formFieldForServerField('date', keys)).toBe('date');
    expect(formFieldForServerField('date_precision', keys)).toBe('date');
    expect(formFieldForServerField('place', keys)).toBe('place');
    expect(formFieldForServerField('attributes.role', keys)).toBe('attr:role');
    expect(formFieldForServerField('attributes[direction]', keys)).toBe('attr:direction');
    expect(formFieldForServerField('role', keys)).toBe('attr:role');
    expect(formFieldForServerField('attributes', keys)).toBe('attributes');
    expect(formFieldForServerField('kundliId', keys)).toBeNull();
    expect(formFieldForServerField(undefined, keys)).toBeNull();
  });
});
