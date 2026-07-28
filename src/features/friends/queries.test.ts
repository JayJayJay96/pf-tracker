import { describe, expect, it } from 'vitest';

import {
  getFriendLedger,
  getFriendsOverview,
  type FriendReadRepository,
} from './queries';

function repository(
  overrides: Partial<FriendReadRepository> = {},
): FriendReadRepository {
  return {
    listFriends: async () => ({ data: [], error: null }),
    listPortions: async () => ({ data: [], error: null }),
    listRequests: async () => ({ data: [], error: null }),
    listRequestItems: async () => ({ data: [], error: null }),
    ...overrides,
  };
}

const friends = [
  {
    id: 'friend-1',
    name: 'Alex',
    nickname: 'Al',
    phone: null,
    notes: null,
    active: true,
  },
];

const portions = [
  {
    id: 'bill-participant-1',
    friend_id: 'friend-1',
    amount_sen: 6_240,
    transactions: {
      description: 'Dinner',
      transaction_date: '2026-07-10',
    },
    friend_portion_settlements: [{
      id: 'portion-1',
      status: 'unrequested',
      payment_request_id: null,
      settled_on: null,
    }],
  },
  {
    id: 'bill-participant-2',
    friend_id: 'friend-1',
    amount_sen: 1_800,
    transactions: {
      description: 'Movie',
      transaction_date: '2026-07-14',
    },
    friend_portion_settlements: [{
      id: 'portion-2',
      status: 'requested',
      payment_request_id: 'request-1',
      settled_on: null,
    }],
  },
  {
    id: 'bill-participant-3',
    friend_id: 'friend-1',
    amount_sen: 2_000,
    transactions: {
      description: 'Taxi',
      transaction_date: '2026-07-15',
    },
    friend_portion_settlements: [{
      id: 'portion-3',
      status: 'paid',
      payment_request_id: 'request-old',
      settled_on: '2026-07-20',
    }],
  },
  {
    id: 'bill-participant-4',
    friend_id: 'friend-1',
    amount_sen: 500,
    transactions: {
      description: 'Coffee',
      transaction_date: '2026-07-16',
    },
    friend_portion_settlements: [{
      id: 'portion-4',
      status: 'forgiven',
      payment_request_id: 'request-forgiven',
      settled_on: '2026-07-21',
    }],
  },
];

const requests = [{
  id: 'request-1',
  friend_id: 'friend-1',
  total_sen: 1_800,
  request_date: '2026-07-18',
  status: 'pending',
  note: 'July',
  paid_on: null,
  cancelled_on: null,
  forgiven_on: null,
}];

describe('friend ledger queries', () => {
  it('groups unrequested, pending, paid, forgiven, and outstanding without income', async () => {
    await expect(getFriendsOverview(repository({
      listFriends: async () => ({ data: friends, error: null }),
      listPortions: async () => ({ data: portions, error: null }),
      listRequests: async () => ({ data: requests, error: null }),
    }), 'user-a')).resolves.toEqual([expect.objectContaining({
      id: 'friend-1',
      unrequestedSen: 6_240,
      requestedSen: 1_800,
      paidSen: 2_000,
      forgivenSen: 500,
      outstandingSen: 8_040,
      collectedSen: 2_000,
      pendingRequestCount: 1,
    })]);
  });

  it('returns an itemized friend ledger and immutable request snapshots', async () => {
    const result = await getFriendLedger(repository({
      listFriends: async () => ({ data: friends, error: null }),
      listPortions: async () => ({ data: portions, error: null }),
      listRequests: async () => ({ data: requests, error: null }),
      listRequestItems: async () => ({
        data: [{
          id: 'item-1',
          payment_request_id: 'request-1',
          bill_participant_id: 'bill-participant-2',
          description_snapshot: 'Movie',
          transaction_date_snapshot: '2026-07-14',
          amount_sen_snapshot: 1_800,
        }],
        error: null,
      }),
    }), 'user-a', 'friend-1');

    expect(result.ledger).toEqual(expect.arrayContaining([
      expect.objectContaining({
        portionId: 'portion-1',
        status: 'unrequested',
        requestId: null,
      }),
      expect.objectContaining({
        portionId: 'portion-3',
        status: 'paid',
        settledOn: '2026-07-20',
      }),
    ]));
    expect(result.requests[0]).toEqual(expect.objectContaining({
      id: 'request-1',
      totalSen: 1_800,
      items: [{
        id: 'item-1',
        portionId: 'bill-participant-2',
        description: 'Movie',
        transactionDate: '2026-07-14',
        amountSen: 1_800,
      }],
    }));
  });
});
