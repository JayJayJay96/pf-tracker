import { getCalendarMonth, type ISODate } from '../../domain/periods';
import {
  calculateMonthlySummary,
  type MonthlySummary,
  type MonthlySummaryInput,
} from '../../domain/summary';

type QueryResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

export type DashboardReadRepository = {
  listEntries(userId: string, periodStart: ISODate): Promise<QueryResult>;
  listPersonalExpenses(userId: string, periodStart: ISODate): Promise<QueryResult>;
};

export type DashboardSummary = MonthlySummary & {
  snapshotCount: number;
  hasSnapshots: boolean;
};

type EntryRow = {
  entryDate: ISODate;
  entryType: 'income' | 'commitment' | 'savings' | 'investment';
  amountSen: number;
  status: string;
};

function mapEntry(value: unknown): EntryRow {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Invalid dashboard data');
  }
  const row = value as Record<string, unknown>;
  const entryDate = row.entry_date;
  const entryType = row.entry_type;
  const amountSen = row.amount_sen;
  const status = row.status;

  if (
    typeof entryDate !== 'string'
    || !['income', 'commitment', 'savings', 'investment'].includes(String(entryType))
    || !Number.isSafeInteger(amountSen)
    || (amountSen as number) < 0
    || typeof status !== 'string'
  ) {
    throw new Error('Invalid dashboard data');
  }
  getCalendarMonth(entryDate);

  return {
    entryDate,
    entryType: entryType as EntryRow['entryType'],
    amountSen: amountSen as number,
    status,
  };
}

function mapPersonalExpense(value: unknown): {
  amount: number;
  transactionDate: ISODate;
  status: 'resolved';
} {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Invalid dashboard data');
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.transaction_date !== 'string'
    || !Number.isSafeInteger(row.amount_sen)
    || (row.amount_sen as number) <= 0
  ) {
    throw new Error('Invalid dashboard data');
  }
  getCalendarMonth(row.transaction_date);
  return {
    amount: row.amount_sen as number,
    transactionDate: row.transaction_date,
    status: 'resolved',
  };
}

export async function getDashboardSummary(
  repository: DashboardReadRepository,
  userId: string,
  periodStart: ISODate,
): Promise<DashboardSummary> {
  const period = getCalendarMonth(periodStart);
  if (period.startDate !== periodStart) {
    throw new Error('Period start must be the first day of a calendar month');
  }

  const [entryResult, expenseResult] = await Promise.all([
    repository.listEntries(userId, periodStart),
    repository.listPersonalExpenses(userId, periodStart),
  ]);
  const error = entryResult.error ?? expenseResult.error;
  if (error) {
    throw new Error(error.message);
  }
  if (!entryResult.data || !expenseResult.data) {
    throw new Error('Invalid dashboard data');
  }

  const input: MonthlySummaryInput = {
    period,
    income: [],
    commitments: [],
    savings: [],
    investments: [],
    personalSpending: [],
  };

  entryResult.data.map(mapEntry).forEach((entry) => {
    const datedAmount = {
      amount: entry.amountSen,
      transactionDate: entry.entryDate,
    };
    switch (entry.entryType) {
      case 'income':
        if (entry.status !== 'confirmed' && entry.status !== 'pending') {
          throw new Error('Invalid dashboard data');
        }
        input.income.push({ ...datedAmount, status: entry.status });
        break;
      case 'commitment':
        if (entry.status !== 'active' && entry.status !== 'inactive') {
          throw new Error('Invalid dashboard data');
        }
        input.commitments.push({ ...datedAmount, status: entry.status });
        break;
      case 'savings':
        if (entry.status !== 'planned') {
          throw new Error('Invalid dashboard data');
        }
        input.savings.push(datedAmount);
        break;
      case 'investment':
        if (entry.status !== 'planned') {
          throw new Error('Invalid dashboard data');
        }
        input.investments.push(datedAmount);
        break;
    }
  });
  input.personalSpending = expenseResult.data.map(mapPersonalExpense);

  return {
    ...calculateMonthlySummary(input),
    snapshotCount: entryResult.data.length,
    hasSnapshots: entryResult.data.length > 0,
  };
}
