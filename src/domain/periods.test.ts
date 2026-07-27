import { describe, expect, it } from 'vitest';

import { getCalendarMonth, isDateInPeriod } from './periods';

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
});
