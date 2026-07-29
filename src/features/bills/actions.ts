import { createHash, randomUUID } from 'node:crypto';

import { allocateBill } from '../../domain/bills/allocation';
import type {
  AdjustmentDistribution,
  BillAdjustment,
  BillItem,
} from '../../domain/bills/types';
import { requireAmountInput, requireSignedAmountInput } from '../../domain/money';
import { getCalendarMonth, type ISODate } from '../../domain/periods';

type WriteResult = { error: { message: string } | null };
type ReadResult = {
  data: { id: string; amount_sen: number } | null;
  error: { message: string } | null;
};

type OwnedRow = { user_id: string };
type EqualResolutionRow = OwnedRow & {
  transaction_id: string;
  friend_id: string;
  item_id: string;
  user_participant_id: string;
  friend_participant_id: string;
  item_description: string;
  amount_sen: number;
  user_amount_sen: number;
  friend_amount_sen: number;
};

export type SharedBillWriteRepository = {
  insertFriend(friend: OwnedRow & { name: string }): Promise<WriteResult>;
  insertTransaction(transaction: OwnedRow & {
    amount_sen: number;
    description: string;
    transaction_date: ISODate;
    payment_method: 'tng' | 'cash';
    transaction_type: 'shared_expense';
    shared_status: 'unresolved';
  }): Promise<WriteResult>;
  getUnresolvedBill(billId: string, userId: string): Promise<ReadResult>;
  saveEqualResolution(resolution: EqualResolutionRow): Promise<WriteResult>;
  saveResolution(resolution: PersistedResolution): Promise<WriteResult>;
};

export type UnresolvedBillInput = {
  amount: string;
  description: string;
  transactionDate: string;
  paymentMethod: string;
};

export type EqualResolutionInput = {
  billId: string;
  friendId: string;
  itemDescription: string;
};

export type ConfiguredResolutionInput = {
  billId: string;
  confirmed: boolean;
  friendIds: string[];
  items: Array<{
    description: string;
    amount: string;
    discount: string;
    participantIds: string[];
  }>;
  adjustments: Array<{
    kind: string;
    amount: string;
    method: string;
    participantIds: string[];
    manualAmounts: Record<string, string>;
  }>;
};

type PersistedResolution = {
  transactionId: string;
  items: Array<{
    id: string;
    description: string;
    amount_sen: number;
    discount_sen: number;
    sort_order: number;
  }>;
  participants: Array<{
    id: string;
    participant_kind: 'user' | 'friend';
    friend_id: string | null;
    amount_sen: number;
  }>;
  assignments: Array<{
    item_id: string;
    participant_id: string;
  }>;
  adjustments: Array<{
    id: string;
    adjustment_kind: BillAdjustment['kind'];
    amount_sen: number;
    distribution_method: AdjustmentDistribution['method'];
    allocation: Record<string, unknown>;
    sort_order: number;
  }>;
};

function requireText(value: string, message: string): string {
  const normalized = value.trim();
  if (normalized === '') throw new Error(message);
  return normalized;
}

function throwWriteError(result: WriteResult): void {
  if (result.error) throw new Error(result.error.message);
}

