import { describe, expect, it } from 'vitest';

import {
  getDashboardSummary,
  type DashboardReadRepository,
} from './queries';

describe('dashboard queries', () => {
  it('calculates a conservative owner-scoped summary from selected-month snapshots', async () => {
    const requests: Array<[string, string]> = [];
    const repository: DashboardReadRepository = {
      listEntries: async (userId, periodStart) => {
        requests.push([userId, periodStart]);
        return {
          data: [
            { entry_date: '2026-07-25', entry_type: 'income', amount_sen: 500_000, status: 'confirmed' },
            { entry_date: '2026-07-01', entry_type: 'commitment', amount_sen: 120_000, status: 'active' },
            { entry_date: '2026-07-15', entry_type: 'savings', amount_sen: 50_000, status: 'planned' },
            { entry_date: '2026-07-20', entry_type: 'investment', amount_sen: 30_000, status: 'planned' },
          ],
          error: null,
        };
      },
    };

    await expect(getDashboardSummary(repository, 'user-a', '2026-07-01')).resolves.toEqual({
      confirmedIncome: 500_000,
      activeCommitments: 120_000,
      savings: 50_000,
      investments: 30_000,
      resolvedPersonalSpending: 0,
      remainingSpendable: 300_000,
    });
    expect(requests).toEqual([['user-a', '2026-07-01']]);
  });

  it('excludes pending income and inactive commitments', async () => {
    const repository: DashboardReadRepository = {
      listEntries: async () => ({
        data: [
          { entry_date: '2026-07-25', entry_type: 'income', amount_sen: 900_000, status: 'pending' },
          { entry_date: '2026-07-01', entry_type: 'commitment', amount_sen: 100_000, status: 'inactive' },
        ],
        error: null,
      }),
    };

    await expect(getDashboardSummary(repository, 'user-a', '2026-07-01'))
      .resolves.toMatchObject({
        confirmedIncome: 0,
        activeCommitments: 0,
        remainingSpendable: 0,
      });
  });

  it('returns a negative remaining amount when planned deductions exceed income', async () => {
    const repository: DashboardReadRepository = {
      listEntries: async () => ({
        data: [
          { entry_date: '2026-07-01', entry_type: 'commitment', amount_sen: 120_000, status: 'active' },
          { entry_date: '2026-07-15', entry_type: 'savings', amount_sen: 50_000, status: 'planned' },
        ],
        error: null,
      }),
    };

    await expect(getDashboardSummary(repository, 'user-a', '2026-07-01'))
      .resolves.toMatchObject({
        confirmedIncome: 0,
        activeCommitments: 120_000,
        savings: 50_000,
        remainingSpendable: -170_000,
      });
  });
});
