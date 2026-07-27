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
