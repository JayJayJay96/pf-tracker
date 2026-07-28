import { getCalendarMonth, type ISODate } from '../../domain/periods';
import type {
  PlanEntry,
  PlanEntryStatus,
  PlanEntryType,
  PlanTemplate,
} from './types';

type QueryResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

export type MonthlyPlanReadRepository = {
  listTemplates(userId: string): Promise<QueryResult>;
  listEntries(userId: string, periodStart: ISODate): Promise<QueryResult>;
};

export type MonthlyPlan = {
  templates: PlanTemplate[];
  entries: PlanEntry[];
};

const ENTRY_TYPES = new Set<PlanEntryType>([
  'income',
  'commitment',
  'savings',
  'investment',
]);

const STATUSES = new Set<PlanEntryStatus>([
  'pending',
  'confirmed',
  'active',
  'inactive',
  'planned',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('Invalid monthly plan data');
  }
  return value;
}

function readOptionalDate(row: Record<string, unknown>, key: string): ISODate | null {
  const value = row[key];
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new Error('Invalid monthly plan data');
  }
  getCalendarMonth(value);
  return value;
}

function readAmount(row: Record<string, unknown>): number {
  const amount = row.amount_sen;
  if (!Number.isSafeInteger(amount) || (amount as number) < 0) {
    throw new Error('Invalid monthly plan data');
  }
  return amount as number;
}

function readType(row: Record<string, unknown>): PlanEntryType {
  const entryType = row.entry_type as PlanEntryType;
  if (!ENTRY_TYPES.has(entryType)) {
    throw new Error('Invalid monthly plan data');
  }
  return entryType;
}

function readStatus(row: Record<string, unknown>): PlanEntryStatus {
  const status = row.status as PlanEntryStatus;
  if (!STATUSES.has(status)) {
    throw new Error('Invalid monthly plan data');
  }
  return status;
}

function readDay(row: Record<string, unknown>, entryType: PlanEntryType): number {
  const day = entryType === 'income' ? row.expected_day : row.due_day;
  if (!Number.isInteger(day) || (day as number) < 1 || (day as number) > 31) {
    throw new Error('Invalid monthly plan data');
  }
  return day as number;
}

function mapTemplate(value: unknown): PlanTemplate {
  if (!isRecord(value)) {
    throw new Error('Invalid monthly plan data');
  }
  const entryType = readType(value);
  const effectiveStart = readString(value, 'effective_start') as ISODate;
  getCalendarMonth(effectiveStart);
  if (typeof value.is_active !== 'boolean') {
    throw new Error('Invalid monthly plan data');
  }

  return {
    id: readString(value, 'id'),
    name: readString(value, 'name'),
    entryType,
    amountSen: readAmount(value),
    effectiveStart,
    effectiveEnd: readOptionalDate(value, 'effective_end'),
    day: readDay(value, entryType),
    status: readStatus(value),
    isActive: value.is_active,
  };
}

function mapEntry(value: unknown): PlanEntry {
  if (!isRecord(value)) {
    throw new Error('Invalid monthly plan data');
  }
  const entryType = readType(value);
  const periodStart = readString(value, 'period_start') as ISODate;
  const entryDate = readString(value, 'entry_date') as ISODate;
  const period = getCalendarMonth(periodStart);
  if (
    period.startDate !== periodStart
    || entryDate < period.startDate
    || entryDate > period.endDate
  ) {
    throw new Error('Invalid monthly plan data');
  }

  return {
    id: readString(value, 'id'),
    templateId: readString(value, 'template_id'),
    periodStart,
    entryDate,
    name: readString(value, 'name'),
    entryType,
    amountSen: readAmount(value),
    day: readDay(value, entryType),
    status: readStatus(value),
  };
}

function requirePeriodStart(periodStart: ISODate): void {
  if (getCalendarMonth(periodStart).startDate !== periodStart) {
    throw new Error('Period start must be the first day of a calendar month');
  }
}

export async function getMonthlyPlan(
  repository: MonthlyPlanReadRepository,
  userId: string,
  periodStart: ISODate,
): Promise<MonthlyPlan> {
  requirePeriodStart(periodStart);
  const [templatesResult, entriesResult] = await Promise.all([
    repository.listTemplates(userId),
    repository.listEntries(userId, periodStart),
  ]);

  if (templatesResult.error) {
    throw new Error(templatesResult.error.message);
  }
  if (entriesResult.error) {
    throw new Error(entriesResult.error.message);
  }
  if (!templatesResult.data || !entriesResult.data) {
    throw new Error('Invalid monthly plan data');
  }

  return {
    templates: templatesResult.data.map(mapTemplate),
    entries: entriesResult.data.map(mapEntry),
  };
}
