import { describe, expect, it } from 'vitest';

import {
  createFriend,
  createUnresolvedBill,
  resolveBillEqually,
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
});
