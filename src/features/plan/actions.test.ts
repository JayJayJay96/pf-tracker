import { describe, expect, it } from 'vitest';

import {
  archivePlanTemplate,
  createPlanTemplate,
  updatePlanEntry,
  updatePlanTemplate,
  type PlanTemplateWriteRepository,
} from './actions';

describe('monthly plan template actions', () => {
  it('creates an income template for the authenticated owner using exact sen', async () => {
    let inserted: unknown;
    const repository: PlanTemplateWriteRepository = {
      insertTemplate: async (template) => {
        inserted = template;
        return { error: null };
      },
      updateTemplate: async () => ({ error: null }),
      updateEntry: async () => ({ error: null }),
    };

    await createPlanTemplate(repository, 'user-a', {
      name: 'Salary',
      entryType: 'income',
      amount: 'RM5000.25',
      day: '25',
      status: 'confirmed',
      effectiveStart: '2026-07-01',
      effectiveEnd: '',
    });

    expect(inserted).toEqual({
      user_id: 'user-a',
      name: 'Salary',
      entry_type: 'income',
      amount_sen: 500_025,
      effective_start: '2026-07-01',
      effective_end: null,
      recurrence: 'monthly',
      expected_day: 25,
      due_day: null,
      status: 'confirmed',
      is_active: true,
    });
  });

  it('derives a valid status when the form type changes but its status is untouched', async () => {
    let inserted: unknown;
    const repository: PlanTemplateWriteRepository = {
      insertTemplate: async (template) => {
        inserted = template;
        return { error: null };
      },
      updateTemplate: async () => ({ error: null }),
      updateEntry: async () => ({ error: null }),
    };

    await createPlanTemplate(repository, 'user-a', {
      name: 'Rent',
      entryType: 'commitment',
      amount: 'RM1200.00',
      day: '1',
      status: 'confirmed',
      effectiveStart: '2026-07-01',
      effectiveEnd: '',
    });

    expect(inserted).toMatchObject({
      entry_type: 'commitment',
      status: 'active',
      expected_day: null,
      due_day: 1,
    });
  });

  it('rejects an unrecognized status instead of silently defaulting it', async () => {
    let writeCount = 0;
    const repository: PlanTemplateWriteRepository = {
      insertTemplate: async () => {
        writeCount += 1;
        return { error: null };
      },
      updateTemplate: async () => ({ error: null }),
      updateEntry: async () => ({ error: null }),
    };

    await expect(createPlanTemplate(repository, 'user-a', {
      name: 'Tampered salary',
      entryType: 'income',
      amount: 'RM5000.00',
      day: '25',
      status: 'garbage',
      effectiveStart: '2026-07-01',
      effectiveEnd: '',
    })).rejects.toThrow('Invalid monthly plan template');
    expect(writeCount).toBe(0);
  });

  it.each([
    ['income', 'pending'],
    ['commitment', 'inactive'],
  ] as const)('preserves an explicit %s %s status', async (entryType, status) => {
    let inserted: { status?: string } | undefined;
    const repository: PlanTemplateWriteRepository = {
      insertTemplate: async (template) => {
        inserted = template;
        return { error: null };
      },
      updateTemplate: async () => ({ error: null }),
      updateEntry: async () => ({ error: null }),
    };

    await createPlanTemplate(repository, 'user-a', {
      name: 'Explicit status',
      entryType,
      amount: 'RM10.00',
      day: '1',
      status,
      effectiveStart: '2026-07-01',
      effectiveEnd: '',
    });

    expect(inserted?.status).toBe(status);
  });

  it('updates only the owner template definition used by future generations', async () => {
    let updated: { id: string; userId: string; values: unknown } | undefined;
    const repository: PlanTemplateWriteRepository = {
      insertTemplate: async () => ({ error: null }),
      updateTemplate: async (id, userId, values) => {
        updated = { id, userId, values };
        return { error: null };
      },
      updateEntry: async () => ({ error: null }),
    };

    await updatePlanTemplate(repository, 'user-a', 'template-1', {
      name: 'Revised salary',
      entryType: 'income',
      amount: 'RM5500.00',
      day: '28',
      status: 'confirmed',
      effectiveStart: '2026-07-01',
      effectiveEnd: '',
    });

    expect(updated).toEqual({
      id: 'template-1',
      userId: 'user-a',
      values: {
        name: 'Revised salary',
        entry_type: 'income',
        amount_sen: 550_000,
        effective_start: '2026-07-01',
        effective_end: null,
        recurrence: 'monthly',
        expected_day: 28,
        due_day: null,
        status: 'confirmed',
      },
    });
  });

  it('archives only the authenticated owner template', async () => {
    let updated: { id: string; userId: string; values: unknown } | undefined;
    const repository: PlanTemplateWriteRepository = {
      insertTemplate: async () => ({ error: null }),
      updateTemplate: async (id, userId, values) => {
        updated = { id, userId, values };
        return { error: null };
      },
      updateEntry: async () => ({ error: null }),
    };

    await archivePlanTemplate(repository, 'user-a', 'template-2');

    expect(updated).toEqual({
      id: 'template-2',
      userId: 'user-a',
      values: { is_active: false },
    });
  });

  it('records a confirmed income actual without replacing its planned snapshot', async () => {
    let updated: unknown;
    const repository: PlanTemplateWriteRepository = {
      insertTemplate: async () => ({ error: null }),
      updateTemplate: async () => ({ error: null }),
      updateEntry: async (entryId, userId, values) => {
        updated = { entryId, userId, values };
        return { error: null };
      },
    };

    await updatePlanEntry(repository, 'user-a', 'entry-kpi', {
      entryType: 'income',
      status: 'confirmed',
      actualAmount: 'RM842.75',
      paidDate: '',
      notes: 'Final KPI',
    });

    expect(updated).toEqual({
      entryId: 'entry-kpi',
      userId: 'user-a',
      values: {
        status: 'confirmed',
        actualAmountSen: 84_275,
        paidDate: null,
        notes: 'Final KPI',
      },
    });
  });

  it('records a paid commitment actual and requires its paid date', async () => {
    let updated: unknown;
    const repository: PlanTemplateWriteRepository = {
      insertTemplate: async () => ({ error: null }),
      updateTemplate: async () => ({ error: null }),
      updateEntry: async (entryId, userId, values) => {
        updated = { entryId, userId, values };
        return { error: null };
      },
    };

    await updatePlanEntry(repository, 'user-a', 'entry-electric', {
      entryType: 'commitment',
      status: 'paid',
      actualAmount: 'RM137.42',
      paidDate: '2026-07-18',
      notes: 'Paid online',
    });

    expect(updated).toEqual({
      entryId: 'entry-electric',
      userId: 'user-a',
      values: {
        status: 'paid',
        actualAmountSen: 13_742,
        paidDate: '2026-07-18',
        notes: 'Paid online',
      },
    });

    await expect(updatePlanEntry(repository, 'user-a', 'entry-electric', {
      entryType: 'commitment',
      status: 'paid',
      actualAmount: 'RM137.42',
      paidDate: '',
      notes: '',
    })).rejects.toThrow('Invalid monthly plan entry');
  });
});
