import { getCalendarMonth } from '../../domain/periods';

type QueryResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

export type SharedBillReadRepository = {
  listFriends(userId: string): Promise<QueryResult>;
  listBills(userId: string): Promise<QueryResult>;
};

export type Friend = { id: string; name: string };
export type SharedBill = {
  id: string;
  description: string;
  amountSen: number;
  transactionDate: string;
  paymentMethod: 'tng' | 'cash';
  status: 'unresolved' | 'resolved';
  userPortionSen: number;
  friendPortions: Array<{ friendName: string; amountSen: number }>;
};

function row(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') throw new Error('Invalid shared bill data');
  return value as Record<string, unknown>;
}

function mapFriend(value: unknown): Friend {
  const valueRow = row(value);
  if (typeof valueRow.id !== 'string' || typeof valueRow.name !== 'string') {
    throw new Error('Invalid shared bill data');
  }
  return { id: valueRow.id, name: valueRow.name };
}

function mapBill(value: unknown): SharedBill {
  const valueRow = row(value);
  if (
    typeof valueRow.id !== 'string'
    || typeof valueRow.description !== 'string'
    || !Number.isSafeInteger(valueRow.amount_sen)
    || (valueRow.amount_sen as number) <= 0
    || typeof valueRow.transaction_date !== 'string'
    || !['tng', 'cash'].includes(String(valueRow.payment_method))
    || !['unresolved', 'resolved'].includes(String(valueRow.shared_status))
    || !Array.isArray(valueRow.bill_participants)
  ) {
    throw new Error('Invalid shared bill data');
  }
  getCalendarMonth(valueRow.transaction_date);
  let userPortionSen = 0;
  const friendPortions: SharedBill['friendPortions'] = [];
  valueRow.bill_participants.forEach((participant) => {
    const participantRow = row(participant);
    if (
      !['user', 'friend'].includes(String(participantRow.participant_kind))
      || !Number.isSafeInteger(participantRow.amount_sen)
      || (participantRow.amount_sen as number) < 0
    ) throw new Error('Invalid shared bill data');
    if (participantRow.participant_kind === 'user') {
      userPortionSen += participantRow.amount_sen as number;
      return;
    }
    const friendRow = row(
      Array.isArray(participantRow.friends)
        ? participantRow.friends[0]
        : participantRow.friends,
    );
    if (typeof friendRow.name !== 'string') throw new Error('Invalid shared bill data');
    friendPortions.push({
      friendName: friendRow.name,
      amountSen: participantRow.amount_sen as number,
    });
  });

  return {
    id: valueRow.id,
    description: valueRow.description,
    amountSen: valueRow.amount_sen as number,
    transactionDate: valueRow.transaction_date,
    paymentMethod: valueRow.payment_method as SharedBill['paymentMethod'],
    status: valueRow.shared_status as SharedBill['status'],
    userPortionSen,
    friendPortions,
  };
}

export async function getSharedBills(
  repository: SharedBillReadRepository,
  userId: string,
): Promise<{ friends: Friend[]; bills: SharedBill[] }> {
  const [friendResult, billResult] = await Promise.all([
    repository.listFriends(userId),
    repository.listBills(userId),
  ]);
  const error = friendResult.error ?? billResult.error;
  if (error) throw new Error(error.message);
  if (!friendResult.data || !billResult.data) throw new Error('Invalid shared bill data');
  return {
    friends: friendResult.data.map(mapFriend),
    bills: billResult.data.map(mapBill),
  };
}
