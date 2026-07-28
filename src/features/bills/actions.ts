import { randomUUID } from 'node:crypto';

import { allocateBill } from '../../domain/bills/allocation';
import { parseRM } from '../../domain/money';
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

function requireText(value: string, message: string): string {
  const normalized = value.trim();
  if (normalized === '') throw new Error(message);
  return normalized;
}

function throwWriteError(result: WriteResult): void {
  if (result.error) throw new Error(result.error.message);
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
    const amountSen = parseRM(input.amount);
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

  const userParticipantId = randomUUID();
  const friendParticipantId = randomUUID();
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
