import type { SupabaseClient } from '@supabase/supabase-js';

import type { ReportReadRepository } from './queries';

export function createReportRepository(client: SupabaseClient): ReportReadRepository {
  return {
    async listPlanEntries(userId, startDate, endDate) {
      const { data, error } = await client
        .from('financial_plan_entries')
        .select('id,entry_date,name,entry_type,amount_sen,actual_amount_sen,status')
        .eq('user_id', userId)
        .gte('entry_date', startDate)
        .lte('entry_date', endDate);
      return { data, error };
    },
    async listTransactions(userId, startDate, endDate) {
      const { data, error } = await client
        .from('transactions')
        .select(
          'id,description,amount_sen,transaction_date,recorded_at,transaction_type,shared_status,categories(name),bill_items(id,description,amount_sen,discount_sen)',
        )
        .eq('user_id', userId)
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate);
      return { data, error };
    },
    async listParticipants(userId, startDate, endDate) {
      const { data, error } = await client
        .from('bill_participants')
        .select(
          'id,transaction_id,participant_kind,friend_id,amount_sen,transactions!inner(transaction_date),friends(name),friend_portion_settlements(status,settled_on,payment_request_id)',
        )
        .eq('user_id', userId)
        .gte('transactions.transaction_date', startDate)
        .lte('transactions.transaction_date', endDate);
      return { data, error };
    },
    async listRequests(userId) {
      const { data, error } = await client
        .from('payment_requests')
        .select('id,total_sen,request_date,status,paid_on')
        .eq('user_id', userId);
      return { data, error };
    },
    async listPaidCommitments(userId, startDate, endDate) {
      const { data, error } = await client
        .from('financial_plan_entries')
        .select(
          'id,entry_date,name,entry_type,amount_sen,actual_amount_sen,status,paid_date',
        )
        .eq('user_id', userId)
        .eq('entry_type', 'commitment')
        .eq('status', 'paid')
        .gte('paid_date', startDate)
        .lte('paid_date', endDate);
      return { data, error };
    },
  };
}
