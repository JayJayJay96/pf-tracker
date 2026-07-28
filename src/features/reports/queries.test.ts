import { describe, expect, it } from 'vitest';

import {
  getReport,
  resolveReportPeriod,
  type ReportReadRepository,
} from './queries';

function repository(
  overrides: Partial<Record<keyof ReportReadRepository, unknown[]>> = {},
): ReportReadRepository {
  const result = (key: keyof ReportReadRepository) => async () => ({
    data: overrides[key] ?? [],
    error: null,
  });
  return {
    listPlanEntries: result('listPlanEntries'),
    listTransactions: result('listTransactions'),
    listParticipants: result('listParticipants'),
    listRequests: result('listRequests'),
    listPaidCommitments: result('listPaidCommitments'),
  };
}

describe('resolveReportPeriod', () => {
  it('resolves calendar months, custom ranges, year to date, and full years', () => {
    expect(resolveReportPeriod({ kind: 'month', month: '2026-07' }, '2026-07-28'))
      .toEqual({ startDate: '2026-07-01', endDate: '2026-07-31', label: 'July 2026' });
    expect(resolveReportPeriod(
      { kind: 'custom', from: '2026-06-29', to: '2026-07-02' },
      '2026-07-28',
    )).toEqual({
      startDate: '2026-06-29',
      endDate: '2026-07-02',
      label: '29 Jun 2026 – 2 Jul 2026',
    });
    expect(resolveReportPeriod({ kind: 'ytd', year: '2026' }, '2026-07-28'))
      .toEqual({ startDate: '2026-01-01', endDate: '2026-07-28', label: '2026 year to date' });
    expect(resolveReportPeriod({ kind: 'year', year: '2025' }, '2026-07-28'))
      .toEqual({ startDate: '2025-01-01', endDate: '2025-12-31', label: '2025' });
  });

  it('rejects invalid or reversed date ranges', () => {
    expect(() => resolveReportPeriod(
      { kind: 'custom', from: '2026-07-03', to: '2026-07-02' },
      '2026-07-28',
    )).toThrow('Invalid report period');
    expect(() => resolveReportPeriod(
      { kind: 'month', month: '2026-13' },
      '2026-07-28',
    )).toThrow('Invalid report period');
  });
});

