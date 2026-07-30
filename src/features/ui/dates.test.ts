import { describe, expect, it } from 'vitest';

import { displayDate, displayDateTime } from './dates';

describe('displayDate', () => {
  it('reads a stored date as a date a person would write', () => {
    expect(displayDate('2026-07-15')).toBe('15 Jul 2026');
  });

  it('keeps the day it was given', () => {
    // The guard against formatting a date-only value in a local zone: read in
    // anything behind UTC, the first of a month becomes the last of the month
    // before, so every boundary lands in the wrong month.
    expect(displayDate('2026-01-01')).toBe('1 Jan 2026');
    expect(displayDate('2026-12-31')).toBe('31 Dec 2026');
  });

  it('accepts a full timestamp by taking its date part', () => {
    expect(displayDate('2026-07-15T23:30:00.000Z')).toBe('15 Jul 2026');
  });
});

describe('displayDateTime', () => {
  it('reports a moment in the owner own day rather than UTC', () => {
    // Noon UTC is 8pm in Kuala Lumpur, still the same date.
    expect(displayDateTime('2026-08-01T12:00:00.000Z')).toContain('1 Aug 2026');
    expect(displayDateTime('2026-08-01T12:00:00.000Z')).toMatch(/8:00\s?pm/i);
  });

  it('carries a late UTC evening into the following local day', () => {
    // 23:00 UTC on the 1st is 7am on the 2nd in Kuala Lumpur. Printing the UTC
    // date here would tell the owner they keyed it in a day earlier than they did.
    expect(displayDateTime('2026-08-01T23:00:00.000Z')).toContain('2 Aug 2026');
  });
});
