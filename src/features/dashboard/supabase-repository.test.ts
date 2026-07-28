import { describe, expect, it } from 'vitest';

import { createDashboardRepository } from './supabase-repository';

describe('dashboard Supabase repository', () => {
  it('exhausts all owner-scoped outstanding-friend pages', async () => {
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
          in() {
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
              ? Array.from({ length: 1000 }, () => ({ amount_sen: 1 }))
              : [{ amount_sen: 1 }];
            return Promise.resolve({ data, error: null }).then(resolve);
          },
        };
        return builder;
      },
    };
    const repository = createDashboardRepository(client as never);

    const result = await repository.listOutstandingFriendPortions!('owner-a');

    expect(result.data).toHaveLength(1001);
    expect(ranges).toEqual([[0, 999], [1000, 1999]]);
    expect(owners).toEqual(['owner-a', 'owner-a']);
  });
});
