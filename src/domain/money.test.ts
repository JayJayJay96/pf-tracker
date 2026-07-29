import { describe, expect, it } from 'vitest';

import {
  addSen,
  formatAmountInput,
  formatRM,
  parseAmountInput,
  parseRM,
  parseSignedAmountInput,
  subtractSen,
} from './money';

describe('RM money', () => {
  it('parses RM0.01 into one sen', () => {
    expect(parseRM('RM0.01')).toBe(1);
  });

  it('formats a large integer sen amount without floating point rounding', () => {
    expect(formatRM(9_007_199_254_740_991)).toBe('RM90071992547409.91');
  });

  it('rejects malformed and negative RM input', () => {
    expect(() => parseRM('12.3')).toThrow('Invalid RM amount');
    expect(() => parseRM('RM-1.00')).toThrow('Invalid RM amount');
    expect(() => formatRM(-1)).toThrow('Sen amount must be a nonnegative integer');
  });

  it('adds and subtracts integer sen exactly', () => {
    expect(addSen(1, 9_007_199_254_740_990)).toBe(9_007_199_254_740_991);
    expect(subtractSen(100, 1)).toBe(99);
  });
});

function expectSen(raw: string, sen: number): void {
  const result = parseAmountInput(raw);
  expect(result, `parseAmountInput(${JSON.stringify(raw)})`).toEqual({ ok: true, sen });
}

function expectRejected(raw: string): string {
  const result = parseAmountInput(raw);
  if (result.ok) {
    throw new Error(`Expected ${JSON.stringify(raw)} to be rejected`);
  }
  return result.error;
}

describe('lenient amount entry', () => {
  it('accepts a bare whole number as ringgit', () => {
    expectSen('5', 500);
    expectSen('12', 1200);
    expectSen('0', 0);
  });

  it('accepts one or two decimal places', () => {
    expectSen('5.5', 550);
    expectSen('12.50', 1250);
    expectSen('0.01', 1);
    expectSen('8.05', 805);
  });

  it('accepts an optional RM prefix in any case, with or without a space', () => {
    expectSen('RM12.50', 1250);
    expectSen('rm12.50', 1250);
    expectSen('Rm 12.50', 1250);
    expectSen('RM  8', 800);
  });

  it('accepts surrounding whitespace and thousands separators', () => {
    expectSen('  12.50  ', 1250);
    expectSen('1,250', 125000);
    expectSen('1,250.75', 125075);
    expectSen('RM 1,000,000.00', 100000000);
  });

  it('accepts shorthand a keypad user would type', () => {
    expectSen('.5', 50);
    expectSen('5.', 500);
  });

  it('rejects an empty or prefix-only value with a prompt to enter an amount', () => {
    expect(expectRejected('')).toBe('Enter an amount');
    expect(expectRejected('   ')).toBe('Enter an amount');
    expect(expectRejected('RM')).toBe('Enter an amount');
  });

  it('rejects more than two decimal places rather than silently rounding money', () => {
    expect(expectRejected('12.505')).toBe('Use at most 2 decimal places, like 12.50');
  });

  it('rejects letters, symbols, and multiple decimal points', () => {
    const message = 'Enter a number, like 12.50';
    expect(expectRejected('twelve')).toBe(message);
    expect(expectRejected('12.5.0')).toBe(message);
    expect(expectRejected('12-50')).toBe(message);
    expect(expectRejected('$12.50')).toBe(message);
    expect(expectRejected('1..5')).toBe(message);
    expect(expectRejected('.')).toBe(message);
  });

  it('rejects a negative amount by default', () => {
    expect(expectRejected('-5.00')).toBe('Enter a number, like 12.50');
  });

  it('rejects an amount too large to hold exactly in sen', () => {
    expect(expectRejected('99999999999999999')).toBe('That amount is too large');
  });

  it('round-trips through the strict storage format', () => {
    const result = parseAmountInput('1,250.75');
    if (!result.ok) throw new Error('expected success');
    expect(formatRM(result.sen)).toBe('RM1250.75');
    expect(parseRM(formatRM(result.sen))).toBe(result.sen);
  });

  it('formats sen back into a bare editable value without the RM prefix', () => {
    expect(formatAmountInput(1250)).toBe('12.50');
    expect(formatAmountInput(1)).toBe('0.01');
    expect(formatAmountInput(0)).toBe('0.00');
  });

  it('parses signed amounts only where a signed value is meaningful', () => {
    expect(parseSignedAmountInput('-0.05')).toEqual({ ok: true, sen: -5 });
    expect(parseSignedAmountInput('-RM0.05')).toEqual({ ok: true, sen: -5 });
    expect(parseSignedAmountInput('0.05')).toEqual({ ok: true, sen: 5 });
    expect(parseSignedAmountInput('+0.05')).toEqual({ ok: true, sen: 5 });
    expect(parseSignedAmountInput('-')).toEqual({ ok: false, error: 'Enter an amount' });
  });
});
