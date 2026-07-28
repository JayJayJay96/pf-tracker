'use server';

import { revalidatePath } from 'next/cache';

import {
  createExpense,
  createExpenseCategory,
  deleteExpense,
  updateExpense,
  type ExpenseInput,
} from '../../../src/features/expenses/actions';
import { createExpenseRepository } from '../../../src/features/expenses/supabase-repository';
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

export async function createCategoryAction(formData: FormData): Promise<void> {
  const { repository, userId } = await authorizedExpenseContext();
  await createExpenseCategory(repository, userId, readString(formData, 'name'));
  revalidatePath('/expenses');
}

export async function createExpenseAction(formData: FormData): Promise<void> {
  const { repository, userId } = await authorizedExpenseContext();
  await createExpense(repository, userId, readExpenseInput(formData));
  revalidateExpenseViews();
}

export async function updateExpenseAction(formData: FormData): Promise<void> {
  const { repository, userId } = await authorizedExpenseContext();
  await updateExpense(
    repository,
    userId,
    readString(formData, 'expenseId'),
    readExpenseInput(formData),
  );
  revalidateExpenseViews();
}

export async function deleteExpenseAction(formData: FormData): Promise<void> {
  const { repository, userId } = await authorizedExpenseContext();
  await deleteExpense(repository, userId, readString(formData, 'expenseId'));
  revalidateExpenseViews();
}
