import { describe, expect, it } from 'vitest';

import {
  getExpenseHistory,
  type ExpenseReadRepository,
} from './queries';

function repository(): ExpenseReadRepository {
  return {
    listCategories: async () => ({
      data: [
        { id: 'food', name: 'Food', type: 'expense', is_active: true },
        { id: 'income', name: 'Salary', type: 'income', is_active: true },
      ],
      error: null,
    }),
    listExpenses: async () => ({
      data: [
        {
          id: 'expense-2',
          amount_sen: 900,
          description: 'Bus fare',
          merchant: null,
          transaction_date: '2026-07-02',
          recorded_at: '2026-07-02T04:00:00Z',
          category_id: 'food',
          payment_method: 'cash',
          notes: null,
          transaction_type: 'personal_expense',
          categories: { name: 'Food' },
        },
        {
          id: 'expense-1',
          amount_sen: 1250,
          description: 'Backdated lunch',
          merchant: 'Kopitiam',
          transaction_date: '2026-06-30',
          recorded_at: '2026-07-01T04:00:00Z',
          category_id: 'food',
          payment_method: 'tng',
          notes: 'Forgotten yesterday',
          transaction_type: 'personal_expense',
          categories: { name: 'Food' },
        },
      ],
      error: null,
    }),
  };
}

describe('personal expense history queries', () => {
  it('returns expense categories and exact transaction/recorded dates', async () => {
    await expect(getExpenseHistory(repository(), 'user-a', {})).resolves.toEqual({
      categories: [{ id: 'food', name: 'Food' }],
      expenses: [
        {
          id: 'expense-2',
          amountSen: 900,
          description: 'Bus fare',
          merchant: null,
          transactionDate: '2026-07-02',
          recordedAt: '2026-07-02T04:00:00Z',
          categoryId: 'food',
          categoryName: 'Food',
          paymentMethod: 'cash',
          notes: null,
        },
        {
          id: 'expense-1',
          amountSen: 1250,
          description: 'Backdated lunch',
          merchant: 'Kopitiam',
          transactionDate: '2026-06-30',
          recordedAt: '2026-07-01T04:00:00Z',
          categoryId: 'food',
          categoryName: 'Food',
          paymentMethod: 'tng',
          notes: 'Forgotten yesterday',
        },
      ],
    });
  });

  it('searches description and merchant case-insensitively after owner-scoped reads', async () => {
    await expect(getExpenseHistory(repository(), 'user-a', { search: 'KOPI' }))
      .resolves.toMatchObject({
        expenses: [{ id: 'expense-1' }],
      });
  });

  it('passes date, category, and payment filters to the owner-scoped repository', async () => {
    let request: unknown;
    const filteredRepository = repository();
    filteredRepository.listExpenses = async (userId, filters) => {
      request = { userId, filters };
      return { data: [], error: null };
    };

    await getExpenseHistory(filteredRepository, 'user-a', {
      from: '2026-06-01',
      to: '2026-06-30',
      categoryId: 'food',
      paymentMethod: 'tng',
    });

    expect(request).toEqual({
      userId: 'user-a',
      filters: {
        from: '2026-06-01',
        to: '2026-06-30',
        categoryId: 'food',
        paymentMethod: 'tng',
      },
    });
  });

  it('rejects a shared transaction returned through the personal expense boundary', async () => {
    const mixedRepository = repository();
    mixedRepository.listExpenses = async () => ({
      data: [{
        id: 'shared-1',
        amount_sen: 900,
        description: 'Shared dinner',
        merchant: null,
        transaction_date: '2026-07-02',
        recorded_at: '2026-07-02T04:00:00Z',
        category_id: 'food',
        payment_method: 'cash',
        notes: null,
        transaction_type: 'shared_expense',
        categories: { name: 'Food' },
      }],
      error: null,
    });

    await expect(getExpenseHistory(mixedRepository, 'user-a', {}))
      .rejects.toThrow('Invalid personal expense data');
  });
});
