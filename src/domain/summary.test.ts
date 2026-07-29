import { describe, expect, it } from 'vitest';

import { calculateMonthlySummary, type MonthlySummaryInput } from './summary';

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

  const invalidEntries: Array<[string, Partial<MonthlySummaryInput>]> = [
    ['pending income', { income: [{ amount: -1, status: 'pending', transactionDate: '2026-04-01' }] }],
    ['inactive commitment', { commitments: [{ amount: Number.MAX_SAFE_INTEGER + 1, status: 'inactive', transactionDate: '2026-04-01' }] }],
    ['unresolved personal spending', { personalSpending: [{ amount: -1, status: 'pending', transactionDate: '2026-04-01' }] }],
    ['out-of-period savings', { savings: [{ amount: -1, transactionDate: '2026-05-01' }] }],
  ];

  it.each(invalidEntries)('rejects an invalid amount in %s before selection', (_name, entries) => {
    expect(() => calculateMonthlySummary({
      period: { startDate: '2026-04-01', endDate: '2026-04-30' },
      income: [],
      commitments: [],
      savings: [],
      investments: [],
      personalSpending: [],
      ...entries,
    })).toThrow('Sen amount must be a nonnegative integer');
  });

  it('rejects an invalid requested period even when every entry list is empty', () => {
    expect(() => calculateMonthlySummary({
      period: { startDate: '2026-04-30', endDate: '2026-04-01' },
      income: [],
      commitments: [],
      savings: [],
      investments: [],
      personalSpending: [],
    })).toThrow('Invalid calendar period');
  });

  it('selects a backdated entry through the summary transaction date', () => {
    expect(calculateMonthlySummary({
      period: { startDate: '2026-04-01', endDate: '2026-04-30' },
      income: [
        { amount: 12_345, status: 'confirmed', transactionDate: '2026-04-03' },
        { amount: 99_999, status: 'confirmed', transactionDate: '2026-05-01' },
      ],
      commitments: [],
      savings: [],
      investments: [],
      personalSpending: [],
    }).confirmedIncome).toBe(12_345);
  });
});

/**
 * Scenarios written the way the owner describes them, in ringgit, so the
 * arithmetic behind "remaining spendable" is checkable without clicking through
 * the app. RM10,000 is 1_000_000 sen.
 */
describe('remaining spendable, in owner scenarios', () => {
  const period = { startDate: '2026-07-01', endDate: '2026-07-31' } as const;
  const on = '2026-07-15';

  function summary(overrides: Partial<Parameters<typeof calculateMonthlySummary>[0]> = {}) {
    return calculateMonthlySummary({
      period,
      income: [],
      commitments: [],
      savings: [],
      investments: [],
      personalSpending: [],
      ...overrides,
    });
  }

  it('RM10,000 income minus RM2,000 of commitments leaves RM8,000', () => {
    const result = summary({
      income: [{ amount: 1_000_000, transactionDate: on, status: 'confirmed' }],
      commitments: [{ amount: 200_000, transactionDate: on, status: 'active' }],
    });

    expect(result.remainingSpendable).toBe(800_000);
    expect(result.confirmedIncome).toBe(1_000_000);
    expect(result.activeCommitments).toBe(200_000);
  });

  it('counts no income at all while it is still unconfirmed', () => {
    const result = summary({
      income: [{ amount: 1_000_000, transactionDate: on, status: 'pending' }],
      commitments: [{ amount: 200_000, transactionDate: on, status: 'active' }],
    });

    // Income marked "Not confirmed yet" contributes nothing, so the commitment
    // alone drives the figure negative.
    expect(result.confirmedIncome).toBe(0);
    expect(result.remainingSpendable).toBe(-200_000);
  });

  it('stops deducting a commitment once it is paused', () => {
    const result = summary({
      income: [{ amount: 1_000_000, transactionDate: on, status: 'confirmed' }],
      commitments: [{ amount: 200_000, transactionDate: on, status: 'inactive' }],
    });

    expect(result.remainingSpendable).toBe(1_000_000);
  });

  it('subtracts savings and investments alongside commitments', () => {
    const result = summary({
      income: [{ amount: 1_000_000, transactionDate: on, status: 'confirmed' }],
      commitments: [{ amount: 200_000, transactionDate: on, status: 'active' }],
      savings: [{ amount: 100_000, transactionDate: on }],
      investments: [{ amount: 50_000, transactionDate: on }],
    });

    // 10,000 - 2,000 - 1,000 - 500
    expect(result.remainingSpendable).toBe(650_000);
  });

  it('subtracts personal spending only once it is resolved', () => {
    const spending = [
      { amount: 30_000, transactionDate: on, status: 'resolved' as const },
      { amount: 90_000, transactionDate: on, status: 'pending' as const },
    ];
    const result = summary({
      income: [{ amount: 1_000_000, transactionDate: on, status: 'confirmed' }],
      commitments: [{ amount: 200_000, transactionDate: on, status: 'active' }],
      personalSpending: spending,
    });

    // Only the resolved RM300 counts; an unresolved shared bill does not yet.
    expect(result.resolvedPersonalSpending).toBe(30_000);
    expect(result.remainingSpendable).toBe(770_000);
  });

  it('goes negative when commitments exceed confirmed income', () => {
    const result = summary({
      income: [{ amount: 100_000, transactionDate: on, status: 'confirmed' }],
      commitments: [{ amount: 200_000, transactionDate: on, status: 'active' }],
    });

    expect(result.remainingSpendable).toBe(-100_000);
  });

  it('ignores amounts dated outside the month being viewed', () => {
    const result = summary({
      income: [
        { amount: 1_000_000, transactionDate: on, status: 'confirmed' },
        { amount: 500_000, transactionDate: '2026-08-01', status: 'confirmed' },
      ],
      commitments: [{ amount: 200_000, transactionDate: '2026-06-30', status: 'active' }],
    });

    expect(result.remainingSpendable).toBe(1_000_000);
  });
});
