import { redirect } from 'next/navigation';

import { ExpenseView } from '../../../src/features/expenses/expense-view';
import { getExpenseHistory } from '../../../src/features/expenses/queries';
import { createExpenseRepository } from '../../../src/features/expenses/supabase-repository';
import type { ExpenseFilters } from '../../../src/features/expenses/types';
import { getCurrentUserId } from '../../../src/lib/auth/current-user';
import { createClient } from '../../../src/lib/supabase/server';

import {
  createCategoryAction,
  createExpenseAction,
  deleteExpenseAction,
  updateExpenseAction,
} from './actions';

type ExpensePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string | undefined {
  const selected = Array.isArray(value) ? value[0] : value;
  return selected || undefined;
}

function todayInMalaysia(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export default async function ExpensesPage({ searchParams }: ExpensePageProps) {
  const params = await searchParams;
  const filters: ExpenseFilters = {
    search: first(params.search),
    from: first(params.from),
    to: first(params.to),
    categoryId: first(params.categoryId),
    paymentMethod: first(params.paymentMethod),
  };
  const client = await createClient();
  const userId = await getCurrentUserId(() => client.auth.getClaims());
  if (!userId) redirect('/auth/sign-in');
  const history = await getExpenseHistory(
    createExpenseRepository(client),
    userId,
    filters,
  );

  return (
    <ExpenseView
      categories={history.categories}
      expenses={history.expenses}
      filters={filters}
      defaultTransactionDate={todayInMalaysia()}
      userId={userId}
      actions={{
        createCategory: createCategoryAction,
        create: createExpenseAction,
        update: updateExpenseAction,
        delete: deleteExpenseAction,
      }}
    />
  );
}
