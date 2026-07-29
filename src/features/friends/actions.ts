import { requireAmountInput } from '../../domain/money';
import { getCalendarMonth, type ISODate } from '../../domain/periods';
import type { PaymentRequestStatus } from '../../domain/requests/state';

type WriteError = { message: string };

export type CreateRequestCommand = {
  userId: string;
  friendId: string;
  portionIds: string[];
  requestDate: ISODate;
  note: string | null;
};

export type TransitionRequestCommand = {
  userId: string;
  requestId: string;
  status: Exclude<PaymentRequestStatus, 'pending'>;
  paidAmountSen: number | null;
  occurredOn: ISODate;
};

export type FriendWriteRepository = {
  createRequest(command: CreateRequestCommand): Promise<{
    data: string | null;
    error: WriteError | null;
  }>;
  transitionRequest(command: TransitionRequestCommand): Promise<{
    error: WriteError | null;
  }>;
};

export type CreatePaymentRequestInput = {
  friendId: string;
  portionIds: string[];
  requestDate: string;
  note: string;
};

export type SettlePaymentRequestInput = {
  requestId: string;
  status: Exclude<PaymentRequestStatus, 'pending'>;
  paidAmount: string;
  occurredOn: string;
};

function required(value: string): string {
  const normalized = value.trim();
  if (normalized === '') throw new Error('Invalid payment request');
  return normalized;
}

function date(value: string): ISODate {
  const normalized = value as ISODate;
  getCalendarMonth(normalized);
  return normalized;
}

export async function createPaymentRequest(
  repository: FriendWriteRepository,
  userId: string,
  input: CreatePaymentRequestInput,
): Promise<string> {
  if (input.portionIds.length === 0) {
    throw new Error('Select at least one unrequested portion');
  }
  if (
    new Set(input.portionIds).size !== input.portionIds.length
    || input.portionIds.some((portionId) => portionId.trim() === '')
  ) {
    throw new Error('Invalid payment request');
  }
  const result = await repository.createRequest({
    userId: required(userId),
    friendId: required(input.friendId),
    portionIds: input.portionIds,
    requestDate: date(input.requestDate),
    note: input.note.trim() || null,
  });
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error('Payment request was not created');
  return result.data;
}

export async function settlePaymentRequest(
  repository: FriendWriteRepository,
  userId: string,
  input: SettlePaymentRequestInput,
): Promise<void> {
  if (!['paid', 'cancelled', 'forgiven'].includes(input.status)) {
    throw new Error('Invalid payment request');
  }
  const result = await repository.transitionRequest({
    userId: required(userId),
    requestId: required(input.requestId),
    status: input.status,
    paidAmountSen: input.status === 'paid'
      ? requireAmountInput(input.paidAmount)
      : null,
    occurredOn: date(input.occurredOn),
  });
  if (result.error) throw new Error(result.error.message);
}
