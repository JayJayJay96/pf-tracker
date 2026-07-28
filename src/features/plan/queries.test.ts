import { describe, expect, it } from 'vitest';

import {
  getMonthlyPlan,
  type MonthlyPlanReadRepository,
} from './queries';

describe('monthly plan queries', () => {
  it('returns only owner-scoped templates and selected-month snapshots', async () => {
    const calls: Array<[string, string, string?]> = [];
    const repository: MonthlyPlanReadRepository = {
      listTemplates: async (userId) => {
        calls.push(['templates', userId]);
        return {
          data: [{
            id: 'template-1',
            name: 'Salary',
            entry_type: 'income',
            amount_sen: 500_000,
            effective_start: '2026-01-01',
            effective_end: null,
            expected_day: 25,
            due_day: null,
            status: 'confirmed',
            is_active: true,
          }],
          error: null,
        };
      },
      listEntries: async (userId, periodStart) => {
        calls.push(['entries', userId, periodStart]);
        return {
          data: [{
            id: 'entry-1',
            template_id: 'template-1',
            period_start: '2026-07-01',
            entry_date: '2026-07-25',
            name: 'Salary',
            entry_type: 'income',
            amount_sen: 500_000,
            expected_day: 25,
            due_day: null,
            status: 'confirmed',
          }],
          error: null,
        };
      },
    };

    await expect(getMonthlyPlan(repository, 'user-a', '2026-07-01')).resolves.toEqual({
      templates: [{
        id: 'template-1',
        name: 'Salary',
        entryType: 'income',
        amountSen: 500_000,
        effectiveStart: '2026-01-01',
        effectiveEnd: null,
        day: 25,
        status: 'confirmed',
        isActive: true,
      }],
      entries: [{
        id: 'entry-1',
        templateId: 'template-1',
        periodStart: '2026-07-01',
        entryDate: '2026-07-25',
        name: 'Salary',
        entryType: 'income',
        amountSen: 500_000,
        day: 25,
        status: 'confirmed',
      }],
    });
    expect(calls).toEqual([
      ['templates', 'user-a'],
      ['entries', 'user-a', '2026-07-01'],
    ]);
  });

  it('rejects unsafe numeric data instead of rendering it', async () => {
    const repository: MonthlyPlanReadRepository = {
      listTemplates: async () => ({
        data: [{
          id: 'template-1',
          name: 'Unsafe',
          entry_type: 'savings',
          amount_sen: Number.MAX_SAFE_INTEGER + 1,
          effective_start: '2026-01-01',
          effective_end: null,
          expected_day: null,
          due_day: 1,
          status: 'planned',
          is_active: true,
        }],
        error: null,
      }),
      listEntries: async () => ({ data: [], error: null }),
    };

    await expect(getMonthlyPlan(repository, 'user-a', '2026-07-01'))
      .rejects.toThrow('Invalid monthly plan data');
  });

  it('surfaces selected-month query failures', async () => {
    const repository: MonthlyPlanReadRepository = {
      listTemplates: async () => ({ data: [], error: null }),
      listEntries: async () => ({
        data: null,
        error: { message: 'database unavailable' },
      }),
    };

    await expect(getMonthlyPlan(repository, 'user-a', '2026-07-01'))
      .rejects.toThrow('database unavailable');
  });
});
