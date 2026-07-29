export type ISODate = string;

export type CalendarMonth = {
  startDate: ISODate;
  endDate: ISODate;
};

function parseISODate(date: ISODate): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    throw new Error('Invalid ISO date');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const daysInMonth = month === 2
    ? (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28)
    : [4, 6, 9, 11].includes(month) ? 30 : 31;

  if (month < 1 || month > 12 || day < 1 || day > daysInMonth) {
    throw new Error('Invalid ISO date');
  }
  return { year, month, day };
}

/** Returns the inclusive calendar-month boundaries for an ISO date-only value. */
export function getCalendarMonth(date: ISODate): CalendarMonth {
  const { year, month } = parseISODate(date);
  const prefix = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
  const lastDay = month === 2
    ? (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28)
    : [4, 6, 9, 11].includes(month) ? 30 : 31;
  return { startDate: `${prefix}-01`, endDate: `${prefix}-${lastDay}` };
}

/**
 * Resolves an `YYYY-MM` month to the last day of that month.
 *
 * A recurring item's final payment is a month, not a day: "the car loan ends in
 * June 2027". Storing the month's last day keeps that meaning while still
 * satisfying the date column it lives in.
 */
export function endOfMonth(month: string): ISODate {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error('Invalid ISO month');
  }
  return getCalendarMonth(`${month}-01`).endDate;
}

/** Steps a calendar-month start by whole months, for a previous/next control. */
export function addMonths(periodStart: ISODate, delta: number): ISODate {
  const { year, month } = parseISODate(periodStart);
  const zeroBased = (year * 12) + (month - 1) + delta;
  const shiftedYear = Math.floor(zeroBased / 12);
  const shiftedMonth = zeroBased - (shiftedYear * 12) + 1;
  if (shiftedYear < 1 || shiftedYear > 9999) {
    throw new Error('Invalid ISO date');
  }
  const prefix = `${String(shiftedYear).padStart(4, '0')}-${String(shiftedMonth).padStart(2, '0')}`;
  return getCalendarMonth(`${prefix}-01`).startDate;
}

/** Reduces an ISO date to its `YYYY-MM` month, for editing as a month value. */
export function toMonthValue(date: ISODate): string {
  parseISODate(date);
  return date.slice(0, 7);
}

/**
 * Counts the payments still to come, inclusive of the period being viewed and
 * of the final month itself.
 *
 * Derived rather than stored: a counter decremented each month needs something
 * to run every month, and silently rots the moment a run is missed. Computing it
 * from the final month stays correct whenever it is read, even after a long gap.
 */
export function monthsRemaining(finalDate: ISODate, periodStart: ISODate): number {
  const final = parseISODate(finalDate);
  const current = parseISODate(periodStart);
  const months = (final.year - current.year) * 12 + (final.month - current.month);
  return months < 0 ? 0 : months + 1;
}

/** Tests whether an ISO date-only value falls within inclusive period boundaries. */
export function isDateInPeriod(date: ISODate, period: CalendarMonth): boolean {
  parseISODate(date);
  parseISODate(period.startDate);
  parseISODate(period.endDate);
  const expectedPeriod = getCalendarMonth(period.startDate);
  if (period.startDate !== expectedPeriod.startDate || period.endDate !== expectedPeriod.endDate) {
    throw new Error('Invalid calendar period');
  }
  return date >= period.startDate && date <= period.endDate;
}
