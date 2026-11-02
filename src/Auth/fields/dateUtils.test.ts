import { describe, expect, it } from 'vitest';
import { longDate, parseTypedDate, swappedDate } from './dateUtils';

describe('reading back a typed date', () => {
  it('names the month that was understood', () => {
    expect(longDate(parseTypedDate('04/05/1990') as string)).toBe('4 May 1990');
  });

  it('offers the other reading when both are real dates', () => {
    expect(swappedDate('04/05/1990')).toBe('1990-04-05');
  });

  it('offers nothing when only one reading is real, or both are the same', () => {
    expect(swappedDate('27/04/1990')).toBeNull();
    expect(swappedDate('05/05/1990')).toBeNull();
    expect(swappedDate('05/5/1990')).toBeNull();
    expect(swappedDate('1990-04-05')).toBeNull();
  });

  it('offers no future date', () => {
    expect(swappedDate('12/03/2026', '2026-11-02')).toBeNull();
  });
});
