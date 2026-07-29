import { describe, expect, it } from 'vitest';

import { type EntryDefaultsRepository, getEntryDefaults } from './entry-defaults';

function repository(
  overrides: Partial<EntryDefaultsRepository> = {},
): EntryDefaultsRepository {
  return {
    getProfileDefaults: async () => ({
      data: { default_payment_method: 'tng' },
      error: null,
    }),
    getLastExpenseCategoryId: async () => ({ data: null, error: null }),
    ...overrides,
  };
}

describe('expense entry defaults', () => {
  it('reads the payment method the owner configured', async () => {
    const defaults = await getEntryDefaults(repository({
      getProfileDefaults: async () => ({
        data: { default_payment_method: 'cash' },
        error: null,
      }),
    }), 'user-a');

    expect(defaults.paymentMethod).toBe('cash');
  });

  it('reuses the category of the most recent expense', async () => {
    const defaults = await getEntryDefaults(repository({
      getLastExpenseCategoryId: async () => ({
        data: { category_id: 'category-food' },
        error: null,
      }),
    }), 'user-a');

    expect(defaults.categoryId).toBe('category-food');
  });

  it('scopes both reads to the requested owner', async () => {
    const seen: string[] = [];

    await getEntryDefaults(repository({
      getProfileDefaults: async (userId) => {
        seen.push(userId);
        return { data: { default_payment_method: 'tng' }, error: null };
      },
      getLastExpenseCategoryId: async (userId) => {
        seen.push(userId);
        return { data: null, error: null };
      },
    }), 'user-a');

    expect(seen).toEqual(['user-a', 'user-a']);
  });

  it('falls back to tng when there is no profile row yet', async () => {
    const defaults = await getEntryDefaults(repository({
      getProfileDefaults: async () => ({ data: null, error: null }),
    }), 'user-a');

    expect(defaults).toEqual({ paymentMethod: 'tng', categoryId: undefined });
  });

  it('ignores an unexpected stored payment method rather than offering it', async () => {
    const defaults = await getEntryDefaults(repository({
      getProfileDefaults: async () => ({
        data: { default_payment_method: 'card' },
        error: null,
      }),
    }), 'user-a');

    expect(defaults.paymentMethod).toBe('tng');
  });

  it('still allows entry when either read fails', async () => {
    // A convenience default must never become a precondition for saving.
    const defaults = await getEntryDefaults(repository({
      getProfileDefaults: async () => ({
        data: null,
        error: { message: 'profiles unavailable' },
      }),
      getLastExpenseCategoryId: async () => ({
        data: null,
        error: { message: 'transactions unavailable' },
      }),
    }), 'user-a');

    expect(defaults).toEqual({ paymentMethod: 'tng', categoryId: undefined });
  });
});
