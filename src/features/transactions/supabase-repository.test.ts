import { describe, expect, it } from 'vitest';

import { createTransactionHistoryRepository } from './supabase-repository';

type Call = {
  table: string;
  filters: Array<[string, unknown]>;
};

function clientDouble() {
  const calls: Call[] = [];
  return {
    calls,
    client: {
      from(table: string) {
        const call: Call = { table, filters: [] };
        calls.push(call);
        const builder = {
          select() {
            return builder;
          },
          eq(column: string, value: unknown) {
            call.filters.push([column, value]);
            return builder;
          },
          gte(column: string, value: unknown) {
            call.filters.push([`${column}>=`, value]);
            return builder;
          },
          lte(column: string, value: unknown) {
            call.filters.push([`${column}<=`, value]);
            return builder;
          },
      order() {
        return builder;
      },
      range() {
        return builder;
      },
          then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
            return Promise.resolve({ data: [], error: null }).then(resolve);
          },
        };
        return builder;
      },
    },
  };
}

describe('unified transaction Supabase repository', () => {
  it('always scopes transactions and filter options to the authenticated owner', async () => {
    const { calls, client } = clientDouble();
    const repository = createTransactionHistoryRepository(client as never);

    await Promise.all([
      repository.listCategories('owner-a'),
      repository.listFriends('owner-a'),
      repository.listTransactions('owner-a', {
        from: '2026-07-01',
        to: '2026-07-31',
        categoryId: 'food',
        paymentMethod: 'cash',
        type: 'personal',
        sort: 'date',
      }),
    ]);

    expect(calls).toEqual([
      {
        table: 'categories',
        filters: [
          ['user_id', 'owner-a'],
          ['type', 'expense'],
        ],
      },
      {
        table: 'friends',
        filters: [['user_id', 'owner-a']],
      },
      {
        table: 'transactions',
        filters: [
          ['user_id', 'owner-a'],
          ['transaction_date>=', '2026-07-01'],
          ['transaction_date<=', '2026-07-31'],
          ['category_id', 'food'],
          ['payment_method', 'cash'],
          ['transaction_type', 'personal_expense'],
        ],
      },
    ]);
  });

  it('exhausts owner-scoped pages so records after row 1000 remain visible', async () => {
    const ranges: Array<[number, number]> = [];
    const owners: string[] = [];
    const client = {
      from() {
        let page = 0;
        const builder = {
          select() {
            return builder;
          },
          eq(column: string, value: unknown) {
            if (column === 'user_id') owners.push(String(value));
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
          range(from: number, to: number) {
            ranges.push([from, to]);
            page = from / 1000;
            return builder;
          },
          then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
            const data = page === 0
              ? Array.from({ length: 1000 }, (_, index) => ({ id: String(index) }))
              : [{ id: '1000' }];
            return Promise.resolve({ data, error: null }).then(resolve);
          },
        };
        return builder;
      },
    };
    const repository = createTransactionHistoryRepository(client as never);

    const result = await repository.listTransactions('owner-a', { sort: 'date' });

    expect(result.data).toHaveLength(1001);
    expect(ranges).toEqual([[0, 999], [1000, 1999]]);
    expect(owners).toEqual(['owner-a', 'owner-a']);
  });
});
