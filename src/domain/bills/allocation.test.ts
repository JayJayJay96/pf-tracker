import { describe, expect, it } from 'vitest';

import {
  BillAllocationError,
  allocateBill,
} from './allocation';
import type { BillAllocationInput } from './types';

const user = { id: 'user', kind: 'user' as const };
const alex = { id: 'alex', kind: 'friend' as const };
const bee = { id: 'bee', kind: 'friend' as const };

function bill(overrides: Partial<BillAllocationInput> = {}): BillAllocationInput {
  return {
    totalSen: 1_000,
    participants: [user],
    items: [{ id: 'meal', amountSen: 1_000, participantIds: ['user'] }],
    adjustments: [],
    ...overrides,
  };
}

describe('allocateBill', () => {
  it('allocates a one-person bill entirely to the user', () => {
    expect(allocateBill(bill()).portions).toEqual([{ participantId: 'user', amountSen: 1_000 }]);
  });

  it('assigns the residual sen from equal thirds to the user', () => {
    expect(allocateBill(bill({
      totalSen: 1_000,
      participants: [user, alex, bee],
      items: [{
        id: 'pizza',
        amountSen: 1_000,
        participantIds: ['alex', 'user', 'bee'],
      }],
    })).portions).toEqual([
      { participantId: 'user', amountSen: 334 },
      { participantId: 'alex', amountSen: 333 },
      { participantId: 'bee', amountSen: 333 },
    ]);
  });

  it('applies an item discount only to people assigned to that item', () => {
    expect(allocateBill(bill({
      totalSen: 1_400,
      participants: [user, alex],
      items: [
        {
          id: 'shared',
          amountSen: 1_000,
          discountSen: 200,
          participantIds: ['user', 'alex'],
        },
        { id: 'user-only', amountSen: 600, participantIds: ['user'] },
      ],
    })).portions).toEqual([
      { participantId: 'user', amountSen: 1_000 },
      { participantId: 'alex', amountSen: 400 },
    ]);
  });

  it('supports a personal voucher and manual allocation', () => {
    expect(allocateBill(bill({
      totalSen: 1_000,
      participants: [user, alex],
      items: [{
        id: 'meal',
        amountSen: 1_200,
        participantIds: ['user', 'alex'],
      }],
      adjustments: [
        {
          id: 'voucher',
          kind: 'discount',
          amountSen: 100,
          distribution: { method: 'user' },
        },
        {
          id: 'promo',
          kind: 'discount',
          amountSen: 100,
          distribution: {
            method: 'manual',
            amountsSen: { user: 25, alex: 75 },
          },
        },
      ],
    })).portions).toEqual([
      { participantId: 'user', amountSen: 475 },
      { participantId: 'alex', amountSen: 525 },
    ]);
  });

  it('allocates discount, service, and tax proportionally in calculation order', () => {
    expect(allocateBill(bill({
      totalSen: 1_188,
      participants: [user, alex],
      items: [
        { id: 'user-item', amountSen: 600, participantIds: ['user'] },
        { id: 'alex-item', amountSen: 400, participantIds: ['alex'] },
      ],
      adjustments: [
        {
          id: 'discount',
          kind: 'discount',
          amountSen: 100,
          distribution: { method: 'proportional' },
        },
        {
          id: 'service',
          kind: 'service',
          amountSen: 90,
          distribution: { method: 'proportional' },
        },
        {
          id: 'tax',
          kind: 'tax',
          amountSen: 198,
          distribution: { method: 'proportional' },
        },
      ],
    })).portions).toEqual([
      { participantId: 'user', amountSen: 713 },
      { participantId: 'alex', amountSen: 475 },
    ]);
  });

  it('gives a one-sen proportional residual to the user', () => {
    expect(allocateBill(bill({
      totalSen: 101,
      participants: [user, alex],
      items: [
        { id: 'user-item', amountSen: 50, participantIds: ['user'] },
        { id: 'alex-item', amountSen: 50, participantIds: ['alex'] },
      ],
      adjustments: [{
        id: 'rounding',
        kind: 'rounding',
        amountSen: 1,
        distribution: { method: 'proportional' },
      }],
    })).portions).toEqual([
      { participantId: 'user', amountSen: 51 },
      { participantId: 'alex', amountSen: 50 },
    ]);
  });

  it('supports a signed negative rounding adjustment', () => {
    expect(allocateBill(bill({
      totalSen: 99,
      participants: [user, alex],
      items: [{
        id: 'meal',
        amountSen: 100,
        participantIds: ['user', 'alex'],
      }],
      adjustments: [{
        id: 'rounding',
        kind: 'rounding',
        amountSen: -1,
        distribution: { method: 'user' },
      }],
    })).portions).toEqual([
      { participantId: 'user', amountSen: 49 },
      { participantId: 'alex', amountSen: 50 },
    ]);
  });

  it.each([
    {
      name: 'unknown selected participant',
      distribution: { method: 'selected' as const, participantIds: ['alex', 'ghost'] },
    },
    {
      name: 'duplicate selected participant',
      distribution: { method: 'selected' as const, participantIds: ['alex', 'alex'] },
    },
    {
      name: 'unknown equal participant',
      distribution: { method: 'equal' as const, participantIds: ['ghost'] },
    },
  ])('rejects $name', ({ distribution }) => {
    expect(() => allocateBill(bill({
      totalSen: 1_100,
      participants: [user, alex],
      items: [{
        id: 'meal',
        amountSen: 1_000,
        participantIds: ['user', 'alex'],
      }],
      adjustments: [{
        id: 'service',
        kind: 'service',
        amountSen: 100,
        distribution,
      }],
    }))).toThrowError(expect.objectContaining({ code: 'INVALID_BILL' }));
  });

  it('rejects duplicate bill participant identifiers', () => {
    expect(() => allocateBill(bill({
      participants: [user, { ...alex, id: 'user' }],
    }))).toThrowError(expect.objectContaining({ code: 'INVALID_BILL' }));
  });

  it('rejects an item assignment to an unknown participant', () => {
    expect(() => allocateBill(bill({
      items: [{ id: 'meal', amountSen: 1_000, participantIds: ['ghost'] }],
    }))).toThrowError(expect.objectContaining({ code: 'INVALID_BILL' }));
  });

  it('rejects a final total that does not reconcile exactly', () => {
    expect(() => allocateBill(bill({ totalSen: 999 }))).toThrowError(
      expect.objectContaining<Partial<BillAllocationError>>({
        code: 'RECONCILIATION_MISMATCH',
        differenceSen: -1,
      }),
    );
  });
});
