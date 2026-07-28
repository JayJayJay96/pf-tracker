import { redirect } from 'next/navigation';

import { getCalendarMonth, type ISODate } from '../../../src/domain/periods';
import {
  getTransactionHistory,
  type RequestStatusFilter,
  type SharedStatusFilter,
  type TransactionFilters,
  type TransactionSort,
  type TransactionTypeFilter,
} from '../../../src/features/transactions/queries';
import { createTransactionHistoryRepository } from '../../../src/features/transactions/supabase-repository';
import { TransactionHistoryView } from '../../../src/features/transactions/transaction-history-view';
import { getCurrentUserId } from '../../../src/lib/auth/current-user';
import { createClient } from '../../../src/lib/supabase/server';

type TransactionsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string | undefined {
  const selected = Array.isArray(value) ? value[0] : value;
  return selected?.trim() || undefined;
}

function choice<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | undefined {
  return allowed.includes(value as T) ? value as T : undefined;
}

function date(value: string | undefined): ISODate | undefined {
  if (!value) return undefined;
  try {
    getCalendarMonth(value);
    return value;
  } catch {
    return undefined;
  }
}

function filtersFrom(
  params: Record<string, string | string[] | undefined>,
): TransactionFilters {
  return {
    search: first(params.search),
    from: date(first(params.from)),
    to: date(first(params.to)),
    categoryId: first(params.categoryId),
    paymentMethod: choice(first(params.paymentMethod), ['tng', 'cash'] as const),
    type: choice<TransactionTypeFilter>(
      first(params.type),
      ['personal', 'shared'],
    ),
    sharedStatus: choice<SharedStatusFilter>(
      first(params.sharedStatus),
      ['unresolved', 'resolved'],
    ),
    friendId: first(params.friendId),
    requestStatus: choice<RequestStatusFilter>(
      first(params.requestStatus),
      ['unrequested', 'requested', 'paid', 'forgiven'],
    ),
    sort: choice<TransactionSort>(
      first(params.sort),
      ['date', 'amount', 'newest', 'friend_outstanding'],
    ) ?? 'date',
  };
}

export default async function TransactionsPage({ searchParams }: TransactionsPageProps) {
  const filters = filtersFrom(await searchParams);
  const client = await createClient();
  const userId = await getCurrentUserId(() => client.auth.getClaims());
  if (!userId) redirect('/auth/sign-in');
  const history = await getTransactionHistory(
    createTransactionHistoryRepository(client),
    userId,
    filters,
  );
  return <TransactionHistoryView history={history} filters={filters} />;
}
