import type { SupabaseClient } from '@supabase/supabase-js';

import { getCalendarMonth } from '../../domain/periods';
import type { DashboardReadRepository } from './queries';

/** Reads dashboard inputs through explicit owner and calendar-period constraints. */
export function createDashboardRepository(
  client: SupabaseClient,
): DashboardReadRepository {
  return {
    async listEntries(userId, periodStart) {
      const { data, error } = await client
        .from('financial_plan_entries')
        .select('entry_date,entry_type,amount_sen,actual_amount_sen,status')
        .eq('user_id', userId)
        .eq('period_start', periodStart)
        .order('entry_date');
      return { data, error };
    },
    async listPersonalExpenses(userId, periodStart) {
      const period = getCalendarMonth(periodStart);
      const { data, error } = await client
        .from('transactions')
        .select('transaction_date,amount_sen,recorded_at')
        .eq('user_id', userId)
        .eq('transaction_type', 'personal_expense')
        .gte('transaction_date', period.startDate)
        .lte('transaction_date', period.endDate)
        .order('transaction_date');
      return { data, error };
    },
    async listSharedBills(userId, periodStart) {
      const period = getCalendarMonth(periodStart);
      const { data, error } = await client
        .from('transactions')
        .select('id,transaction_date,amount_sen,shared_status')
        .eq('user_id', userId)
        .eq('transaction_type', 'shared_expense')
        .gte('transaction_date', period.startDate)
        .lte('transaction_date', period.endDate);
      return { data, error };
    },
    async listSharedPortions(userId, periodStart) {
      const period = getCalendarMonth(periodStart);
      const { data, error } = await client
        .from('bill_participants')
        .select(
          'transaction_id,participant_kind,amount_sen,transactions!inner(transaction_date),friend_portion_settlements(status)',
        )
        .eq('user_id', userId)
        .gte('transactions.transaction_date', period.startDate)
        .lte('transactions.transaction_date', period.endDate);
      return { data, error };
    },
    async listPendingRequests(userId) {
      const { data, error } = await client
        .from('payment_requests')
        .select('id,status')
        .eq('user_id', userId)
        .eq('status', 'pending');
      return { data, error };
    },
    async listPaidCommitments(userId, periodStart) {
      const period = getCalendarMonth(periodStart);
      const { data, error } = await client
        .from('financial_plan_entries')
        .select('amount_sen,actual_amount_sen,paid_date')
        .eq('user_id', userId)
        .eq('entry_type', 'commitment')
        .eq('status', 'paid')
        .gte('paid_date', period.startDate)
        .lte('paid_date', period.endDate);
      return { data, error };
    },
  };
}
