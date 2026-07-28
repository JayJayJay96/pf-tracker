import { describe, expect, it } from 'vitest';

import { getSharedBills, type SharedBillReadRepository } from './queries';

function repository(
  overrides: Partial<SharedBillReadRepository> = {},
): SharedBillReadRepository {
  return {
    listFriends: async () => ({ data: [], error: null }),
    listBills: async () => ({ data: [], error: null }),
    ...overrides,
  };
}

describe('shared bill queries', () => {
  it('maps unresolved and resolved bills with exact owner and friend portions', async () => {
    await expect(getSharedBills(repository({
      listFriends: async () => ({
        data: [{ id: 'friend-1', name: 'Alex' }],
        error: null,
      }),
      listBills: async () => ({
        data: [
          {
            id: 'bill-1',
            description: 'Dinner',
            amount_sen: 1001,
            transaction_date: '2026-07-03',
            payment_method: 'tng',
            shared_status: 'resolved',
            bill_participants: [
              { participant_kind: 'user', amount_sen: 501, friends: null },
              {
                participant_kind: 'friend',
                amount_sen: 500,
                friends: { name: 'Alex' },
              },
            ],
          },
          {
            id: 'bill-2',
            description: 'Taxi',
            amount_sen: 800,
            transaction_date: '2026-07-04',
            payment_method: 'cash',
            shared_status: 'unresolved',
            bill_participants: [],
          },
        ],
        error: null,
      }),
    }), 'user-a')).resolves.toEqual({
      friends: [{ id: 'friend-1', name: 'Alex' }],
      bills: [
        {
          id: 'bill-1',
          description: 'Dinner',
          amountSen: 1001,
          transactionDate: '2026-07-03',
          paymentMethod: 'tng',
          status: 'resolved',
          userPortionSen: 501,
          friendPortions: [{ friendName: 'Alex', amountSen: 500 }],
        },
        {
          id: 'bill-2',
          description: 'Taxi',
          amountSen: 800,
          transactionDate: '2026-07-04',
          paymentMethod: 'cash',
          status: 'unresolved',
          userPortionSen: 0,
          friendPortions: [],
        },
      ],
    });
  });
});
