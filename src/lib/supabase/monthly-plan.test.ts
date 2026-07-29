import { describe, expect, it, vi } from 'vitest';

import { ensureMonthlyPlan, generateMonthlyPlan } from './monthly-plan';

describe('monthly plan generation server contract', () => {
  it('calls the database function with a calendar-period start and maps its row', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ period_start: '2026-07-01', generated_count: 4 }],
      error: null,
    });

    await expect(generateMonthlyPlan({ rpc }, {
      periodStart: '2026-07-01',
    })).resolves.toEqual({
      periodStart: '2026-07-01',
      insertedCount: 4,
    });
    expect(rpc).toHaveBeenCalledWith('generate_monthly_plan', {
      p_period_start: '2026-07-01',
    });
  });

  it('reports zero inserted snapshots for an idempotent retry', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ period_start: '2026-07-01', generated_count: 0 }],
      error: null,
    });

    await expect(generateMonthlyPlan({ rpc }, {
      periodStart: '2026-07-01',
    })).resolves.toEqual({
      periodStart: '2026-07-01',
      insertedCount: 0,
    });
  });

  it('rejects a non-period date before calling the database', async () => {
    const rpc = vi.fn();

    await expect(generateMonthlyPlan({ rpc }, {
      periodStart: '2026-07-02',
    })).rejects.toThrow('Period start must be the first day of a calendar month');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects malformed database output instead of returning an unsafe contract', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ period_start: '2026-07-01', generated_count: -1 }],
      error: null,
    });

    await expect(generateMonthlyPlan({ rpc }, {
      periodStart: '2026-07-01',
    })).rejects.toThrow('Invalid monthly plan generation result');
  });

  it('surfaces a database generation error', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'authentication required' },
    });

    await expect(generateMonthlyPlan({ rpc }, {
      periodStart: '2026-07-01',
    })).rejects.toThrow('authentication required');
  });
});

describe('ensuring a month exists before reading it', () => {
  it('generates the requested month', async () => {
    const calls: unknown[] = [];
    const rpc = async (_name: 'generate_monthly_plan', parameters: unknown) => {
      calls.push(parameters);
      return {
        data: [{ period_start: '2026-07-01', generated_count: 4 }],
        error: null,
      };
    };

    await ensureMonthlyPlan({ rpc }, '2026-07-01');

    expect(calls).toEqual([{ p_period_start: '2026-07-01' }]);
  });

  it('never throws, so a failed generation cannot blank the screen', async () => {
    const failing = async () => ({ data: null, error: { message: 'unavailable' } });
    const throwing = async () => { throw new Error('network down'); };

    // Reads must still render with whatever entries already exist.
    await expect(ensureMonthlyPlan({ rpc: failing }, '2026-07-01')).resolves.toBeUndefined();
    await expect(ensureMonthlyPlan({ rpc: throwing }, '2026-07-01')).resolves.toBeUndefined();
  });

  it('never throws on a malformed period, either', async () => {
    const rpc = async () => ({ data: null, error: null });

    await expect(ensureMonthlyPlan({ rpc }, '2026-07-15')).resolves.toBeUndefined();
  });
});
