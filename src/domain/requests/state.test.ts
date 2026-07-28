import { describe, expect, it } from 'vitest';

import { transitionPaymentRequest } from './state';

describe('payment request transitions', () => {
  it.each(['paid', 'cancelled', 'forgiven'] as const)(
    'allows a pending request to become %s',
    (nextStatus) => {
      expect(transitionPaymentRequest({
        currentStatus: 'pending',
        nextStatus,
        totalSen: 8_040,
        paidAmountSen: nextStatus === 'paid' ? 8_040 : undefined,
      })).toBe(nextStatus);
    },
  );

  it('rejects a partial or excess payment', () => {
    expect(() => transitionPaymentRequest({
      currentStatus: 'pending',
      nextStatus: 'paid',
      totalSen: 8_040,
      paidAmountSen: 8_000,
    })).toThrow('Payment must match the full requested amount');
    expect(() => transitionPaymentRequest({
      currentStatus: 'pending',
      nextStatus: 'paid',
      totalSen: 8_040,
      paidAmountSen: 8_100,
    })).toThrow('Payment must match the full requested amount');
  });

  it.each(['paid', 'cancelled', 'forgiven'] as const)(
    'rejects transitions from terminal status %s',
    (currentStatus) => {
      expect(() => transitionPaymentRequest({
        currentStatus,
        nextStatus: 'cancelled',
        totalSen: 8_040,
      })).toThrow('Payment request is already settled');
    },
  );
});
