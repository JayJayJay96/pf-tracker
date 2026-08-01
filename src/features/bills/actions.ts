import { createHash, randomUUID } from 'node:crypto';

import { allocateBill } from '../../domain/bills/allocation';
import type {
  AdjustmentDistribution,
  BillAdjustment,
  BillItem,
} from '../../domain/bills/types';
import {
  formatAmountInput,
  requireAmountInput,
  requireSignedAmountInput,
} from '../../domain/money';
import { getCalendarMonth, type ISODate } from '../../domain/periods';

/**
 * `code` is Postgres's SQLSTATE, carried through by Supabase. Deletion needs it:
 * a bill whose portions a friend has already been asked to pay is refused by a
 * foreign key rather than by anything this code checks, and that refusal has to
 * be told apart from a real failure so it can be explained rather than reported
 * as "something went wrong".
 */
type WriteResult = { error: { message: string; code?: string } | null };
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
  deleteBill(billId: string, userId: string): Promise<WriteResult>;
  deleteFriend(friendId: string, userId: string): Promise<WriteResult>;
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

/** Postgres foreign key violation. */
const FOREIGN_KEY_VIOLATION = '23503';
/**
 * Raised by the triggers keeping a resolved bill and its split immutable:
 * `prevent_resolved_shared_bill_change` and `prevent_resolved_allocation_change`.
 */
const IMMUTABLE_RECORD = '55000';

/**
 * Removes a shared bill and everything the bill itself owns.
 *
 * The items, participants, assignments and adjustments all cascade from the
 * transaction, so one delete clears the whole bill. What does not cascade is a
 * friend's side of it: once a portion has been put on a payment request or
 * settled, those rows reference the participant directly and the database
 * refuses the delete. That refusal is deliberate - it is the difference between
 * correcting a mistake and erasing a record of money owed - so it is reported as
 * a reason rather than a failure.
 */
export async function deleteSharedBill(
  repository: SharedBillWriteRepository,
  userId: string,
  billId: string,
): Promise<void> {
  const { error } = await repository.deleteBill(
    requireText(billId, 'That shared bill could not be found.'),
    requireText(userId, 'That shared bill could not be found.'),
  );
  if (!error) return;

  if (error.code === FOREIGN_KEY_VIOLATION) {
    throw new Error(
      'This bill has already been requested from a friend, so deleting it would '
      + 'lose a record of what they owe. Cancel the payment request first.',
    );
  }
  /*
   * A split bill is locked by the database on purpose, so deleting one is not a
   * failure to report as such - it is a rule, and the reader needs to know the
   * rule rather than read the trigger's own words.
   */
  if (error.code === IMMUTABLE_RECORD) {
    throw new Error(
      'This bill has already been split, and a split cannot be changed or removed '
      + 'once made. Only a bill that is not split yet can be deleted.',
    );
  }
  throw new Error(error.message);
}

/**
 * Removes a friend.
 *
 * There was no way to do this at all: a name typed wrongly once stayed in the
 * list forever, and appeared in the participant checklist of every bill after it.
 *
 * A friend who is already on a bill cannot be removed, because their portions and
 * any payment requests reference them and do not cascade. That is right - it
 * would otherwise erase who owed what - so the case this serves is the one that
 * needed serving: a friend added by mistake, before any bill involves them.
 */
export async function deleteFriendRecord(
  repository: SharedBillWriteRepository,
  userId: string,
  friendId: string,
): Promise<void> {
  const { error } = await repository.deleteFriend(
    requireText(friendId, 'That friend could not be found.'),
    requireText(userId, 'That friend could not be found.'),
  );
  if (!error) return;

  if (error.code === FOREIGN_KEY_VIOLATION) {
    throw new Error(
      'This friend appears on a bill already, so removing them would lose the '
      + 'record of their share. Delete those bills first if the friend was added '
      + 'by mistake.',
    );
  }
  throw new Error(error.message);
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

export type EvenSplitInput = { billId: string; friendIds: string[] };

/**
 * Splits the whole bill equally between the owner and the chosen friends.
 *
 * This is the common case - a meal shared with someone - and until now the only
 * way to record it was the full editor: name an item, retype the amount, set a
 * discount of zero, tick each person, then confirm a reviewed allocation. Eight
 * or so interactions to say "halves".
 *
 * It delegates to the configured path rather than doing its own arithmetic, so
 * remainders divide by exactly the same audited rules. `confirmed` is set here
 * because pressing this button *is* the confirmation: an even split is entirely
 * predictable from the total, unlike an arbitrary set of items and charges, which
 * is why the editor keeps its review step.
 */
export async function resolveBillEvenly(
  repository: SharedBillWriteRepository,
  userId: string,
  input: EvenSplitInput,
): Promise<void> {
  const ownerId = requireText(userId, 'Invalid shared bill resolution');
  const billId = requireText(input.billId, 'Invalid shared bill resolution');
  if (!Array.isArray(input.friendIds) || input.friendIds.length === 0) {
    throw new Error('Choose at least one friend to split this bill with.');
  }

  const billResult = await repository.getUnresolvedBill(billId, ownerId);
  if (billResult.error) throw new Error(billResult.error.message);
  const bill = billResult.data;
  if (!bill || !Number.isSafeInteger(bill.amount_sen) || bill.amount_sen <= 0) {
    throw new Error('Unresolved shared bill not found');
  }

  return resolveConfiguredBill(repository, ownerId, {
    billId,
    confirmed: true,
    friendIds: input.friendIds,
    items: [{
      description: 'Split evenly',
      amount: formatAmountInput(bill.amount_sen),
      discount: '0.00',
      participantIds: ['user', ...input.friendIds],
    }],
    adjustments: [],
  });
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
