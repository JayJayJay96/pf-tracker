import { getCalendarMonth, type ISODate } from '../../domain/periods';
import type { PaymentMethod } from '../expenses/types';

type QueryResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

export type TransactionTypeFilter = 'personal' | 'shared';
export type SharedStatusFilter = 'unresolved' | 'resolved';
export type RequestStatusFilter = 'unrequested' | 'requested' | 'paid' | 'forgiven';
export type TransactionSort = 'date' | 'amount' | 'newest' | 'friend_outstanding';

export type TransactionFilters = {
  search?: string;
  from?: ISODate;
  to?: ISODate;
  categoryId?: string;
  paymentMethod?: PaymentMethod;
  type?: TransactionTypeFilter;
  sharedStatus?: SharedStatusFilter;
  friendId?: string;
  requestStatus?: RequestStatusFilter;
  sort: TransactionSort;
};

export type TransactionHistoryReadRepository = {
  listCategories(userId: string): Promise<QueryResult>;
  listFriends(userId: string): Promise<QueryResult>;
  listTransactions(userId: string, filters: TransactionFilters): Promise<QueryResult>;
};

export type TransactionFilterOption = {
  id: string;
  name: string;
};

export type TransactionFriendPortion = {
  friendId: string;
  friendName: string;
  amountSen: number;
  status: RequestStatusFilter;
  requestId: string | null;
};

export type TransactionHistoryItem = {
  id: string;
  description: string;
  merchant: string | null;
  amountSen: number;
  transactionDate: ISODate;
  recordedAt: string;
  categoryId: string | null;
  categoryName: string | null;
  paymentMethod: PaymentMethod;
  type: 'personal_expense' | 'shared_expense';
  sharedStatus: SharedStatusFilter | null;
  userPortionSen: number;
  friendOutstandingSen: number;
  friendPortions: TransactionFriendPortion[];
};

export type TransactionHistory = {
  categories: TransactionFilterOption[];
  friends: TransactionFilterOption[];
  transactions: TransactionHistoryItem[];
};

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid transaction history data');
  }
  return value as Record<string, unknown>;
}

function related(value: unknown): Record<string, unknown> | null {
  const selected = Array.isArray(value) ? value[0] : value;
  return selected == null ? null : object(selected);
}

function positiveInteger(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new Error('Invalid transaction history data');
  }
  return value as number;
}

function nonNegativeInteger(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error('Invalid transaction history data');
  }
  return value as number;
}

function isoDate(value: unknown): ISODate {
  if (typeof value !== 'string') throw new Error('Invalid transaction history data');
  getCalendarMonth(value);
  return value;
}

function mapOption(value: unknown): TransactionFilterOption {
  const row = object(value);
  if (typeof row.id !== 'string' || typeof row.name !== 'string') {
    throw new Error('Invalid transaction history data');
  }
  return { id: row.id, name: row.name };
}

function mapFriendPortion(value: unknown): {
  kind: 'user' | 'friend';
  amountSen: number;
  friendPortion: TransactionFriendPortion | null;
} {
  const row = object(value);
  const kind = row.participant_kind;
  if (kind !== 'user' && kind !== 'friend') {
    throw new Error('Invalid transaction history data');
  }
  const amountSen = nonNegativeInteger(row.amount_sen);
  if (kind === 'user') {
    return { kind, amountSen, friendPortion: null };
  }

  const friend = related(row.friends);
  const settlement = related(row.friend_portion_settlements);
  const status = settlement?.status;
  const requestId = settlement?.payment_request_id;
  if (
    typeof row.friend_id !== 'string'
    || !friend
    || typeof friend.name !== 'string'
    || !['unrequested', 'requested', 'paid', 'forgiven'].includes(String(status))
    || (requestId != null && typeof requestId !== 'string')
  ) {
    throw new Error('Invalid transaction history data');
  }
  return {
    kind,
    amountSen,
    friendPortion: {
      friendId: row.friend_id,
      friendName: friend.name,
      amountSen,
      status: status as RequestStatusFilter,
      requestId: typeof requestId === 'string' ? requestId : null,
    },
  };
}

