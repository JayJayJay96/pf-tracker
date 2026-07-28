import type { ISODate } from '../../domain/periods';
import type { Sen } from '../../domain/money';

export type PlanEntryType = 'income' | 'commitment' | 'savings' | 'investment';
export type PlanEntryStatus = 'pending' | 'confirmed' | 'active' | 'inactive' | 'planned';

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
  day: number;
  status: PlanEntryStatus;
};
