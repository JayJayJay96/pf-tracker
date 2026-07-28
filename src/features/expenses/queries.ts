import { getCalendarMonth } from '../../domain/periods';
import type {
  Expense,
  ExpenseCategory,
  ExpenseFilters,
  PaymentMethod,
} from './types';

type QueryResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

type RepositoryFilters = Omit<ExpenseFilters, 'search'>;

export type ExpenseReadRepository = {
  listCategories(userId: string): Promise<QueryResult>;
  listExpenses(userId: string, filters: RepositoryFilters): Promise<QueryResult>;
};

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Invalid personal expense data');
  }
  return value as Record<string, unknown>;
}

function mapCategory(value: unknown): ExpenseCategory | null {
  const row = record(value);
  if (
    typeof row.id !== 'string'
    || typeof row.name !== 'string'
    || typeof row.type !== 'string'
    || typeof row.is_active !== 'boolean'
  ) {
    throw new Error('Invalid personal expense data');
  }
  return row.type === 'expense' && row.is_active
    ? { id: row.id, name: row.name }
    : null;
}

function mapExpense(value: unknown): Expense {
  const row = record(value);
  const category = Array.isArray(row.categories)
    ? row.categories[0]
    : row.categories;
  const categoryRow = record(category);

  if (
    typeof row.id !== 'string'
    || !Number.isSafeInteger(row.amount_sen)
    || (row.amount_sen as number) <= 0
    || typeof row.description !== 'string'
    || (row.merchant !== null && typeof row.merchant !== 'string')
    || typeof row.transaction_date !== 'string'
    || typeof row.recorded_at !== 'string'
    || Number.isNaN(Date.parse(row.recorded_at))
    || typeof row.category_id !== 'string'
    || typeof categoryRow.name !== 'string'
    || !['tng', 'cash'].includes(String(row.payment_method))
    || (row.notes !== null && typeof row.notes !== 'string')
  ) {
    throw new Error('Invalid personal expense data');
  }
  getCalendarMonth(row.transaction_date);

  return {
    id: row.id,
    amountSen: row.amount_sen as number,
    description: row.description,
    merchant: row.merchant as string | null,
    transactionDate: row.transaction_date,
    recordedAt: row.recorded_at,
    categoryId: row.category_id,
    categoryName: categoryRow.name,
    paymentMethod: row.payment_method as PaymentMethod,
    notes: row.notes as string | null,
  };
}

function validateFilters(filters: ExpenseFilters): RepositoryFilters {
  if (filters.from) getCalendarMonth(filters.from);
  if (filters.to) getCalendarMonth(filters.to);
  if (filters.from && filters.to && filters.from > filters.to) {
    throw new Error('Invalid personal expense filters');
  }
  if (
    filters.paymentMethod
    && !['tng', 'cash'].includes(filters.paymentMethod)
  ) {
    throw new Error('Invalid personal expense filters');
  }
  return {
    from: filters.from,
    to: filters.to,
    categoryId: filters.categoryId,
    paymentMethod: filters.paymentMethod,
  };
}

export async function getExpenseHistory(
  repository: ExpenseReadRepository,
  userId: string,
  filters: ExpenseFilters,
): Promise<{ categories: ExpenseCategory[]; expenses: Expense[] }> {
  const repositoryFilters = validateFilters(filters);
  const [categoryResult, expenseResult] = await Promise.all([
    repository.listCategories(userId),
    repository.listExpenses(userId, repositoryFilters),
  ]);
  const error = categoryResult.error ?? expenseResult.error;
  if (error) throw new Error(error.message);
  if (!categoryResult.data || !expenseResult.data) {
    throw new Error('Invalid personal expense data');
  }

  const search = filters.search?.trim().toLocaleLowerCase('en-MY');
  const expenses = expenseResult.data.map(mapExpense).filter((expense) => (
    !search
    || expense.description.toLocaleLowerCase('en-MY').includes(search)
    || expense.merchant?.toLocaleLowerCase('en-MY').includes(search)
  ));

  return {
    categories: categoryResult.data
      .map(mapCategory)
      .filter((category): category is ExpenseCategory => category !== null),
    expenses,
  };
}
