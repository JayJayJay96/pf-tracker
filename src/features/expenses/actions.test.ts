import { describe, expect, it } from 'vitest';

import {
  createExpenseCategory,
  createExpense,
  deleteExpense,
  updateExpense,
  type ExpenseWriteRepository,
} from './actions';

function repository(overrides: Partial<ExpenseWriteRepository> = {}): ExpenseWriteRepository {
  return {
    insertCategory: async () => ({ error: null }),
    insertExpense: async () => ({ error: null }),
    updateExpense: async () => ({ error: null }),
    deleteExpense: async () => ({ error: null }),
    ...overrides,
  };
}

const validInput = {
  amount: 'RM12.50',
  description: 'Backdated lunch',
  merchant: 'Kopitiam',
  transactionDate: '2026-06-30',
  categoryId: 'category-food',
  paymentMethod: 'tng',
  notes: 'Forgotten yesterday',
};

describe('personal expense actions', () => {
  it('creates an owner-scoped expense category', async () => {
    let inserted: unknown;

    await createExpenseCategory(repository({
      insertCategory: async (category) => {
        inserted = category;
        return { error: null };
      },
    }), 'user-a', ' Food ');

    expect(inserted).toEqual({
      user_id: 'user-a',
      name: 'Food',
      type: 'expense',
      is_active: true,
    });
  });

  it('creates an owner-scoped personal expense using exact sen', async () => {
    let inserted: unknown;

    await createExpense(repository({
      insertExpense: async (expense) => {
        inserted = expense;
        return { error: null };
      },
    }), 'user-a', validInput);

    expect(inserted).toEqual({
      user_id: 'user-a',
      amount_sen: 1250,
      description: 'Backdated lunch',
      merchant: 'Kopitiam',
      transaction_date: '2026-06-30',
      category_id: 'category-food',
      payment_method: 'tng',
      transaction_type: 'personal_expense',
      notes: 'Forgotten yesterday',
    });
  });

  it('normalizes blank optional merchant and notes to null', async () => {
    let inserted: { merchant?: string | null; notes?: string | null } | undefined;

    await createExpense(repository({
      insertExpense: async (expense) => {
        inserted = expense;
        return { error: null };
      },
    }), 'user-a', { ...validInput, merchant: ' ', notes: '' });

    expect(inserted).toMatchObject({ merchant: null, notes: null });
  });

  it.each([
    ['12.50', 1250],
    ['12.5', 1250],
    ['12', 1200],
    ['1,250.75', 125075],
    ['RM12.50', 1250],
  ])('accepts %s typed without an RM prefix', async (amount, expectedSen) => {
    let inserted: { amount_sen?: number } | undefined;

    const result = await createExpense(repository({
      insertExpense: async (expense) => {
        inserted = expense;
        return { error: null };
      },
    }), 'user-a', { ...validInput, amount });

    expect(result.status).toBe('success');
    expect(inserted).toMatchObject({ amount_sen: expectedSen });
  });

  it.each([
    [{ ...validInput, amount: '0.00' }, 'amount', 'Enter an amount greater than zero'],
    [{ ...validInput, amount: 'twelve' }, 'amount', 'Enter a number, like 12.50'],
    [
      { ...validInput, amount: '12.505' },
      'amount',
      'Use at most 2 decimal places, like 12.50',
    ],
    [{ ...validInput, description: ' ' }, 'description', 'Enter a description'],
    [
      { ...validInput, transactionDate: '2026-02-30' },
      'transactionDate',
      'Enter a valid date',
    ],
    [{ ...validInput, categoryId: '' }, 'categoryId', 'Choose a category'],
    [
      { ...validInput, paymentMethod: 'card' },
      'paymentMethod',
      'Choose a payment method',
    ],
  ])('reports the problem against its own field without writing', async (
    input,
    field,
    message,
  ) => {
    let writes = 0;

    const result = await createExpense(repository({
      insertExpense: async () => {
        writes += 1;
        return { error: null };
      },
    }), 'user-a', input);

    // A rejection is a value, not a thrown error: throwing would reach the route
    // error boundary and discard everything the person had typed.
    expect(result).toMatchObject({
      status: 'error',
      fieldErrors: { [field]: message },
    });
    expect(writes).toBe(0);
  });

  it('reports every invalid field at once', async () => {
    const result = await createExpense(repository(), 'user-a', {
      ...validInput,
      amount: '',
      description: '',
      categoryId: '',
    });

    expect(result).toMatchObject({
      status: 'error',
      fieldErrors: {
        amount: 'Enter an amount',
        description: 'Enter a description',
        categoryId: 'Choose a category',
      },
    });
  });

  it('surfaces a write failure as a form-level message', async () => {
    const result = await createExpense(repository({
      insertExpense: async () => ({ error: { message: 'insert failed' } }),
    }), 'user-a', validInput);

    expect(result).toEqual({ status: 'error', message: 'insert failed' });
  });

  it('updates only the authenticated owner transaction', async () => {
    let updated: unknown;

    await updateExpense(repository({
      updateExpense: async (expenseId, userId, expense) => {
        updated = { expenseId, userId, expense };
        return { error: null };
      },
    }), 'user-a', 'expense-1', { ...validInput, amount: 'RM14.00' });

    expect(updated).toMatchObject({
      expenseId: 'expense-1',
      userId: 'user-a',
      expense: { amount_sen: 1400 },
    });
  });

  it('deletes only the authenticated owner transaction', async () => {
    let deleted: unknown;

    await deleteExpense(repository({
      deleteExpense: async (expenseId, userId) => {
        deleted = { expenseId, userId };
        return { error: null };
      },
    }), 'user-a', 'expense-1');

    expect(deleted).toEqual({ expenseId: 'expense-1', userId: 'user-a' });
  });
});
