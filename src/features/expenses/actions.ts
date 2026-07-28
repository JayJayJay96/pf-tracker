import { parseRM } from '../../domain/money';
import { getCalendarMonth, type ISODate } from '../../domain/periods';
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

function requireIdentifier(value: string): void {
  if (value.trim() === '') {
    throw new Error('Invalid personal expense');
  }
}

function optionalText(value: string): string | null {
  const normalized = value.trim();
  return normalized === '' ? null : normalized;
}

function parseExpenseInput(input: ExpenseInput): ExpenseValues {
  try {
    const amountSen = parseRM(input.amount);
    const description = input.description.trim();
    const transactionDate = input.transactionDate as ISODate;
    const paymentMethod = input.paymentMethod as PaymentMethod;

    if (
      amountSen === 0
      || description === ''
      || input.categoryId.trim() === ''
      || !['tng', 'cash'].includes(paymentMethod)
    ) {
      throw new Error();
    }
    getCalendarMonth(transactionDate);

    return {
      amount_sen: amountSen,
      description,
      merchant: optionalText(input.merchant),
      transaction_date: transactionDate,
      category_id: input.categoryId,
      payment_method: paymentMethod,
      transaction_type: 'personal_expense',
      notes: optionalText(input.notes),
    };
  } catch {
    throw new Error('Invalid personal expense');
  }
}

function throwWriteError(result: WriteResult): void {
  if (result.error) {
    throw new Error(result.error.message);
  }
}

export async function createExpenseCategory(
  repository: ExpenseWriteRepository,
  userId: string,
  nameInput: string,
): Promise<void> {
  requireIdentifier(userId);
  const name = nameInput.trim();
  if (name === '') {
    throw new Error('Invalid expense category');
  }
  throwWriteError(await repository.insertCategory({
    user_id: userId,
    name,
    type: 'expense',
    is_active: true,
  }));
}

export async function createExpense(
  repository: ExpenseWriteRepository,
  userId: string,
  input: ExpenseInput,
): Promise<void> {
  requireIdentifier(userId);
  throwWriteError(await repository.insertExpense({
    user_id: userId,
    ...parseExpenseInput(input),
  }));
}

export async function updateExpense(
  repository: ExpenseWriteRepository,
  userId: string,
  expenseId: string,
  input: ExpenseInput,
): Promise<void> {
  requireIdentifier(userId);
  requireIdentifier(expenseId);
  throwWriteError(await repository.updateExpense(
    expenseId,
    userId,
    parseExpenseInput(input),
  ));
}

export async function deleteExpense(
  repository: ExpenseWriteRepository,
  userId: string,
  expenseId: string,
): Promise<void> {
  requireIdentifier(userId);
  requireIdentifier(expenseId);
  throwWriteError(await repository.deleteExpense(expenseId, userId));
}
