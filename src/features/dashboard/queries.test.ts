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
            { entry_date: '2026-07-25', entry_type: 'income', amount_sen: 500_000, actual_amount_sen: 525_000, status: 'confirmed' },
            { entry_date: '2026-07-29', entry_type: 'commitment', amount_sen: 120_000, actual_amount_sen: 115_000, status: 'pending' },
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
      listPendingRequests: async (userId) => {
        requests.push([userId, 'pending-requests']);
        return {
          data: [{ id: 'request-1', status: 'pending' }],
          error: null,
        };
      },
      listPaidCommitments: async () => ({
        data: [{
          amount_sen: 120_000,
          actual_amount_sen: 115_000,
          paid_date: '2026-07-20',
        }],
        error: null,
      }),
    };

    await expect(getDashboardSummary(
      repository,
      'user-a',
      '2026-07-01',
      '2026-07-24',
    )).resolves.toEqual({
      confirmedIncome: 525_000,
      activeCommitments: 115_000,
      savings: 50_000,
      investments: 30_000,
      resolvedPersonalSpending: 1_250,
      remainingSpendable: 328_750,
      snapshotCount: 4,
      hasSnapshots: true,
      totalCashOutflow: 116_250,
      friendReceivables: 0,
      paidOnBehalf: 0,
      unresolvedBillCount: 0,
      upcomingCommitmentCount: 1,
      upcomingCommitmentsSen: 115_000,
      pendingRequestCount: 1,
      daysToNextSalary: 1,
    });
    expect(requests).toEqual([
      ['user-a', '2026-07-01'],
      ['user-a', 'expenses:2026-07-01'],
      ['user-a', 'pending-requests'],
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

  it('counts unresolved cash outflow without personal spending, then resolved portions and receivables', async () => {
    const repository: DashboardReadRepository = {
      listEntries: async () => ({ data: [], error: null }),
      listPersonalExpenses: async () => ({ data: [], error: null }),
      listSharedBills: async () => ({
        data: [
          {
            id: 'unresolved',
            transaction_date: '2026-07-02',
            amount_sen: 1000,
            shared_status: 'unresolved',
          },
          {
            id: 'resolved',
            transaction_date: '2026-07-03',
            amount_sen: 1001,
            shared_status: 'resolved',
          },
        ],
        error: null,
      }),
      listSharedPortions: async () => ({
        data: [
          {
            transaction_id: 'resolved',
            participant_kind: 'user',
            amount_sen: 501,
          },
          {
            transaction_id: 'resolved',
            participant_kind: 'friend',
            amount_sen: 500,
            friend_portion_settlements: [{ status: 'requested' }],
          },
          {
            transaction_id: 'resolved',
            participant_kind: 'friend',
            amount_sen: 250,
            friend_portion_settlements: [{ status: 'paid' }],
          },
        ],
        error: null,
      }),
    };

    await expect(getDashboardSummary(repository, 'user-a', '2026-07-01'))
      .resolves.toMatchObject({
        resolvedPersonalSpending: 501,
        totalCashOutflow: 2001,
        friendReceivables: 500,
        paidOnBehalf: 750,
        unresolvedBillCount: 1,
        remainingSpendable: -501,
      });
  });

  it('attributes a paid commitment actual to its paid month, not its due month', async () => {
    const repository: DashboardReadRepository = {
      listEntries: async () => ({ data: [], error: null }),
      listPersonalExpenses: async () => ({ data: [], error: null }),
      listPaidCommitments: async () => ({
        data: [{
          amount_sen: 12_000,
          actual_amount_sen: 13_742,
          paid_date: '2026-07-02',
        }],
        error: null,
      }),
    };

    await expect(getDashboardSummary(repository, 'user-a', '2026-07-01'))
      .resolves.toMatchObject({
        activeCommitments: 0,
        totalCashOutflow: 13_742,
      });
  });
});