function deterministicUuid(value: string): string {
  const hex = createHash('md5').update(value).digest('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

function participantUuid(billId: string, participantId: string): string {
  return participantId === 'user'
    ? deterministicUuid(`${billId}:user`)
    : participantId;
}

export async function createFriend(
  repository: SharedBillWriteRepository,
  userId: string,
  name: string,
): Promise<void> {
  throwWriteError(await repository.insertFriend({
    user_id: requireText(userId, 'Invalid friend'),
    name: requireText(name, 'Invalid friend'),
  }));
}

export async function createUnresolvedBill(
  repository: SharedBillWriteRepository,
  userId: string,
  input: UnresolvedBillInput,
): Promise<void> {
  try {
    const amountSen = requireAmountInput(input.amount);
    const transactionDate = input.transactionDate as ISODate;
    const paymentMethod = input.paymentMethod as 'tng' | 'cash';
    getCalendarMonth(transactionDate);
    if (
      amountSen <= 0
      || !['tng', 'cash'].includes(paymentMethod)
    ) throw new Error();

    throwWriteError(await repository.insertTransaction({
      user_id: requireText(userId, 'Invalid shared bill'),
      amount_sen: amountSen,
      description: requireText(input.description, 'Invalid shared bill'),
      transaction_date: transactionDate,
      payment_method: paymentMethod,
      transaction_type: 'shared_expense',
      shared_status: 'unresolved',
    }));
  } catch (error) {
    if (error instanceof Error && error.message !== '') throw error;
    throw new Error('Invalid shared bill');
  }
}

export async function resolveBillEqually(
  repository: SharedBillWriteRepository,
  userId: string,
  input: EqualResolutionInput,
): Promise<void> {
  const ownerId = requireText(userId, 'Invalid shared bill resolution');
  const billId = requireText(input.billId, 'Invalid shared bill resolution');
  const friendId = requireText(input.friendId, 'Invalid shared bill resolution');
  const itemDescription = requireText(
    input.itemDescription,
    'Invalid shared bill resolution',
  );
  const billResult = await repository.getUnresolvedBill(billId, ownerId);
  if (billResult.error) throw new Error(billResult.error.message);
  const bill = billResult.data;
  if (
    !bill
    || bill.id !== billId
    || !Number.isSafeInteger(bill.amount_sen)
    || bill.amount_sen <= 0
  ) {
    throw new Error('Unresolved shared bill not found');
  }

  const userParticipantId = participantUuid(billId, 'user');
  const friendParticipantId = participantUuid(billId, friendId);
  const itemId = randomUUID();
  const allocation = allocateBill({
    totalSen: bill.amount_sen,
    participants: [
      { id: userParticipantId, kind: 'user' },
      { id: friendParticipantId, kind: 'friend' },
    ],
    items: [{
      id: itemId,
      amountSen: bill.amount_sen,
      participantIds: [userParticipantId, friendParticipantId],
    }],
    adjustments: [],
  });
  const portion = new Map(
    allocation.portions.map(({ participantId, amountSen }) => (
      [participantId, amountSen]
    )),
  );

  throwWriteError(await repository.saveEqualResolution({
    user_id: ownerId,
    transaction_id: billId,
    friend_id: friendId,
    item_id: itemId,
    user_participant_id: userParticipantId,
    friend_participant_id: friendParticipantId,
    item_description: itemDescription,
    amount_sen: bill.amount_sen,
    user_amount_sen: portion.get(userParticipantId) ?? 0,
    friend_amount_sen: portion.get(friendParticipantId) ?? 0,
  }));
}

export async function resolveConfiguredBill(
  repository: SharedBillWriteRepository,
  userId: string,
  input: ConfiguredResolutionInput,
): Promise<void> {
  const ownerId = requireText(userId, 'Invalid shared bill resolution');
  const billId = requireText(input.billId, 'Invalid shared bill resolution');
  if (!input.confirmed) throw new Error('Confirm the reviewed allocation');
  if (
    !Array.isArray(input.friendIds)
    || !Array.isArray(input.items)
    || !Array.isArray(input.adjustments)
    || new Set(input.friendIds).size !== input.friendIds.length
    || input.friendIds.some((id) => id.trim() === '' || id === 'user')
    || input.items.length === 0
  ) {
    throw new Error('Invalid shared bill resolution');
  }
  const billResult = await repository.getUnresolvedBill(billId, ownerId);
  if (billResult.error) throw new Error(billResult.error.message);
  const bill = billResult.data;
  if (!bill || !Number.isSafeInteger(bill.amount_sen) || bill.amount_sen <= 0) {
    throw new Error('Unresolved shared bill not found');
  }

  const participantIds = ['user', ...input.friendIds];
  const participantUuids = new Map(
    participantIds.map((id) => [id, participantUuid(billId, id)]),
  );
  const itemUuid = new Map<number, string>();
  const items: BillItem[] = input.items.map((item, index) => {
    itemUuid.set(index, randomUUID());
    return {
      id: String(index),
      amountSen: requireAmountInput(item.amount),
      discountSen: requireAmountInput(item.discount),
      participantIds: item.participantIds,
    };
  });
  const adjustmentUuid = new Map<number, string>();
  const adjustments: BillAdjustment[] = input.adjustments.map((adjustment, index) => {
    adjustmentUuid.set(index, randomUUID());
    if (!['discount', 'service', 'tax', 'rounding'].includes(adjustment.kind)) {
      throw new Error('Invalid shared bill resolution');
    }
    const kind = adjustment.kind as BillAdjustment['kind'];
    const amountSen = kind === 'rounding'
      ? requireSignedAmountInput(adjustment.amount)
      : requireAmountInput(adjustment.amount);
    let distribution: AdjustmentDistribution;
    switch (adjustment.method) {
      case 'proportional':
        distribution = { method: 'proportional' };
        break;
      case 'equal':
        distribution = adjustment.participantIds.length > 0
          ? { method: 'equal', participantIds: adjustment.participantIds }
          : { method: 'equal' };
        break;
      case 'selected':
        distribution = {
          method: 'selected',
          participantIds: adjustment.participantIds,
        };
        break;
      case 'user':
        distribution = { method: 'user' };
        break;
      case 'manual':
        distribution = {
          method: 'manual',
          amountsSen: Object.fromEntries(
            Object.entries(adjustment.manualAmounts).map(([id, amount]) => (
              [id, requireAmountInput(amount)]
            )),
          ),
        };
        break;
      default:
        throw new Error('Invalid shared bill resolution');
    }
    return { id: String(index), kind, amountSen, distribution };
  });

  const allocation = allocateBill({
    totalSen: bill.amount_sen,
    participants: participantIds.map((id) => ({
      id,
      kind: id === 'user' ? 'user' as const : 'friend' as const,
    })),
    items,
    adjustments,
  });
  const portions = new Map(
    allocation.portions.map(({ participantId, amountSen }) => (
      [participantId, amountSen]
    )),
  );

  const persisted: PersistedResolution = {
    transactionId: billId,
    items: input.items.map((item, index) => ({
      id: itemUuid.get(index)!,
      description: requireText(item.description, 'Invalid shared bill resolution'),
      amount_sen: items[index].amountSen,
      discount_sen: items[index].discountSen ?? 0,
      sort_order: index,
    })),
    participants: participantIds.map((id) => ({
      id: participantUuids.get(id)!,
      participant_kind: id === 'user' ? 'user' : 'friend',
      friend_id: id === 'user' ? null : id,
      amount_sen: portions.get(id) ?? 0,
    })),
    assignments: input.items.flatMap((item, index) => (
      item.participantIds.map((participantId) => ({
        item_id: itemUuid.get(index)!,
        participant_id: participantUuids.get(participantId) ?? '',
      }))
    )),
    adjustments: adjustments.map((adjustment, index) => {
      let persistedAllocation: Record<string, unknown> = {};
      if (
        adjustment.distribution.method === 'selected'
        || (
          adjustment.distribution.method === 'equal'
          && adjustment.distribution.participantIds
        )
      ) {
        persistedAllocation = {
          participantIds: (adjustment.distribution.participantIds ?? []).map(
            (id) => participantUuids.get(id) ?? '',
          ),
        };
      } else if (adjustment.distribution.method === 'manual') {
        persistedAllocation = {
          amountsSen: Object.fromEntries(
            Object.entries(adjustment.distribution.amountsSen).map(([id, amount]) => (
              [participantUuids.get(id) ?? '', amount]
            )),
          ),
        };
      }
      return {
        id: adjustmentUuid.get(index)!,
        adjustment_kind: adjustment.kind,
        amount_sen: adjustment.amountSen,
        distribution_method: adjustment.distribution.method,
        allocation: persistedAllocation,
        sort_order: index,
      };
    }),
  };
  throwWriteError(await repository.saveResolution(persisted));
}