function mapTransaction(value: unknown): TransactionHistoryItem {
  const row = object(value);
  const type = String(row.transaction_type);
  const sharedStatus = row.shared_status;
  const category = related(row.categories);
  if (
    typeof row.id !== 'string'
    || typeof row.description !== 'string'
    || (row.merchant != null && typeof row.merchant !== 'string')
    || typeof row.recorded_at !== 'string'
    || !['tng', 'cash'].includes(String(row.payment_method))
    || !['personal_expense', 'shared_expense'].includes(type)
    || !Array.isArray(row.bill_participants)
  ) {
    throw new Error('Invalid transaction history data');
  }
  if (
    type === 'personal_expense'
      ? (
        typeof row.category_id !== 'string'
        || !category
        || typeof category.name !== 'string'
        || sharedStatus !== null
      )
      : (
        row.category_id !== null
        || category !== null
        || !['unresolved', 'resolved'].includes(String(sharedStatus))
      )
  ) {
    throw new Error('Invalid transaction history data');
  }

  const participants = row.bill_participants.map(mapFriendPortion);
  const friendPortions = participants.flatMap(({ friendPortion }) => (
    friendPortion ? [friendPortion] : []
  ));
  return {
    id: row.id,
    description: row.description,
    merchant: row.merchant as string | null,
    amountSen: positiveInteger(row.amount_sen),
    transactionDate: isoDate(row.transaction_date),
    recordedAt: row.recorded_at,
    categoryId: type === 'personal_expense' ? row.category_id as string : null,
    categoryName: type === 'personal_expense' ? category!.name as string : null,
    paymentMethod: row.payment_method as PaymentMethod,
    type: type as TransactionHistoryItem['type'],
    sharedStatus: type === 'shared_expense'
      ? sharedStatus as SharedStatusFilter
      : null,
    userPortionSen: type === 'personal_expense'
      ? row.amount_sen as number
      : participants
        .filter(({ kind }) => kind === 'user')
        .reduce((total, participant) => total + participant.amountSen, 0),
    friendOutstandingSen: friendPortions
      .filter(({ status }) => status === 'unrequested' || status === 'requested')
      .reduce((total, portion) => total + portion.amountSen, 0),
    friendPortions,
  };
}

function matchesFilters(
  transaction: TransactionHistoryItem,
  filters: TransactionFilters,
): boolean {
  const search = filters.search?.trim().toLocaleLowerCase('en-MY');
  if (
    search
    && !transaction.description.toLocaleLowerCase('en-MY').includes(search)
    && !transaction.merchant?.toLocaleLowerCase('en-MY').includes(search)
  ) return false;
  if (filters.from && transaction.transactionDate < filters.from) return false;
  if (filters.to && transaction.transactionDate > filters.to) return false;
  if (filters.categoryId && transaction.categoryId !== filters.categoryId) return false;
  if (
    filters.paymentMethod
    && transaction.paymentMethod !== filters.paymentMethod
  ) return false;
  if (
    filters.type
    && transaction.type !== `${filters.type}_expense`
  ) return false;
  if (
    filters.sharedStatus
    && transaction.sharedStatus !== filters.sharedStatus
  ) return false;

  if (filters.friendId || filters.requestStatus) {
    return transaction.friendPortions.some((portion) => (
      (!filters.friendId || portion.friendId === filters.friendId)
      && (!filters.requestStatus || portion.status === filters.requestStatus)
    ));
  }
  return true;
}

function sortTransactions(
  transactions: TransactionHistoryItem[],
  sort: TransactionSort,
): TransactionHistoryItem[] {
  return [...transactions].sort((left, right) => {
    switch (sort) {
      case 'amount':
        return right.amountSen - left.amountSen
          || right.transactionDate.localeCompare(left.transactionDate);
      case 'newest':
        return right.recordedAt.localeCompare(left.recordedAt)
          || right.transactionDate.localeCompare(left.transactionDate);
      case 'friend_outstanding':
        return right.friendOutstandingSen - left.friendOutstandingSen
          || right.transactionDate.localeCompare(left.transactionDate);
      case 'date':
        return right.transactionDate.localeCompare(left.transactionDate)
          || right.recordedAt.localeCompare(left.recordedAt);
    }
  });
}

export async function getTransactionHistory(
  repository: TransactionHistoryReadRepository,
  userId: string,
  filters: TransactionFilters,
): Promise<TransactionHistory> {
  if (userId.trim() === '') throw new Error('Invalid transaction history owner');
  const [categoryResult, friendResult, transactionResult] = await Promise.all([
    repository.listCategories(userId),
    repository.listFriends(userId),
    repository.listTransactions(userId, filters),
  ]);
  const error = categoryResult.error ?? friendResult.error ?? transactionResult.error;
  if (error) throw new Error(error.message);
  if (!categoryResult.data || !friendResult.data || !transactionResult.data) {
    throw new Error('Invalid transaction history data');
  }
  return {
    categories: categoryResult.data.map(mapOption),
    friends: friendResult.data.map(mapOption),
    transactions: sortTransactions(
      transactionResult.data.map(mapTransaction).filter((transaction) => (
        matchesFilters(transaction, filters)
      )),
      filters.sort,
    ),
  };
}
