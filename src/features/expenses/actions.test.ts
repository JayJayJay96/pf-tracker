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
    [{ ...validInput, amount: 'RM0.00' }, 'zero amount'],
    [{ ...validInput, description: ' ' }, 'blank description'],
    [{ ...validInput, transactionDate: '2026-02-30' }, 'invalid date'],
    [{ ...validInput, categoryId: '' }, 'missing category'],
    [{ ...validInput, paymentMethod: 'card' }, 'unsupported payment method'],
  ])('rejects %s before writing', async (input) => {
    let writes = 0;

    await expect(createExpense(repository({
      insertExpense: async () => {
        writes += 1;
        return { error: null };
      },
    }), 'user-a', input)).rejects.toThrow('Invalid personal expense');
    expect(writes).toBe(0);
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
