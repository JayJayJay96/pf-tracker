import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ReportView } from './report-view';

describe('ReportView', () => {
  it('renders summary, month comparison, drill-down, and authenticated exports', () => {
    const markup = renderToStaticMarkup(<ReportView
      report={{
        period: { startDate: '2026-07-01', endDate: '2026-07-31', label: 'July 2026' },
        summary: {
          incomeSen: 500000,
          pendingIncomeSen: 10000,
          commitmentsSen: 120000,
          savingsSen: 50000,
          investmentsSen: 25000,
          personalSpendingSen: 4000,
          remainingSpendableSen: 301000,
          totalPaidSen: 10000,
          paidForFriendsSen: 6000,
          requestedSen: 3000,
          collectedSen: 3000,
          outstandingSen: 3000,
        },
        comparison: {
          period: { startDate: '2026-06-01', endDate: '2026-06-30', label: 'June 2026' },
          incomeSen: { currentSen: 500000, previousSen: 490000, changeSen: 10000 },
          commitmentsSen: { currentSen: 120000, previousSen: 120000, changeSen: 0 },
          savingsSen: { currentSen: 50000, previousSen: 40000, changeSen: 10000 },
          investmentsSen: { currentSen: 25000, previousSen: 25000, changeSen: 0 },
          personalSpendingSen: { currentSen: 4000, previousSen: 5000, changeSen: -1000 },
          outstandingSen: { currentSen: 3000, previousSen: 0, changeSen: 3000 },
        },
        transactions: [{
          id: 'dinner',
          description: 'Dinner',
          amountSen: 10000,
          transactionDate: '2026-07-10',
          recordedAt: '2026-08-01T12:00:00Z',
          type: 'shared_expense',
          sharedStatus: 'resolved',
          userPortionSen: 4000,
          friendPortionSen: 6000,
          categoryName: null,
          items: [{
            id: 'pizza',
            description: 'Pizza',
            amountSen: 10000,
            discountSen: 0,
          }],
          friendPortions: [{
            friendId: 'alex',
            friendName: 'Alex',
            amountSen: 6000,
            status: 'requested',
            requestId: 'request-1',
          }],
        }],
      }}
      selection={{ kind: 'month', month: '2026-07' }}
      today="2026-07-28"
    />);

    expect(markup).toContain('July 2026 report');
    expect(markup).toContain('Remaining spendable');
    // Grouped for readability now; formatRM stays separator-free for storage.
    expect(markup).toContain('RM3,010.00');
    expect(markup).toContain('Compared with June 2026');
    expect(markup).toContain('Dinner');
    expect(markup).toContain('Your portion');
    expect(markup).toContain('Pizza');
    expect(markup).toContain('Alex');
    expect(markup).toContain('/friends/alex/requests/request-1');
    expect(markup).toContain('Recorded ');
    expect(markup).toContain('1 Aug 2026');
    expect(markup).toContain('/api/export/transactions');
    expect(markup).toContain('/api/export/backup');
  });

  it('renders a negative remaining spendable amount', () => {
    const markup = renderToStaticMarkup(<ReportView
      report={{
        period: { startDate: '2026-06-01', endDate: '2026-06-30', label: 'June 2026' },
        summary: {
          incomeSen: 0,
          pendingIncomeSen: 0,
          commitmentsSen: 0,
          savingsSen: 0,
          investmentsSen: 0,
          personalSpendingSen: 1250,
          remainingSpendableSen: -1250,
          totalPaidSen: 1250,
          paidForFriendsSen: 0,
          requestedSen: 0,
          collectedSen: 0,
          outstandingSen: 0,
        },
        transactions: [],
      }}
      selection={{ kind: 'month', month: '2026-06' }}
      today="2026-07-28"
    />);

    // One minus glyph across the app: the ASCII hyphen formatMoney emits,
    // replacing this screen's lone use of U+2212.
    expect(markup).toContain('-RM12.50');
  });
});

type Report = Parameters<typeof ReportView>[0]['report'];

/** Only the fields the category breakdown reads; the rest is noise for it. */
function transaction(over: Partial<Report['transactions'][number]>): Report['transactions'][number] {
  return {
    id: 'id',
    description: 'Thing',
    amountSen: 1000,
    transactionDate: '2026-07-10',
    recordedAt: '2026-07-10T12:00:00Z',
    type: 'personal_expense',
    sharedStatus: null,
    categoryName: 'Food',
    userPortionSen: 0,
    friendPortionSen: 0,
    items: [],
    friendPortions: [],
    ...over,
  } as Report['transactions'][number];
}

function withTransactions(transactions: Report['transactions']): string {
  return renderToStaticMarkup(<ReportView
    report={{
      period: { startDate: '2026-07-01', endDate: '2026-07-31', label: 'July 2026' },
      summary: {
        incomeSen: 0,
        pendingIncomeSen: 0,
        commitmentsSen: 0,
        savingsSen: 0,
        investmentsSen: 0,
        personalSpendingSen: 0,
        remainingSpendableSen: 0,
        totalPaidSen: 0,
        paidForFriendsSen: 0,
        requestedSen: 0,
        collectedSen: 0,
        outstandingSen: 0,
      },
      transactions,
    }}
    selection={{ kind: 'month', month: '2026-07' }}
    today="2026-07-28"
  />);
}

describe('spending by category', () => {
  it('adds each category up and totals them', () => {
    const markup = withTransactions([
      transaction({ id: 'a', categoryName: 'Food', amountSen: 7500 }),
      transaction({ id: 'b', categoryName: 'Food', amountSen: 2500 }),
      transaction({ id: 'c', categoryName: 'Transport', amountSen: 2500 }),
    ]);

    expect(markup).toContain('Spending by category');
    expect(markup).toContain('Food');
    expect(markup).toContain('Transport');
    expect(markup).toContain('RM100.00');
    expect(markup).toContain('Total RM125.00');
  });

  it('counts only the owner portion of a resolved shared bill', () => {
    // The friends' share was never the owner's money to spend, so a category
    // must not be charged for the whole bill.
    const markup = withTransactions([
      transaction({
        categoryName: 'Food',
        type: 'shared_expense',
        sharedStatus: 'resolved',
        amountSen: 18000,
        userPortionSen: 6000,
      }),
    ]);

    // The breakdown charges the category RM60, not the RM180 bill. RM180 does
    // still appear on the page, as the bill's own line in the history below, so
    // this asserts the total the breakdown reached rather than its absence.
    expect(markup).toContain('RM60.00');
    expect(markup).toContain('Total RM60.00');
  });

  it('leaves an unresolved shared bill out and says that it did', () => {
    const markup = withTransactions([
      transaction({ id: 'a', categoryName: 'Food', amountSen: 5000 }),
      transaction({
        id: 'b',
        type: 'shared_expense',
        sharedStatus: 'unresolved',
        amountSen: 18000,
        categoryName: null,
      }),
    ]);

    expect(markup).toContain('Total RM50.00');
    expect(markup).toContain('Excludes 1 unresolved shared bill');
  });

  it('names uncategorised spending instead of dropping it', () => {
    const markup = withTransactions([
      transaction({
        categoryName: null,
        type: 'shared_expense',
        sharedStatus: 'resolved',
        amountSen: 4000,
        userPortionSen: 4000,
      }),
    ]);

    expect(markup).toContain('Uncategorised');
    expect(markup).toContain('Total RM40.00');
  });

  it('says nothing is categorised rather than drawing an empty chart', () => {
    expect(withTransactions([])).toContain('No categorised spending in this period.');
  });
});
