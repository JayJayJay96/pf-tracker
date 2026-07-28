import type { ISODate } from '../../domain/periods';
import type { Sen } from '../../domain/money';

export type PlanEntryType = 'income' | 'commitment' | 'savings' | 'investment';
export type PlanEntryStatus =
  | 'pending'
  | 'confirmed'
  | 'active'
  | 'inactive'
  | 'planned'
  | 'paid';

export type PlanTemplate = {
  id: string;
  name: string;
  entryType: PlanEntryType;
  amountSen: Sen;
  effectiveStart: ISODate;
  effectiveEnd: ISODate | null;
  day: number;
  status: PlanEntryStatus;
  isActive: boolean;
};

export type PlanEntry = {
  id: string;
  templateId: string;
  periodStart: ISODate;
  entryDate: ISODate;
  name: string;
  entryType: PlanEntryType;
  amountSen: Sen;
  actualAmountSen: Sen | null;
  day: number;
  status: PlanEntryStatus;
  paidDate: ISODate | null;
  notes: string | null;
};
