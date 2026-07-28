import { describe, expect, it } from 'vitest';

import { updateExpense } from './actions';
import { createExpenseRepository } from './supabase-repository';

type QueryCall = {
  operation: 'select' | 'update' | 'delete';
  filters: Array<[string, unknown]>;
};

function clientDouble() {
  const calls: QueryCall[] = [];
  const query = (operation: QueryCall['operation']) => {
    const call: QueryCall = { operation, filters: [] };
    calls.push(call);
    const builder = {
      eq(column: string, value: unknown) {
        call.filters.push([column, value]);
        return builder;
      },
      gte() {
        return builder;
      },
      lte() {
        return builder;
      },
      order() {
        return builder;
      },
      then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
        return Promise.resolve({ data: [], error: null }).then(resolve);
      },
    };
    return builder;
  };
  return {
    calls,
    client: {
      from() {
        return {
          select() {
            return query('select');
          },
          update() {
            return query('update');
          },
          delete() {
            return query('delete');
          },
        };
      },
    },
  };
}

describe('personal expense Supabase repository', () => {
  it('lists only personal expenses when personal and shared transactions coexist', async () => {
    const { calls, client } = clientDouble();
    const repository = createExpenseRepository(client as never);

    await repository.listExpenses('user-a', {});

    expect(calls[0]).toMatchObject({
      operation: 'select',
      filters: [
        ['user_id', 'user-a'],
        ['transaction_type', 'personal_expense'],
      ],
    });
  });

  it('cannot update or delete a forged shared transaction id through expense actions', async () => {
    const { calls, client } = clientDouble();
    const repository = createExpenseRepository(client as never);

    await updateExpense(repository, 'user-a', 'shared-transaction', {
      amount: 'RM12.50',
      description: 'Forged edit',
      merchant: '',
      transactionDate: '2026-07-02',
      categoryId: 'food',
      paymentMethod: 'cash',
      notes: '',
    });
    await repository.deleteExpense('shared-transaction', 'user-a');

    expect(calls.filter(({ operation }) => operation !== 'select')).toEqual([
      {
        operation: 'update',
        filters: [
          ['id', 'shared-transaction'],
          ['user_id', 'user-a'],
          ['transaction_type', 'personal_expense'],
        ],
      },
      {
        operation: 'delete',
        filters: [
          ['id', 'shared-transaction'],
          ['user_id', 'user-a'],
          ['transaction_type', 'personal_expense'],
        ],
      },
    ]);
  });
});
