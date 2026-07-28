import { getCalendarMonth } from '../../domain/periods';
import type { PaymentRequestStatus } from '../../domain/requests/state';

type QueryResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

export type FriendReadRepository = {
  listFriends(userId: string): Promise<QueryResult>;
  listPortions(userId: string): Promise<QueryResult>;
  listRequests(userId: string): Promise<QueryResult>;
  listRequestItems(userId: string): Promise<QueryResult>;
};

type PortionStatus = 'unrequested' | 'requested' | 'paid' | 'forgiven';

export type FriendBalance = {
  id: string;
  name: string;
  nickname: string | null;
  phone: string | null;
  notes: string | null;
  active: boolean;
  unrequestedSen: number;
  requestedSen: number;
  paidSen: number;
  forgivenSen: number;
  outstandingSen: number;
  collectedSen: number;
  pendingRequestCount: number;
};

export type LedgerPortion = {
  portionId: string;
  description: string;
  transactionDate: string;
  amountSen: number;
  status: PortionStatus;
  requestId: string | null;
  settledOn: string | null;
};

export type PaymentRequestItem = {
  id: string;
  portionId: string;
  description: string;
  transactionDate: string;
  amountSen: number;
};

export type PaymentRequest = {
  id: string;
  friendId: string;
  totalSen: number;
  requestDate: string;
  status: PaymentRequestStatus;
  note: string | null;
  paidOn: string | null;
  cancelledOn: string | null;
  forgivenOn: string | null;
  items: PaymentRequestItem[];
};

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid friend ledger data');
  }
  return value as Record<string, unknown>;
}

function relatedObject(value: unknown): Record<string, unknown> | null {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation == null ? null : object(relation);
}

function nullableString(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') throw new Error('Invalid friend ledger data');
  return value;
}

function mapFriend(value: unknown): Omit<
  FriendBalance,
  | 'unrequestedSen'
  | 'requestedSen'
  | 'paidSen'
  | 'forgivenSen'
  | 'outstandingSen'
  | 'collectedSen'
  | 'pendingRequestCount'
> {
  const row = object(value);
  if (
    typeof row.id !== 'string'
    || typeof row.name !== 'string'
    || typeof row.active !== 'boolean'
  ) {
    throw new Error('Invalid friend ledger data');
  }
  return {
    id: row.id,
    name: row.name,
    nickname: nullableString(row.nickname),
    phone: nullableString(row.phone),
    notes: nullableString(row.notes),
    active: row.active,
  };
}

function mapPortion(value: unknown): LedgerPortion & { friendId: string } {
  const row = object(value);
  const transaction = relatedObject(row.transactions);
  const settlement = relatedObject(row.friend_portion_settlements);
  if (
    typeof row.id !== 'string'
    || typeof row.friend_id !== 'string'
    || !Number.isSafeInteger(row.amount_sen)
    || (row.amount_sen as number) <= 0
    || !transaction
    || typeof transaction.description !== 'string'
    || typeof transaction.transaction_date !== 'string'
  ) {
    throw new Error('Invalid friend ledger data');
  }
  getCalendarMonth(transaction.transaction_date);
  const status = settlement?.status;
  if (
    !settlement
    || typeof settlement.id !== 'string'
    || !['unrequested', 'requested', 'paid', 'forgiven'].includes(String(status))
  ) {
    throw new Error('Invalid friend ledger data');
  }
  return {
    friendId: row.friend_id,
    portionId: settlement.id,
    description: transaction.description,
    transactionDate: transaction.transaction_date,
    amountSen: row.amount_sen as number,
    status: status as PortionStatus,
    requestId: nullableString(settlement.payment_request_id),
    settledOn: nullableString(settlement.settled_on),
  };
}

function mapRequest(value: unknown): PaymentRequest {
  const row = object(value);
  if (
    typeof row.id !== 'string'
    || typeof row.friend_id !== 'string'
    || !Number.isSafeInteger(row.total_sen)
    || (row.total_sen as number) <= 0
    || typeof row.request_date !== 'string'
    || !['pending', 'paid', 'cancelled', 'forgiven'].includes(String(row.status))
  ) {
    throw new Error('Invalid friend ledger data');
  }
  getCalendarMonth(row.request_date);
  return {
    id: row.id,
    friendId: row.friend_id,
    totalSen: row.total_sen as number,
    requestDate: row.request_date,
    status: row.status as PaymentRequestStatus,
    note: nullableString(row.note),
    paidOn: nullableString(row.paid_on),
    cancelledOn: nullableString(row.cancelled_on),
    forgivenOn: nullableString(row.forgiven_on),
    items: [],
  };
}

