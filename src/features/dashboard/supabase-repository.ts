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
        .select('entry_date,entry_type,amount_sen,status')
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
        .gte('transaction_date', period.startDate)
        .lte('transaction_date', period.endDate)
        .order('transaction_date');
      return { data, error };
    },
  };
}
