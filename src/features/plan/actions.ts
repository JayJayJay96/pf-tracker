import { requireAmountInput } from '../../domain/money';
import { getCalendarMonth, type ISODate } from '../../domain/periods';
import type { PlanEntryStatus, PlanEntryType } from './types';

type WriteResult = {
  error: { message: string } | null;
};

type PlanTemplateWriteValues = {
  name: string;
  entry_type: PlanEntryType;
  amount_sen: number;
  effective_start: ISODate;
  effective_end: ISODate | null;
  recurrence: 'monthly';
  expected_day: number | null;
  due_day: number | null;
  status: PlanEntryStatus;
};

type NewPlanTemplate = PlanTemplateWriteValues & {
  user_id: string;
  is_active: true;
};

type PlanEntryWriteValues = {
  status: 'pending' | 'confirmed' | 'paid';
  actualAmountSen: number | null;
  paidDate: ISODate | null;
  notes: string | null;
};

export type PlanTemplateWriteRepository = {
  insertTemplate(template: NewPlanTemplate): Promise<WriteResult>;
  updateTemplate(
    templateId: string,
    userId: string,
    values: Partial<PlanTemplateWriteValues> | { is_active: false },
  ): Promise<WriteResult>;
  updateEntry(
    entryId: string,
    userId: string,
    values: PlanEntryWriteValues,
  ): Promise<WriteResult>;
};

export type PlanTemplateInput = {
  name: string;
  entryType: string;
  amount: string;
  day: string;
  status: string;
  effectiveStart: string;
  effectiveEnd: string;
};

export type PlanEntryInput = {
  entryType: string;
  status: string;
  actualAmount: string;
  paidDate: string;
  notes: string;
};

const ENTRY_TYPES = new Set<PlanEntryType>([
  'income',
  'commitment',
  'savings',
  'investment',
]);

const STATUS_BY_TYPE: Record<PlanEntryType, Set<PlanEntryStatus>> = {
  income: new Set(['pending', 'confirmed']),
  commitment: new Set(['active', 'inactive']),
  savings: new Set(['planned']),
  investment: new Set(['planned']),
};

const STATUSES = new Set<PlanEntryStatus>([
  'pending',
  'confirmed',
  'active',
  'inactive',
  'planned',
]);

function defaultStatus(entryType: PlanEntryType): PlanEntryStatus {
  switch (entryType) {
    case 'income':
      return 'confirmed';
    case 'commitment':
      return 'active';
    default:
      return 'planned';
  }
}

function parseTemplateInput(input: PlanTemplateInput): PlanTemplateWriteValues {
  try {
    const name = input.name.trim();
    const entryType = input.entryType as PlanEntryType;
    const requestedStatus = input.status as PlanEntryStatus;
    const day = Number(input.day);
    const effectiveStart = input.effectiveStart as ISODate;
    const effectiveEnd = input.effectiveEnd === '' ? null : input.effectiveEnd as ISODate;

    if (
      name === ''
      || !ENTRY_TYPES.has(entryType)
      || !STATUSES.has(requestedStatus)
      || !Number.isInteger(day)
      || day < 1
      || day > 31
    ) {
      throw new Error();
    }

    const status = STATUS_BY_TYPE[entryType].has(requestedStatus)
      ? requestedStatus
      : defaultStatus(entryType);

    getCalendarMonth(effectiveStart);
    if (effectiveEnd) {
      getCalendarMonth(effectiveEnd);
      if (effectiveEnd < effectiveStart) {
        throw new Error();
      }
    }

    return {
      name,
      entry_type: entryType,
      amount_sen: requireAmountInput(input.amount),
      effective_start: effectiveStart,
      effective_end: effectiveEnd,
      recurrence: 'monthly',
      expected_day: entryType === 'income' ? day : null,
      due_day: entryType === 'income' ? null : day,
      status,
    };
  } catch {
    throw new Error('Invalid monthly plan template');
  }
}

function requireIdentifier(value: string): void {
  if (value.trim() === '') {
    throw new Error('Invalid monthly plan template');
  }
}

function throwWriteError(result: WriteResult): void {
  if (result.error) {
    throw new Error(result.error.message);
  }
}

export async function createPlanTemplate(
  repository: PlanTemplateWriteRepository,
  userId: string,
  input: PlanTemplateInput,
): Promise<void> {
  requireIdentifier(userId);
  const values = parseTemplateInput(input);
  throwWriteError(await repository.insertTemplate({
    user_id: userId,
    ...values,
    is_active: true,
  }));
}

export async function updatePlanTemplate(
  repository: PlanTemplateWriteRepository,
  userId: string,
  templateId: string,
  input: PlanTemplateInput,
): Promise<void> {
  requireIdentifier(userId);
  requireIdentifier(templateId);
  throwWriteError(await repository.updateTemplate(
    templateId,
    userId,
    parseTemplateInput(input),
  ));
}

export async function archivePlanTemplate(
  repository: PlanTemplateWriteRepository,
  userId: string,
  templateId: string,
): Promise<void> {
  requireIdentifier(userId);
  requireIdentifier(templateId);
  throwWriteError(await repository.updateTemplate(
    templateId,
    userId,
    { is_active: false },
  ));
}

function parseEntryInput(input: PlanEntryInput): PlanEntryWriteValues {
  try {
    const entryType = input.entryType as PlanEntryType;
    const status = input.status;
    if (
      (entryType === 'income' && !['pending', 'confirmed'].includes(status))
      || (entryType === 'commitment' && !['pending', 'paid'].includes(status))
      || !['income', 'commitment'].includes(entryType)
    ) {
      throw new Error();
    }
    const paidDate = input.paidDate === '' ? null : input.paidDate as ISODate;
    if (paidDate) getCalendarMonth(paidDate);
    if (entryType === 'commitment' && status === 'paid' && paidDate === null) {
      throw new Error();
    }

    return {
      status: status as PlanEntryWriteValues['status'],
      actualAmountSen: input.actualAmount === ''
        ? null
        : requireAmountInput(input.actualAmount),
      paidDate: entryType === 'commitment' && status === 'paid' ? paidDate : null,
      notes: input.notes.trim() === '' ? null : input.notes.trim(),
    };
  } catch {
    throw new Error('Invalid monthly plan entry');
  }
}

export async function updatePlanEntry(
  repository: PlanTemplateWriteRepository,
  userId: string,
  entryId: string,
  input: PlanEntryInput,
): Promise<void> {
  requireIdentifier(userId);
  requireIdentifier(entryId);
  throwWriteError(await repository.updateEntry(
    entryId,
    userId,
    parseEntryInput(input),
  ));
}
