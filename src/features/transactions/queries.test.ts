import { describe, expect, it } from 'vitest';

import {
  getTransactionHistory,
  type TransactionHistoryReadRepository,
} from './queries';

const rows = [
  {
    id: 'personal-market',
    description: 'Market groceries',
    merchant: 'Village Market',
    amount_sen: 4250,
    transaction_date: '2026-07-05',
    recorded_at: '2026-07-06T08:00:00Z',
    category_id: 'food',
    payment_method: 'cash',
    transaction_type: 'personal_expense',
    shared_status: null,
    categories: { name: 'Food' },
    bill_participants: [],
  },
  {
    id: 'shared-dinner',
    description: 'Birthday dinner',
    merchant: 'Night Market',
    amount_sen: 12000,
    transaction_date: '2026-07-04',
    recorded_at: '2026-07-07T08:00:00Z',
    category_id: null,
    payment_method: 'tng',
    transaction_type: 'shared_expense',
    shared_status: 'resolved',
    categories: null,
    bill_participants: [
      {
        participant_kind: 'user',
        friend_id: null,
        amount_sen: 4000,
        friends: null,
        friend_portion_settlements: null,
      },
      {
        participant_kind: 'friend',
        friend_id: 'alex',
        amount_sen: 5000,
        friends: { name: 'Alex' },
        friend_portion_settlements: {
          status: 'requested',
          payment_request_id: 'request-alex',
        },
      },
      {
        participant_kind: 'friend',
        friend_id: 'bee',
        amount_sen: 3000,
        friends: { name: 'Bee' },
        friend_portion_settlements: {
          status: 'paid',
          payment_request_id: 'request-bee',
        },
      },
    ],
  },
  {
    id: 'shared-taxi',
    description: 'Airport taxi',
    merchant: null,
    amount_sen: 9000,
    transaction_date: '2026-07-08',
    recorded_at: '2026-07-08T08:00:00Z',
    category_id: null,
    payment_method: 'cash',
    transaction_type: 'shared_expense',
    shared_status: 'unresolved',
    categories: null,
    bill_participants: [],
  },
];

function repository(
  onList?: (userId: string, filters: unknown) => void,
): TransactionHistoryReadRepository {
  return {
    listCategories: async () => ({
      data: [{ id: 'food', name: 'Food' }],
      error: null,
    }),
    listFriends: async () => ({
      data: [{ id: 'alex', name: 'Alex' }, { id: 'bee', name: 'Bee' }],
      error: null,
    }),
    listTransactions: async (userId, filters) => {
      onList?.(userId, filters);
      return { data: rows, error: null };
    },
  };
}

describe('unified transaction history', () => {
  it('combines personal, unresolved shared, and resolved shared records', async () => {
    const history = await getTransactionHistory(repository(), 'owner-a', {
      sort: 'date',
    });

    expect(history.categories).toEqual([{ id: 'food', name: 'Food' }]);
    expect(history.friends).toEqual([
      { id: 'alex', name: 'Alex' },
      { id: 'bee', name: 'Bee' },
    ]);
    expect(history.transactions.map(({ id }) => id)).toEqual([
      'shared-taxi',
      'personal-market',
      'shared-dinner',
    ]);
    expect(history.transactions[2]).toMatchObject({
      type: 'shared_expense',
      sharedStatus: 'resolved',
      userPortionSen: 4000,
      friendOutstandingSen: 5000,
      friendPortions: [
        {
          friendId: 'alex',
          friendName: 'Alex',
          amountSen: 5000,
          status: 'requested',
          requestId: 'request-alex',
        },
        {
          friendId: 'bee',
          friendName: 'Bee',
          amountSen: 3000,
          status: 'paid',
          requestId: 'request-bee',
        },
      ],
    });
  });

  it('applies every supported filter and keeps friend/status matching on one portion', async () => {
    const selected = await getTransactionHistory(repository(), 'owner-a', {
      search: 'night',
      from: '2026-07-01',
      to: '2026-07-31',
      paymentMethod: 'tng',
      type: 'shared',
      sharedStatus: 'resolved',
      friendId: 'alex',
      requestStatus: 'requested',
      sort: 'newest',
    });
    expect(selected.transactions.map(({ id }) => id)).toEqual(['shared-dinner']);

    const wrongFriendStatusPair = await getTransactionHistory(repository(), 'owner-a', {
      friendId: 'alex',
      requestStatus: 'paid',
      sort: 'date',
    });
    expect(wrongFriendStatusPair.transactions).toEqual([]);

    const personal = await getTransactionHistory(repository(), 'owner-a', {
      categoryId: 'food',
      type: 'personal',
      sort: 'amount',
    });
    expect(personal.transactions.map(({ id }) => id)).toEqual(['personal-market']);
  });

  it('delegates an owner-scoped query and sorts by amount, newest, or outstanding', async () => {
    const calls: Array<[string, unknown]> = [];
    const filters = { type: 'shared' as const, sort: 'friend_outstanding' as const };
    const outstanding = await getTransactionHistory(
      repository((...args) => calls.push(args)),
      'owner-a',
      filters,
    );
    expect(calls).toEqual([['owner-a', filters]]);
    expect(outstanding.transactions.map(({ id }) => id)).toEqual([
      'shared-dinner',
      'shared-taxi',
    ]);

    const byAmount = await getTransactionHistory(repository(), 'owner-a', {
      sort: 'amount',
    });
    expect(byAmount.transactions.map(({ id }) => id)).toEqual([
      'shared-dinner',
      'shared-taxi',
      'personal-market',
    ]);

    const newest = await getTransactionHistory(repository(), 'owner-a', {
      sort: 'newest',
    });
    expect(newest.transactions.map(({ id }) => id)).toEqual([
      'shared-taxi',
      'shared-dinner',
      'personal-market',
    ]);
  });
});
