import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { TransactionHistoryView } from './transaction-history-view';

describe('unified transaction history view', () => {
  it('renders all filters and only type-safe editor destinations', () => {
    const page = renderToStaticMarkup(
      <TransactionHistoryView
        history={{
          categories: [{ id: 'food', name: 'Food' }],
          friends: [{ id: 'alex', name: 'Alex' }],
          transactions: [{
            id: 'personal-1',
            description: 'Lunch',
            merchant: 'Cafe',
            amountSen: 1250,
            transactionDate: '2026-07-01',
            recordedAt: '2026-07-01T10:00:00Z',
            categoryId: 'food',
            categoryName: 'Food',
            paymentMethod: 'cash',
            type: 'personal_expense',
            sharedStatus: null,
            userPortionSen: 1250,
            friendOutstandingSen: 0,
            friendPortions: [],
          }, {
            id: 'shared-open',
            description: 'Open bill',
            merchant: null,
            amountSen: 2000,
            transactionDate: '2026-07-02',
            recordedAt: '2026-07-02T10:00:00Z',
            categoryId: null,
            categoryName: null,
            paymentMethod: 'tng',
            type: 'shared_expense',
            sharedStatus: 'unresolved',
            userPortionSen: 0,
            friendOutstandingSen: 0,
            friendPortions: [],
          }, {
            id: 'shared-locked',
            description: 'Locked bill',
            merchant: null,
            amountSen: 3000,
            transactionDate: '2026-07-03',
            recordedAt: '2026-07-03T10:00:00Z',
            categoryId: null,
            categoryName: null,
            paymentMethod: 'tng',
            type: 'shared_expense',
            sharedStatus: 'resolved',
            userPortionSen: 1500,
            friendOutstandingSen: 1500,
            friendPortions: [{
              friendId: 'alex',
              friendName: 'Alex',
              amountSen: 1500,
              status: 'requested',
              requestId: 'request-1',
            }],
          }],
        }}
        filters={{ sort: 'date' }}
      />,
    );

    [
      'Search description or merchant',
      'From',
      'To',
      'Category',
      'Payment method',
      'Transaction type',
      'Shared state',
      'Friend',
      'Payment-request status',
      'Sort',
    ].forEach((label) => expect(page).toContain(label));
    expect(page).toContain('href="/expenses#transaction-personal-1"');
    expect(page).toContain('Edit personal expense');
    expect(page).toContain('href="/shared-bills#transaction-shared-open"');
    expect(page).toContain('Resolve shared bill');
    expect(page).toContain('href="/shared-bills#transaction-shared-locked"');
    expect(page).toContain('View locked shared bill');
    expect(page).toContain('Resolved shared allocations are locked');
    expect(page).toContain('href="/friends/alex/requests/request-1"');
  });
});
