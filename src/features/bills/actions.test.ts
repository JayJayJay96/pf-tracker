import { describe, expect, it } from 'vitest';

import {
  createFriend,
  createUnresolvedBill,
  resolveBillEqually,
  resolveConfiguredBill,
  type SharedBillWriteRepository,
} from './actions';

function repository(
  overrides: Partial<SharedBillWriteRepository> = {},
): SharedBillWriteRepository {
  return {
    insertFriend: async () => ({ error: null }),
    insertTransaction: async () => ({ error: null }),
    getUnresolvedBill: async () => ({
      data: { id: 'bill-1', amount_sen: 1_001 },
      error: null,
    }),
    saveEqualResolution: async () => ({ error: null }),
    saveResolution: async () => ({ error: null }),
    ...overrides,
  };
}

describe('shared bill actions', () => {
  it('creates an owner-scoped friend', async () => {
    let inserted: unknown;
    await createFriend(repository({
      insertFriend: async (friend) => {
        inserted = friend;
        return { error: null };
      },
    }), 'user-a', ' Alex ');

    expect(inserted).toEqual({ user_id: 'user-a', name: 'Alex' });
  });

  it('records an unresolved bill as a full shared cash outflow', async () => {
    let inserted: unknown;
    await createUnresolvedBill(repository({
      insertTransaction: async (transaction) => {
        inserted = transaction;
        return { error: null };
      },
    }), 'user-a', {
      amount: 'RM10.01',
      description: 'Shared lunch',
      transactionDate: '2026-07-03',
      paymentMethod: 'tng',
    });

    expect(inserted).toEqual({
      user_id: 'user-a',
      amount_sen: 1_001,
      description: 'Shared lunch',
      transaction_date: '2026-07-03',
      payment_method: 'tng',
      transaction_type: 'shared_expense',
      shared_status: 'unresolved',
    });
  });

  it('persists an exact equal split and gives the residual sen to the user', async () => {
    let saved: unknown;
    await resolveBillEqually(repository({
      saveEqualResolution: async (resolution) => {
        saved = resolution;
        return { error: null };
      },
    }), 'user-a', {
      billId: 'bill-1',
      friendId: 'friend-1',
      itemDescription: 'Shared meal',
    });

    expect(saved).toEqual(expect.objectContaining({
      user_id: 'user-a',
      transaction_id: 'bill-1',
      item_description: 'Shared meal',
      amount_sen: 1_001,
      friend_id: 'friend-1',
      user_amount_sen: 501,
      friend_amount_sen: 500,
      item_id: expect.any(String),
      user_participant_id: expect.any(String),
      friend_participant_id: expect.any(String),
    }));
  });

  it('surfaces an atomic resolution failure', async () => {
    await expect(resolveBillEqually(repository({
      saveEqualResolution: async () => ({ error: { message: 'write failed' } }),
    }), 'user-a', {
      billId: 'bill-1',
      friendId: 'friend-1',
      itemDescription: 'Meal',
    })).rejects.toThrow('write failed');
  });

  it('persists a confirmed multi-person allocation with all adjustment modes', async () => {
    let saved: unknown;
    await resolveConfiguredBill(repository({
      getUnresolvedBill: async () => ({
        data: { id: 'bill-1', amount_sen: 1_800 },
        error: null,
      }),
      saveResolution: async (resolution) => {
        saved = resolution;
        return { error: null };
      },
    }), 'user-a', {
      billId: 'bill-1',
      confirmed: true,
      friendIds: ['alex', 'bee'],
      items: [
        {
          description: 'Pizza',
          amount: 'RM10.01',
          discount: 'RM0.01',
          participantIds: ['user', 'alex', 'bee'],
        },
        {
          description: 'Dessert',
          amount: 'RM6.00',
          discount: 'RM0.00',
          participantIds: ['user', 'alex'],
        },
      ],
      adjustments: [
        {
          kind: 'discount',
          amount: 'RM1.00',
          method: 'proportional',
          participantIds: [],
          manualAmounts: {},
        },
        {
          kind: 'discount',
          amount: 'RM0.25',
          method: 'manual',
          participantIds: [],
          manualAmounts: { user: 'RM0.25', alex: 'RM0.00', bee: 'RM0.00' },
        },
        {
          kind: 'service',
          amount: 'RM1.60',
          method: 'proportional',
          participantIds: [],
          manualAmounts: {},
        },
        {
          kind: 'tax',
          amount: 'RM1.66',
          method: 'proportional',
          participantIds: [],
          manualAmounts: {},
        },
        {
          kind: 'rounding',
          amount: '-RM0.01',
          method: 'user',
          participantIds: [],
          manualAmounts: {},
        },
      ],
    });

    expect(saved).toEqual(expect.objectContaining({
      transactionId: 'bill-1',
      items: expect.arrayContaining([
        expect.objectContaining({ description: 'Pizza', amount_sen: 1001, discount_sen: 1 }),
        expect.objectContaining({ description: 'Dessert', amount_sen: 600 }),
      ]),
      adjustments: expect.arrayContaining([
        expect.objectContaining({ adjustment_kind: 'rounding', amount_sen: -1 }),
        expect.objectContaining({ distribution_method: 'manual' }),
      ]),
    }));
    const participants = (saved as {
      participants: Array<{
        participant_kind: string;
        friend_id: string | null;
        amount_sen: number;
      }>;
    }).participants;
    expect(participants).toEqual([
      expect.objectContaining({ participant_kind: 'user', amount_sen: 695 }),
      expect.objectContaining({ friend_id: 'alex', amount_sen: 724 }),
      expect.objectContaining({ friend_id: 'bee', amount_sen: 381 }),
    ]);
  });

  it('rejects an unconfirmed allocation before persistence', async () => {
    let writes = 0;
    await expect(resolveConfiguredBill(repository({
      saveResolution: async () => {
        writes += 1;
        return { error: null };
      },
    }), 'user-a', {
      billId: 'bill-1',
      confirmed: false,
      friendIds: ['alex'],
      items: [{
        description: 'Meal',
        amount: 'RM10.01',
        discount: 'RM0.00',
        participantIds: ['user', 'alex'],
      }],
      adjustments: [],
    })).rejects.toThrow('Confirm the reviewed allocation');
    expect(writes).toBe(0);
  });

  it('uses stable participant ids and friend UUID ordering for an odd cent', async () => {
    const saved: Array<{
      participants: Array<{
        id: string;
        friend_id: string | null;
        amount_sen: number;
      }>;
    }> = [];
    const lowerFriend = '13131313-1313-4131-8131-131313131313';
    const higherFriend = '30303030-3030-4303-8303-303030303030';
    const input = {
      billId: '33333333-3333-4333-8333-333333333333',
      confirmed: true,
      friendIds: [higherFriend, lowerFriend],
      items: [{
        description: 'Odd cent',
        amount: 'RM0.01',
        discount: 'RM0.00',
        participantIds: [higherFriend, lowerFriend],
      }],
      adjustments: [],
    };
    const oddCentRepository = repository({
      getUnresolvedBill: async () => ({
        data: { id: input.billId, amount_sen: 1 },
        error: null,
      }),
      saveResolution: async (resolution) => {
        saved.push(resolution);
        return { error: null };
      },
    });

    await resolveConfiguredBill(oddCentRepository, 'user-a', input);
    await resolveConfiguredBill(oddCentRepository, 'user-a', input);

    expect(saved[0].participants.map(({ id }) => id)).toEqual(
      saved[1].participants.map(({ id }) => id),
    );
    expect(saved[0].participants).toEqual([
      expect.objectContaining({ friend_id: null, amount_sen: 0 }),
      expect.objectContaining({ id: higherFriend, friend_id: higherFriend, amount_sen: 0 }),
      expect.objectContaining({ id: lowerFriend, friend_id: lowerFriend, amount_sen: 1 }),
    ]);
  });
});
