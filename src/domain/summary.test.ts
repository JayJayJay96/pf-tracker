import { describe, expect, it } from 'vitest';

import { calculateMonthlySummary } from './summary';

describe('monthly summary', () => {
  it('excludes pending income and deductions outside the selected calendar month', () => {
    expect(calculateMonthlySummary({
      period: { startDate: '2026-04-01', endDate: '2026-04-30' },
      income: [
        { amount: 100_000, status: 'confirmed', transactionDate: '2026-04-15' },
        { amount: 50_000, status: 'pending', transactionDate: '2026-04-16' },
        { amount: 25_000, status: 'confirmed', transactionDate: '2026-05-01' },
      ],
      commitments: [],
      savings: [{ amount: 10_000, transactionDate: '2026-04-02' }],
      investments: [{ amount: 5_000, transactionDate: '2026-04-03' }],
      personalSpending: [
        { amount: 20_000, status: 'resolved', transactionDate: '2026-04-04' },
        { amount: 30_000, status: 'pending', transactionDate: '2026-04-05' },
      ],
    })).toEqual({ confirmedIncome: 100_000, activeCommitments: 0, savings: 10_000, investments: 5_000, resolvedPersonalSpending: 20_000, remainingSpendable: 65_000 });
  });

  it('deducts an active commitment before it has been paid', () => {
    expect(calculateMonthlySummary({
      period: { startDate: '2026-04-01', endDate: '2026-04-30' },
      income: [{ amount: 100_000, status: 'confirmed', transactionDate: '2026-04-01' }],
      commitments: [{ amount: 40_000, status: 'active', transactionDate: '2026-04-10' }],
      savings: [],
      investments: [],
      personalSpending: [],
    }).remainingSpendable).toBe(60_000);
  });
});
