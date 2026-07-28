import { getCalendarMonth, type ISODate } from '../../domain/periods';

export type GenerateMonthlyPlanInput = {
  periodStart: ISODate;
};

export type GenerateMonthlyPlanOutput = {
  periodStart: ISODate;
  insertedCount: number;
};

type RpcResult = {
  data: unknown;
  error: { message: string } | null;
};

export type MonthlyPlanRpcClient = {
  rpc(
    functionName: 'generate_monthly_plan',
    parameters: { p_period_start: ISODate },
  ): PromiseLike<RpcResult>;
};

type GenerationRow = {
  period_start: ISODate;
  generated_count: number;
};

function validatePeriodStart(periodStart: ISODate): void {
  const period = getCalendarMonth(periodStart);
  if (periodStart !== period.startDate) {
    throw new Error('Period start must be the first day of a calendar month');
  }
}

function isGenerationRow(value: unknown): value is GenerationRow {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const row = value as Record<string, unknown>;
  return typeof row.period_start === 'string'
    && Number.isSafeInteger(row.generated_count)
    && (row.generated_count as number) >= 0;
}

/** Generates immutable monthly snapshots through the authenticated database RPC. */
export async function generateMonthlyPlan(
  client: MonthlyPlanRpcClient,
  input: GenerateMonthlyPlanInput,
): Promise<GenerateMonthlyPlanOutput> {
  validatePeriodStart(input.periodStart);

  const { data, error } = await client.rpc('generate_monthly_plan', {
    p_period_start: input.periodStart,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (
    !Array.isArray(data)
    || data.length !== 1
    || !isGenerationRow(data[0])
    || data[0].period_start !== input.periodStart
  ) {
    throw new Error('Invalid monthly plan generation result');
  }

  return {
    periodStart: data[0].period_start,
    insertedCount: data[0].generated_count,
  };
}
