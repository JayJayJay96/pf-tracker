import { describe, expect, it } from 'vitest';

import {
  addMonths,
  endOfMonth,
  getCalendarMonth,
  isDateInPeriod,
  monthsRemaining,
  toMonthValue,
} from './periods';

describe('calendar month periods', () => {
  it('returns the correct February boundaries in a common year', () => {
    expect(getCalendarMonth('2025-02-14')).toEqual({ startDate: '2025-02-01', endDate: '2025-02-28' });
  });

  it('returns the correct February boundaries in a leap year', () => {
    expect(getCalendarMonth('2024-02-29')).toEqual({ startDate: '2024-02-01', endDate: '2024-02-29' });
  });

  it('selects a backdated transaction by its transaction date', () => {
    const april = getCalendarMonth('2026-04-01');

    expect(isDateInPeriod('2026-04-30', april)).toBe(true);
    expect(isDateInPeriod('2026-05-01', april)).toBe(false);
  });

  it('rejects non-ISO and impossible date-only inputs', () => {
    expect(() => getCalendarMonth('14/02/2025')).toThrow('Invalid ISO date');
    expect(() => getCalendarMonth('2025-02-29')).toThrow('Invalid ISO date');
  });

  it.each([
    [{ startDate: '2026-04-30', endDate: '2026-04-01' }],
    [{ startDate: '2026-04-02', endDate: '2026-04-30' }],
    [{ startDate: '2026-04-01', endDate: '2026-04-29' }],
    [{ startDate: '2026-04-01', endDate: '2026-05-31' }],
  ])('rejects a range that is not a complete calendar month: %o', (period) => {
    expect(() => isDateInPeriod('2026-04-15', period)).toThrow('Invalid calendar period');
  });
});

describe('final month and payments remaining', () => {
  it('resolves a month to its last day, including leap February', () => {
    expect(endOfMonth('2027-06')).toBe('2027-06-30');
    expect(endOfMonth('2027-01')).toBe('2027-01-31');
    expect(endOfMonth('2024-02')).toBe('2024-02-29');
    expect(endOfMonth('2025-02')).toBe('2025-02-28');
  });

  it('rejects a value that is not a real month', () => {
    expect(() => endOfMonth('2027-13')).toThrow('Invalid ISO month');
    expect(() => endOfMonth('2027-00')).toThrow('Invalid ISO month');
    expect(() => endOfMonth('2027-6')).toThrow('Invalid ISO month');
    expect(() => endOfMonth('2027-06-30')).toThrow('Invalid ISO month');
  });

  it('reduces a stored date back to an editable month', () => {
    expect(toMonthValue('2027-06-30')).toBe('2027-06');
    expect(() => toMonthValue('2027-06')).toThrow('Invalid ISO date');
  });

  it('counts the current month and the final month inclusively', () => {
    // Final payment this month means one payment left, not zero.
    expect(monthsRemaining('2026-07-31', '2026-07-01')).toBe(1);
    expect(monthsRemaining('2026-08-31', '2026-07-01')).toBe(2);
    expect(monthsRemaining('2027-06-30', '2026-07-01')).toBe(12);
  });

  it('counts across a year boundary', () => {
    expect(monthsRemaining('2027-01-31', '2026-12-01')).toBe(2);
    expect(monthsRemaining('2029-03-31', '2026-07-01')).toBe(33);
  });

  it('reports nothing left once the final month has passed', () => {
    expect(monthsRemaining('2026-06-30', '2026-07-01')).toBe(0);
    expect(monthsRemaining('2025-01-31', '2026-07-01')).toBe(0);
  });
});

describe('stepping months', () => {
  it('steps forward and back within a year', () => {
    expect(addMonths('2026-07-01', 1)).toBe('2026-08-01');
    expect(addMonths('2026-07-01', -1)).toBe('2026-06-01');
    expect(addMonths('2026-07-01', 0)).toBe('2026-07-01');
  });

  it('crosses year boundaries in both directions', () => {
    expect(addMonths('2026-12-01', 1)).toBe('2027-01-01');
    expect(addMonths('2026-01-01', -1)).toBe('2025-12-01');
    expect(addMonths('2026-07-01', 18)).toBe('2028-01-01');
    expect(addMonths('2026-07-01', -18)).toBe('2025-01-01');
  });

  it('always lands on the first of the month', () => {
    expect(addMonths('2026-02-01', 1)).toBe('2026-03-01');
    expect(addMonths('2026-01-01', 1)).toBe('2026-02-01');
  });
});
