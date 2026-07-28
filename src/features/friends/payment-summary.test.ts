import { describe, expect, it } from 'vitest';

import { buildPaymentSummary } from './payment-summary';

describe('payment request copy summary', () => {
  it('renders dated immutable line items and the exact total', () => {
    expect(buildPaymentSummary({
      friendName: 'Alex',
      items: [
        {
          description: 'Dinner',
          transactionDate: '2026-07-10',
          amountSen: 6_240,
        },
        {
          description: 'Movie',
          transactionDate: '2026-07-14',
          amountSen: 1_800,
        },
      ],
      totalSen: 8_040,
    })).toBe([
      'Hey Alex, these are the pending amounts:',
      '',
      '10 Jul 2026 — Dinner: RM62.40',
      '14 Jul 2026 — Movie: RM18.00',
      '',
      'Total: RM80.40',
    ].join('\n'));
  });

  it('rejects a total that does not equal its item snapshots', () => {
    expect(() => buildPaymentSummary({
      friendName: 'Alex',
      items: [{
        description: 'Dinner',
        transactionDate: '2026-07-10',
        amountSen: 6_240,
      }],
      totalSen: 6_241,
    })).toThrow('Payment request snapshots do not match the total');
  });
});
