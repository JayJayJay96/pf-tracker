import type { ISODate } from '../../domain/periods';

export type PaymentMethod = 'tng' | 'cash';

export type ExpenseCategory = {
  id: string;
  name: string;
};

export type Expense = {
  id: string;
  amountSen: number;
  description: string;
  merchant: string | null;
  transactionDate: ISODate;
  recordedAt: string;
  categoryId: string;
  categoryName: string;
  paymentMethod: PaymentMethod;
  notes: string | null;
};

export type ExpenseFilters = {
  search?: string;
  from?: string;
  to?: string;
  categoryId?: string;
  paymentMethod?: string;
};