function mapRequestItem(value: unknown): PaymentRequestItem & { requestId: string } {
  const row = object(value);
  if (
    typeof row.id !== 'string'
    || typeof row.payment_request_id !== 'string'
    || typeof row.bill_participant_id !== 'string'
    || typeof row.description_snapshot !== 'string'
    || typeof row.transaction_date_snapshot !== 'string'
    || !Number.isSafeInteger(row.amount_sen_snapshot)
    || (row.amount_sen_snapshot as number) <= 0
  ) {
    throw new Error('Invalid friend ledger data');
  }
  getCalendarMonth(row.transaction_date_snapshot);
  return {
    requestId: row.payment_request_id,
    id: row.id,
    portionId: row.bill_participant_id,
    description: row.description_snapshot,
    transactionDate: row.transaction_date_snapshot,
    amountSen: row.amount_sen_snapshot as number,
  };
}

async function readOverview(
  repository: FriendReadRepository,
  userId: string,
): Promise<{
  friends: ReturnType<typeof mapFriend>[];
  portions: ReturnType<typeof mapPortion>[];
  requests: PaymentRequest[];
}> {
  const [friendResult, portionResult, requestResult] = await Promise.all([
    repository.listFriends(userId),
    repository.listPortions(userId),
    repository.listRequests(userId),
  ]);
  const error = friendResult.error ?? portionResult.error ?? requestResult.error;
  if (error) throw new Error(error.message);
  if (!friendResult.data || !portionResult.data || !requestResult.data) {
    throw new Error('Invalid friend ledger data');
  }
  return {
    friends: friendResult.data.map(mapFriend),
    portions: portionResult.data.map(mapPortion),
    requests: requestResult.data.map(mapRequest),
  };
}

export async function getFriendsOverview(
  repository: FriendReadRepository,
  userId: string,
): Promise<FriendBalance[]> {
  const { friends, portions, requests } = await readOverview(repository, userId);
  return friends.map((friend) => {
    const friendPortions = portions.filter(({ friendId }) => friendId === friend.id);
    const sumStatus = (status: PortionStatus) => friendPortions
      .filter((portion) => portion.status === status)
      .reduce((total, portion) => total + portion.amountSen, 0);
    const unrequestedSen = sumStatus('unrequested');
    const requestedSen = sumStatus('requested');
    const paidSen = sumStatus('paid');
    const forgivenSen = sumStatus('forgiven');
    return {
      ...friend,
      unrequestedSen,
      requestedSen,
      paidSen,
      forgivenSen,
      outstandingSen: unrequestedSen + requestedSen,
      collectedSen: paidSen,
      pendingRequestCount: requests.filter((request) => (
        request.friendId === friend.id && request.status === 'pending'
      )).length,
    };
  });
}

export async function getFriendLedger(
  repository: FriendReadRepository,
  userId: string,
  friendId: string,
): Promise<{
  friend: FriendBalance;
  ledger: LedgerPortion[];
  requests: PaymentRequest[];
}> {
  const [overview, requestItemResult] = await Promise.all([
    readOverview(repository, userId),
    repository.listRequestItems(userId),
  ]);
  if (requestItemResult.error) throw new Error(requestItemResult.error.message);
  if (!requestItemResult.data) throw new Error('Invalid friend ledger data');
  const friend = overview.friends.find(({ id }) => id === friendId);
  if (!friend) throw new Error('Friend not found');
  const items = requestItemResult.data.map(mapRequestItem);
  const requests = overview.requests
    .filter((request) => request.friendId === friendId)
    .map((request) => ({
      ...request,
      items: items
        .filter((item) => item.requestId === request.id)
        .map((item) => ({
          id: item.id,
          portionId: item.portionId,
          description: item.description,
          transactionDate: item.transactionDate,
          amountSen: item.amountSen,
        })),
    }));
  const portions = overview.portions.filter((portion) => portion.friendId === friendId);
  const sumStatus = (status: PortionStatus) => portions
    .filter((portion) => portion.status === status)
    .reduce((total, portion) => total + portion.amountSen, 0);
  const unrequestedSen = sumStatus('unrequested');
  const requestedSen = sumStatus('requested');
  const paidSen = sumStatus('paid');
  const forgivenSen = sumStatus('forgiven');
  return {
    friend: {
      ...friend,
      unrequestedSen,
      requestedSen,
      paidSen,
      forgivenSen,
      outstandingSen: unrequestedSen + requestedSen,
      collectedSen: paidSen,
      pendingRequestCount: requests.filter(({ status }) => status === 'pending').length,
    },
    ledger: portions.map((portion) => ({
      portionId: portion.portionId,
      description: portion.description,
      transactionDate: portion.transactionDate,
      amountSen: portion.amountSen,
      status: portion.status,
      requestId: portion.requestId,
      settledOn: portion.settledOn,
    })),
    requests,
  };
}
