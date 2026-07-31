'use server';

import { revalidatePath } from 'next/cache';

import {
  createExpense,
  createExpenseCategory,
  createStarterCategories,
  deleteExpense,
  updateExpense,
  type ExpenseInput,
} from '../../../src/features/expenses/actions';
import { createExpenseRepository } from '../../../src/features/expenses/supabase-repository';
import type { FormResult } from '../../../src/features/forms/result';
import { requireCurrentUserId } from '../../../src/lib/auth/current-user';
import { createClient } from '../../../src/lib/supabase/server';

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

function readExpenseInput(formData: FormData): ExpenseInput {
  return {
    amount: readString(formData, 'amount'),
    description: readString(formData, 'description'),
    merchant: readString(formData, 'merchant'),
    transactionDate: readString(formData, 'transactionDate'),
    categoryId: readString(formData, 'categoryId'),
    paymentMethod: readString(formData, 'paymentMethod'),
    notes: readString(formData, 'notes'),
  };
}

async function authorizedExpenseContext() {
  const client = await createClient();
  const userId = await requireCurrentUserId(() => client.auth.getClaims());
  return { userId, repository: createExpenseRepository(client) };
}

function revalidateExpenseViews(): void {
  revalidatePath('/expenses');
  revalidatePath('/');
}

/**
 * Runs a mutation and revalidates only when it succeeded, so a rejected form
 * keeps the page — and the values the person typed — exactly as they were.
 */
async function submit(
  run: () => Promise<FormResult>,
  revalidate: () => void,
): Promise<FormResult> {
  const result = await run();
  if (result.status === 'success') {
    revalidate();
  }
  return result;
}

export async function createCategoryAction(
  _previous: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const { repository, userId } = await authorizedExpenseContext();
  return submit(
    () => createExpenseCategory(repository, userId, readString(formData, 'name')),
    () => revalidatePath('/expenses'),
  );
}

/**
 * Takes no arguments on purpose: the set is fixed, so there is nothing to read
 * off the form. A function of fewer parameters still satisfies the action shape
 * the form expects.
 */
export async function createStarterCategoriesAction(): Promise<FormResult> {
  const { repository, userId } = await authorizedExpenseContext();
  return submit(
    () => createStarterCategories(repository, userId),
    () => revalidatePath('/expenses'),
  );
}

export async function createExpenseAction(
  _previous: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const { repository, userId } = await authorizedExpenseContext();
  return submit(
    () => createExpense(repository, userId, readExpenseInput(formData)),
    revalidateExpenseViews,
  );
}

export async function updateExpenseAction(
  _previous: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const { repository, userId } = await authorizedExpenseContext();
  return submit(
    () => updateExpense(
      repository,
      userId,
      readString(formData, 'expenseId'),
      readExpenseInput(formData),
    ),
    revalidateExpenseViews,
  );
}

export async function deleteExpenseAction(
  _previous: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const { repository, userId } = await authorizedExpenseContext();
  return submit(
    () => deleteExpense(repository, userId, readString(formData, 'expenseId')),
    revalidateExpenseViews,
  );
}
