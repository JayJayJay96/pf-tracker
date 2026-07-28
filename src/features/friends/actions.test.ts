import { describe, expect, it } from 'vitest';

import {
  createPaymentRequest,
  settlePaymentRequest,
  type FriendWriteRepository,
} from './actions';

function repository(
  overrides: Partial<FriendWriteRepository> = {},
): FriendWriteRepository {
  return {
    createRequest: async () => ({ data: 'request-1', error: null }),
    transitionRequest: async () => ({ error: null }),
    ...overrides,
  };
}

describe('friend payment request actions', () => {
  it('creates one friend request from distinct selected portions', async () => {
    let command: unknown;
    const requestId = await createPaymentRequest(repository({
      createRequest: async (input) => {
        command = input;
        return { data: 'request-1', error: null };
      },
    }), 'user-a', {
      friendId: 'friend-1',
      portionIds: ['portion-1', 'portion-2'],
      requestDate: '2026-07-18',
      note: ' July ',
    });

    expect(requestId).toBe('request-1');
    expect(command).toEqual({
      userId: 'user-a',
      friendId: 'friend-1',
      portionIds: ['portion-1', 'portion-2'],
      requestDate: '2026-07-18',
      note: 'July',
    });
  });

  it('rejects an empty or duplicate portion selection before persistence', async () => {
    let writes = 0;
    const tracked = repository({
      createRequest: async () => {
        writes += 1;
        return { data: 'request-1', error: null };
      },
    });
    await expect(createPaymentRequest(tracked, 'user-a', {
      friendId: 'friend-1',
      portionIds: [],
      requestDate: '2026-07-18',
      note: '',
    })).rejects.toThrow('Select at least one unrequested portion');
    await expect(createPaymentRequest(tracked, 'user-a', {
      friendId: 'friend-1',
      portionIds: ['portion-1', 'portion-1'],
      requestDate: '2026-07-18',
      note: '',
    })).rejects.toThrow('Invalid payment request');
    expect(writes).toBe(0);
  });

  it('passes the exact full amount when marking a request paid', async () => {
    let command: unknown;
    await settlePaymentRequest(repository({
      transitionRequest: async (input) => {
        command = input;
        return { error: null };
      },
    }), 'user-a', {
      requestId: 'request-1',
      status: 'paid',
      paidAmount: 'RM80.40',
      occurredOn: '2026-07-22',
    });

    expect(command).toEqual({
      userId: 'user-a',
      requestId: 'request-1',
      status: 'paid',
      paidAmountSen: 8_040,
      occurredOn: '2026-07-22',
    });
  });

  it.each(['cancelled', 'forgiven'] as const)(
    'does not create income when a request is %s',
    async (status) => {
      let command: unknown;
      await settlePaymentRequest(repository({
        transitionRequest: async (input) => {
          command = input;
          return { error: null };
        },
      }), 'user-a', {
        requestId: 'request-1',
        status,
        paidAmount: '',
        occurredOn: '2026-07-22',
      });
      expect(command).toEqual(expect.objectContaining({
        status,
        paidAmountSen: null,
      }));
      expect(command).not.toHaveProperty('transaction');
    },
  );
});
