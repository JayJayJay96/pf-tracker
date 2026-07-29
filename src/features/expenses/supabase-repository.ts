import type { SupabaseClient } from '@supabase/supabase-js';

import type { ExpenseWriteRepository } from './actions';
import type { EntryDefaultsRepository } from './entry-defaults';
import type { ExpenseReadRepository } from './queries';

export type ExpenseRepository = ExpenseWriteRepository
  & ExpenseReadRepository
  & EntryDefaultsRepository;

/** Constrains every expense operation to the verified owner at the query boundary. */
export function createExpenseRepository(client: SupabaseClient): ExpenseRepository {
  return {
    async listCategories(userId) {
      const { data, error } = await client
        .from('categories')
        .select('id,name,type,is_active')
        .eq('user_id', userId)
        .eq('type', 'expense')
        .eq('is_active', true)
        .order('sort_order')
        .order('name');
      return { data, error };
    },
    async listExpenses(userId, filters) {
      let query = client
        .from('transactions')
        .select(
          'id,amount_sen,description,merchant,transaction_date,recorded_at,category_id,payment_method,transaction_type,notes,categories!transactions_owner_category_fkey(name)',
        )
        .eq('user_id', userId)
        .eq('transaction_type', 'personal_expense');
      if (filters.from) query = query.gte('transaction_date', filters.from);
      if (filters.to) query = query.lte('transaction_date', filters.to);
      if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
      if (filters.paymentMethod) {
        query = query.eq('payment_method', filters.paymentMethod);
      }
      const { data, error } = await query
        .order('transaction_date', { ascending: false })
        .order('recorded_at', { ascending: false });
      return { data, error };
    },
    async getProfileDefaults(userId) {
      const { data, error } = await client
        .from('profiles')
        .select('default_payment_method')
        .eq('user_id', userId)
        .maybeSingle();
      return { data, error };
    },
    async getLastExpenseCategoryId(userId) {
      const { data, error } = await client
        .from('transactions')
        .select('category_id')
        .eq('user_id', userId)
        .eq('transaction_type', 'personal_expense')
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return { data, error };
    },
    async insertCategory(category) {
      const { error } = await client.from('categories').insert(category);
      return { error };
    },
    async insertExpense(expense) {
      const { error } = await client.from('transactions').insert(expense);
      return { error };
    },
    async updateExpense(expenseId, userId, expense) {
      const { error } = await client
        .from('transactions')
        .update(expense)
        .eq('id', expenseId)
        .eq('user_id', userId)
        .eq('transaction_type', 'personal_expense');
      return { error };
    },
    async deleteExpense(expenseId, userId) {
      const { error } = await client
        .from('transactions')
        .delete()
        .eq('id', expenseId)
        .eq('user_id', userId)
        .eq('transaction_type', 'personal_expense');
      return { error };
    },
  };
}
