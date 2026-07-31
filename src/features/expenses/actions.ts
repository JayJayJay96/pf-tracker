import { AmountInputError, requireAmountInput } from '../../domain/money';
import { getCalendarMonth, type ISODate } from '../../domain/periods';
import {
  failed,
  type FormFieldErrors,
  type FormResult,
  invalid,
  succeeded,
} from '../forms/result';
import type { PaymentMethod } from './types';

type WriteResult = {
  error: { message: string } | null;
};

type ExpenseValues = {
  amount_sen: number;
  description: string;
  merchant: string | null;
  transaction_date: ISODate;
  category_id: string;
  payment_method: PaymentMethod;
  transaction_type: 'personal_expense';
  notes: string | null;
};

type NewExpense = ExpenseValues & {
  user_id: string;
};

export type ExpenseWriteRepository = {
  insertCategory(category: {
    user_id: string;
    name: string;
    type: 'expense';
    is_active: true;
  }): Promise<WriteResult>;
  insertCategories(categories: ReadonlyArray<{
    user_id: string;
    name: string;
    type: 'expense';
    is_active: true;
  }>): Promise<WriteResult>;
  insertExpense(expense: NewExpense): Promise<WriteResult>;
  updateExpense(
    expenseId: string,
    userId: string,
    expense: ExpenseValues,
  ): Promise<WriteResult>;
  deleteExpense(expenseId: string, userId: string): Promise<WriteResult>;
};

export type ExpenseInput = {
  amount: string;
  description: string;
  merchant: string;
  transactionDate: string;
  categoryId: string;
  paymentMethod: string;
  notes: string;
};

function optionalText(value: string): string | null {
  const normalized = value.trim();
  return normalized === '' ? null : normalized;
}

const FIELD_LABELS: Record<string, string> = {
  amount: 'Amount',
  description: 'Description',
  transactionDate: 'Transaction date',
  categoryId: 'Category',
  paymentMethod: 'Payment method',
};

/** Joins field messages into one summary line for the top of the form. */
export function summarizeFieldErrors(fieldErrors: FormFieldErrors): string {
  return Object.entries(fieldErrors)
    .map(([field, message]) => `${FIELD_LABELS[field] ?? field}: ${message}`)
    .join(' ');
}

function readAmountField(raw: string, fieldErrors: FormFieldErrors): number | null {
  try {
    const amountSen = requireAmountInput(raw);
    if (amountSen === 0) {
      fieldErrors.amount = 'Enter an amount greater than zero';
      return null;
    }
    return amountSen;
  } catch (error) {
    fieldErrors.amount = error instanceof AmountInputError
      ? error.message
      : 'Enter an amount, like 12.50';
    return null;
  }
}

type ValidatedExpense =
  | { ok: true; values: ExpenseValues }
  | { ok: false; fieldErrors: FormFieldErrors };

function validateExpenseInput(input: ExpenseInput): ValidatedExpense {
  const fieldErrors: FormFieldErrors = {};
  const amountSen = readAmountField(input.amount, fieldErrors);
  const description = input.description.trim();
  const paymentMethod = input.paymentMethod as PaymentMethod;
  const transactionDate = input.transactionDate as ISODate;

  if (description === '') {
    fieldErrors.description = 'Enter a description';
  }
  if (input.categoryId.trim() === '') {
    fieldErrors.categoryId = 'Choose a category';
  }
  if (!['tng', 'cash'].includes(paymentMethod)) {
    fieldErrors.paymentMethod = 'Choose a payment method';
  }
  try {
    getCalendarMonth(transactionDate);
  } catch {
    fieldErrors.transactionDate = 'Enter a valid date';
  }

  if (amountSen === null || Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    values: {
      amount_sen: amountSen,
      description,
      merchant: optionalText(input.merchant),
      transaction_date: transactionDate,
      category_id: input.categoryId,
      payment_method: paymentMethod,
      transaction_type: 'personal_expense',
      notes: optionalText(input.notes),
    },
  };
}

function writeResultToForm(result: WriteResult): FormResult {
  return result.error ? failed(result.error.message) : succeeded();
}

export async function createExpenseCategory(
  repository: ExpenseWriteRepository,
  userId: string,
  nameInput: string,
): Promise<FormResult> {
  if (userId.trim() === '') {
    return failed('Sign in again to add a category.');
  }
  const name = nameInput.trim();
  if (name === '') {
    return invalid({ name: 'Enter a category name' }, 'Category name: Enter a category name');
  }
  return writeResultToForm(await repository.insertCategory({
    user_id: userId,
    name,
    type: 'expense',
    is_active: true,
  }));
}

/**
 * A starting set of categories, so the first expense can just be recorded.
 *
 * An expense cannot be saved without a category and nothing seeds any, so the
 * very first thing a new owner did was not record a purchase - it was invent a
 * taxonomy. These are only a starting point: they can be added to, and each one
 * is an ordinary category with nothing special about it.
 */
export const STARTER_CATEGORY_NAMES = [
  'Food',
  'Transport',
  'Groceries',
  'Bills',
  'Fun',
] as const;

export async function createStarterCategories(
  repository: ExpenseWriteRepository,
  userId: string,
): Promise<FormResult> {
  if (userId.trim() === '') {
    return failed('Sign in again to add categories.');
  }
  return writeResultToForm(await repository.insertCategories(
    STARTER_CATEGORY_NAMES.map((name) => ({
      user_id: userId,
      name,
      type: 'expense' as const,
      is_active: true as const,
    })),
  ));
}

export async function createExpense(
  repository: ExpenseWriteRepository,
  userId: string,
  input: ExpenseInput,
): Promise<FormResult> {
  if (userId.trim() === '') {
    return failed('Sign in again to save this expense.');
  }
  const validated = validateExpenseInput(input);
  if (!validated.ok) {
    return invalid(validated.fieldErrors, summarizeFieldErrors(validated.fieldErrors));
  }
  return writeResultToForm(await repository.insertExpense({
    user_id: userId,
    ...validated.values,
  }));
}

export async function updateExpense(
  repository: ExpenseWriteRepository,
  userId: string,
  expenseId: string,
  input: ExpenseInput,
): Promise<FormResult> {
  if (userId.trim() === '' || expenseId.trim() === '') {
    return failed('That expense could not be found.');
  }
  const validated = validateExpenseInput(input);
  if (!validated.ok) {
    return invalid(validated.fieldErrors, summarizeFieldErrors(validated.fieldErrors));
  }
  return writeResultToForm(await repository.updateExpense(
    expenseId,
    userId,
    validated.values,
  ));
}

export async function deleteExpense(
  repository: ExpenseWriteRepository,
  userId: string,
  expenseId: string,
): Promise<FormResult> {
  if (userId.trim() === '' || expenseId.trim() === '') {
    return failed('That expense could not be found.');
  }
  return writeResultToForm(await repository.deleteExpense(expenseId, userId));
}