describe('getReport', () => {
  it('uses transaction dates for backdated spending, not recorded timestamps', async () => {
    const report = await getReport(
      repository({
        listTransactions: [{
          id: 'personal-july',
          description: 'Backdated meal',
          amount_sen: 2450,
          transaction_date: '2026-07-10',
          recorded_at: '2026-08-02T03:00:00Z',
          transaction_type: 'personal_expense',
          shared_status: null,
        }, {
          id: 'personal-august',
          description: 'August meal',
          amount_sen: 990,
          transaction_date: '2026-08-01',
          recorded_at: '2026-07-31T23:59:00Z',
          transaction_type: 'personal_expense',
          shared_status: null,
        }],
      }),
      'owner-a',
      { startDate: '2026-07-01', endDate: '2026-07-31', label: 'July 2026' },
    );

    expect(report.summary.personalSpendingSen).toBe(2450);
    expect(report.summary.totalPaidSen).toBe(2450);
    expect(report.transactions.map(({ id }) => id)).toEqual(['personal-july']);
  });

  it('calculates plan, shared-bill, and settlement metrics without treating collection as income', async () => {
    const report = await getReport(
      repository({
        listPlanEntries: [
          { id: 'salary', entry_date: '2026-07-01', name: 'Salary', entry_type: 'income', amount_sen: 500000, actual_amount_sen: 510000, status: 'confirmed' },
          { id: 'kpi', entry_date: '2026-07-02', name: 'Estimated KPI', entry_type: 'income', amount_sen: 10000, status: 'pending' },
          { id: 'rent', entry_date: '2026-07-03', name: 'Rent', entry_type: 'commitment', amount_sen: 120000, actual_amount_sen: 115000, status: 'paid' },
          { id: 'old-rent', entry_date: '2026-07-03', name: 'Old rent', entry_type: 'commitment', amount_sen: 2000, status: 'inactive' },
          { id: 'save', entry_date: '2026-07-04', name: 'Savings', entry_type: 'savings', amount_sen: 50000, status: 'planned' },
          { id: 'invest', entry_date: '2026-07-05', name: 'Investment', entry_type: 'investment', amount_sen: 25000, status: 'planned' },
        ],
        listTransactions: [{
          id: 'shared',
          description: 'Dinner',
          amount_sen: 10000,
          transaction_date: '2026-07-06',
          recorded_at: '2026-07-06T12:00:00Z',
          transaction_type: 'shared_expense',
          shared_status: 'resolved',
          categories: null,
          bill_items: [{
            id: 'item-pizza',
            description: 'Pizza',
            amount_sen: 10000,
            discount_sen: 0,
          }],
        }],
        listParticipants: [
          {
            id: 'mine',
            transaction_id: 'shared',
            participant_kind: 'user',
            friend_id: null,
            amount_sen: 4000,
            friend_portion_settlements: null,
          },
          {
            id: 'friend-paid',
            transaction_id: 'shared',
            participant_kind: 'friend',
            friend_id: 'friend-a',
            amount_sen: 3000,
            friends: [{ name: 'Alex' }],
            friend_portion_settlements: [{
              status: 'paid',
              settled_on: '2026-07-20',
              payment_request_id: 'paid-request',
            }],
          },
          {
            id: 'friend-pending',
            transaction_id: 'shared',
            participant_kind: 'friend',
            friend_id: 'friend-a',
            amount_sen: 3000,
            friends: [{ name: 'Alex' }],
            friend_portion_settlements: [{
              status: 'requested',
              settled_on: null,
              payment_request_id: 'pending-request',
            }],
          },
        ],
        listRequests: [
          { id: 'paid-request', total_sen: 3000, request_date: '2026-06-30', status: 'paid', paid_on: '2026-07-20' },
          { id: 'pending-request', total_sen: 3000, request_date: '2026-07-10', status: 'pending', paid_on: null },
          { id: 'paid-this-month', total_sen: 4000, request_date: '2026-07-12', status: 'paid', paid_on: '2026-07-22' },
          { id: 'cancelled-request', total_sen: 9999, request_date: '2026-07-11', status: 'cancelled', paid_on: null },
        ],
        listPaidCommitments: [{
          id: 'rent',
          entry_date: '2026-07-03',
          name: 'Rent',
          entry_type: 'commitment',
          amount_sen: 120000,
          actual_amount_sen: 115000,
          status: 'paid',
          paid_date: '2026-07-03',
        }],
      }),
      'owner-a',
      { startDate: '2026-07-01', endDate: '2026-07-31', label: 'July 2026' },
    );

    expect(report.summary).toEqual({
      incomeSen: 510000,
      pendingIncomeSen: 10000,
      commitmentsSen: 115000,
      savingsSen: 50000,
      investmentsSen: 25000,
      personalSpendingSen: 4000,
      remainingSpendableSen: 316000,
      totalPaidSen: 125000,
      paidForFriendsSen: 6000,
      requestedSen: 7000,
      collectedSen: 7000,
      outstandingSen: 3000,
    });
    expect(report.transactions[0]).toMatchObject({
      items: [{ description: 'Pizza', amountSen: 10000 }],
      friendPortions: [
        { friendName: 'Alex', status: 'paid', requestId: 'paid-request' },
        { friendName: 'Alex', status: 'requested', requestId: 'pending-request' },
      ],
    });
  });

  it('compares a month with the previous calendar month', async () => {
    const repo = repository({
      listTransactions: [
        { id: 'june', description: 'June', amount_sen: 1000, transaction_date: '2026-06-30', recorded_at: '2026-07-01T00:00:00Z', transaction_type: 'personal_expense', shared_status: null },
        { id: 'july', description: 'July', amount_sen: 1500, transaction_date: '2026-07-01', recorded_at: '2026-07-01T00:00:00Z', transaction_type: 'personal_expense', shared_status: null },
      ],
    });

    const report = await getReport(
      repo,
      'owner-a',
      { startDate: '2026-07-01', endDate: '2026-07-31', label: 'July 2026' },
      { startDate: '2026-06-01', endDate: '2026-06-30', label: 'June 2026' },
    );

    expect(report.comparison?.personalSpendingSen).toEqual({
      currentSen: 1500,
      previousSen: 1000,
      changeSen: 500,
    });
  });

  it('attributes paid commitment cash outflow by paid date across periods', async () => {
    const report = await getReport(
      repository({
        listPaidCommitments: [{
          id: 'june-electric',
          entry_date: '2026-06-28',
          name: 'Electric',
          entry_type: 'commitment',
          amount_sen: 12000,
          actual_amount_sen: 13742,
          status: 'paid',
          paid_date: '2026-07-02',
        }],
      }),
      'owner-a',
      { startDate: '2026-07-01', endDate: '2026-07-31', label: 'July 2026' },
    );

    expect(report.summary.commitmentsSen).toBe(0);
    expect(report.summary.totalPaidSen).toBe(13_742);
  });
});
