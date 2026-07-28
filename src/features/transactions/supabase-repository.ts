import type { SupabaseClient } from '@supabase/supabase-js';

import type { TransactionHistoryReadRepository } from './queries';

const pageSize = 1000;

type PageResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

async function collectPages(
  fetchPage: (from: number, to: number) => Promise<PageResult>,
): Promise<PageResult> {
  const data: unknown[] = [];
  for (let from = 0; ; from += pageSize) {
    const result = await fetchPage(from, from + pageSize - 1);
    if (result.error || result.data === null) return result;
    data.push(...result.data);
    if (result.data.length < pageSize) return { data, error: null };
  }
}

export function createTransactionHistoryRepository(
  client: SupabaseClient,
): TransactionHistoryReadRepository {
  return {
    async listCategories(userId) {
      return collectPages(async (from, to) => {
        const { data, error } = await client
          .from('categories')
          .select('id,name')
          .eq('user_id', userId)
          .eq('type', 'expense')
          .order('name')
          .order('id')
          .range(from, to);
        return { data, error };
      });
    },
    async listFriends(userId) {
      return collectPages(async (from, to) => {
        const { data, error } = await client
          .from('friends')
          .select('id,name')
          .eq('user_id', userId)
          .order('name')
          .order('id')
          .range(from, to);
        return { data, error };
      });
    },
    async listTransactions(userId, filters) {
      return collectPages(async (from, to) => {
        let query = client
          .from('transactions')
          .select(
            'id,description,merchant,amount_sen,transaction_date,recorded_at,category_id,payment_method,transaction_type,shared_status,categories!transactions_owner_category_fkey(name),bill_participants(participant_kind,friend_id,amount_sen,friends(name),friend_portion_settlements(status,payment_request_id))',
          )
          .eq('user_id', userId);
        if (filters.from) query = query.gte('transaction_date', filters.from);
        if (filters.to) query = query.lte('transaction_date', filters.to);
        if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
        if (filters.paymentMethod) {
          query = query.eq('payment_method', filters.paymentMethod);
        }
        if (filters.type) {
          query = query.eq('transaction_type', `${filters.type}_expense`);
        }
        if (filters.sharedStatus) {
          query = query.eq('shared_status', filters.sharedStatus);
        }
        const { data, error } = await query
          .order('transaction_date', { ascending: false })
          .order('recorded_at', { ascending: false })
          .order('id', { ascending: false })
          .range(from, to);
        return { data, error };
      });
    },
  };
}
