import type { SupabaseClient } from '@supabase/supabase-js';

import type { DashboardReadRepository } from '../dashboard/queries';
import type { PlanTemplateWriteRepository } from './actions';
import type { MonthlyPlanReadRepository } from './queries';

export type PlanRepository =
  & MonthlyPlanReadRepository
  & PlanTemplateWriteRepository
  & DashboardReadRepository;

/** Keeps every plan operation constrained to the verified owner at the query boundary. */
export function createPlanRepository(client: SupabaseClient): PlanRepository {
  return {
    async listTemplates(userId) {
      const { data, error } = await client
        .from('financial_plan_templates')
        .select(
          'id,name,entry_type,amount_sen,effective_start,effective_end,expected_day,due_day,status,is_active',
        )
        .eq('user_id', userId)
        .order('created_at');
      return { data, error };
    },
    async listEntries(userId, periodStart) {
      const { data, error } = await client
        .from('financial_plan_entries')
        .select(
          'id,template_id,period_start,entry_date,name,entry_type,amount_sen,expected_day,due_day,status',
        )
        .eq('user_id', userId)
        .eq('period_start', periodStart)
        .order('entry_date')
        .order('name');
      return { data, error };
    },
    async insertTemplate(template) {
      const { error } = await client
        .from('financial_plan_templates')
        .insert(template);
      return { error };
    },
    async updateTemplate(templateId, userId, values) {
      const { error } = await client
        .from('financial_plan_templates')
        .update(values)
        .eq('id', templateId)
        .eq('user_id', userId);
      return { error };
    },
  };
}
