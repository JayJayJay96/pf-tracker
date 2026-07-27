import { describe, expect, it } from 'vitest';

import { addSen, formatRM, parseRM, subtractSen } from './money';

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
