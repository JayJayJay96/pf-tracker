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
      listPersonalExpenses: async (userId, periodStart) => {
        requests.push([userId, `expenses:${periodStart}`]);
        return {
          data: [
            { transaction_date: '2026-07-03', amount_sen: 1_250 },
            { transaction_date: '2026-06-30', amount_sen: 900 },
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
      resolvedPersonalSpending: 1_250,
      remainingSpendable: 298_750,
      snapshotCount: 4,
      hasSnapshots: true,
    });
    expect(requests).toEqual([
      ['user-a', '2026-07-01'],
      ['user-a', 'expenses:2026-07-01'],
    ]);
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
      listPersonalExpenses: async () => ({ data: [], error: null }),
    };

    await expect(getDashboardSummary(repository, 'user-a', '2026-07-01'))
      .resolves.toMatchObject({
        confirmedIncome: 0,
        activeCommitments: 0,
        remainingSpendable: 0,
        snapshotCount: 2,
        hasSnapshots: true,
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
      listPersonalExpenses: async () => ({ data: [], error: null }),
    };

    await expect(getDashboardSummary(repository, 'user-a', '2026-07-01'))
      .resolves.toMatchObject({
        confirmedIncome: 0,
        activeCommitments: 120_000,
        savings: 50_000,
        remainingSpendable: -170_000,
      });
  });

  it('reports no snapshots independently from a zero-valued summary', async () => {
    const repository: DashboardReadRepository = {
      listEntries: async () => ({ data: [], error: null }),
      listPersonalExpenses: async () => ({ data: [], error: null }),
    };

    await expect(getDashboardSummary(repository, 'user-a', '2026-07-01'))
      .resolves.toMatchObject({
        remainingSpendable: 0,
        snapshotCount: 0,
        hasSnapshots: false,
      });
  });

  it('uses the transaction date rather than recorded time for backdated spending', async () => {
    const repository: DashboardReadRepository = {
      listEntries: async () => ({ data: [], error: null }),
      listPersonalExpenses: async () => ({
        data: [{
          transaction_date: '2026-06-30',
          amount_sen: 1_250,
          recorded_at: '2026-07-02T10:00:00Z',
        }],
        error: null,
      }),
    };

    await expect(getDashboardSummary(repository, 'user-a', '2026-06-01'))
      .resolves.toMatchObject({
        resolvedPersonalSpending: 1_250,
        remainingSpendable: -1_250,
      });
  });
});
