import {
  getCalendarMonth,
  isDateInPeriod,
  type ISODate,
} from '../../domain/periods';
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
  listSharedBills?(userId: string, periodStart: ISODate): Promise<QueryResult>;
  listSharedPortions?(userId: string, periodStart: ISODate): Promise<QueryResult>;
};

export type DashboardSummary = MonthlySummary & {
  snapshotCount: number;
  hasSnapshots: boolean;
  totalCashOutflow: number;
  friendReceivables: number;
  unresolvedBillCount: number;
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

function mapSharedBill(value: unknown): {
  id: string;
  amountSen: number;
  transactionDate: ISODate;
  status: 'unresolved' | 'resolved';
} {
  if (typeof value !== 'object' || value === null) throw new Error('Invalid dashboard data');
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== 'string'
    || typeof row.transaction_date !== 'string'
    || !Number.isSafeInteger(row.amount_sen)
    || (row.amount_sen as number) <= 0
    || !['unresolved', 'resolved'].includes(String(row.shared_status))
  ) throw new Error('Invalid dashboard data');
  getCalendarMonth(row.transaction_date);
  return {
    id: row.id,
    amountSen: row.amount_sen as number,
    transactionDate: row.transaction_date,
    status: row.shared_status as 'unresolved' | 'resolved',
  };
}

function mapSharedPortion(value: unknown): {
  transactionId: string;
  kind: 'user' | 'friend';
  amountSen: number;
  settlementStatus: 'unrequested' | 'requested' | 'paid' | 'forgiven';
} {
  if (typeof value !== 'object' || value === null) throw new Error('Invalid dashboard data');
  const row = value as Record<string, unknown>;
  if (
    typeof row.transaction_id !== 'string'
    || !['user', 'friend'].includes(String(row.participant_kind))
    || !Number.isSafeInteger(row.amount_sen)
    || (row.amount_sen as number) < 0
  ) throw new Error('Invalid dashboard data');
  const settlement = Array.isArray(row.friend_portion_settlements)
    ? row.friend_portion_settlements[0]
    : row.friend_portion_settlements;
  const settlementStatus = settlement && typeof settlement === 'object'
    ? (settlement as Record<string, unknown>).status
    : 'unrequested';
  if (
    row.participant_kind === 'friend'
    && !['unrequested', 'requested', 'paid', 'forgiven'].includes(
      String(settlementStatus),
    )
  ) throw new Error('Invalid dashboard data');
  return {
    transactionId: row.transaction_id,
    kind: row.participant_kind as 'user' | 'friend',
    amountSen: row.amount_sen as number,
    settlementStatus: settlementStatus as
      'unrequested' | 'requested' | 'paid' | 'forgiven',
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

  const [entryResult, expenseResult, sharedResult, portionResult] = await Promise.all([
    repository.listEntries(userId, periodStart),
    repository.listPersonalExpenses(userId, periodStart),
    repository.listSharedBills?.(userId, periodStart)
      ?? Promise.resolve({ data: [], error: null }),
    repository.listSharedPortions?.(userId, periodStart)
      ?? Promise.resolve({ data: [], error: null }),
  ]);
  const error = entryResult.error
    ?? expenseResult.error
    ?? sharedResult.error
    ?? portionResult.error;
  if (error) {
    throw new Error(error.message);
  }
  if (
    !entryResult.data
    || !expenseResult.data
    || !sharedResult.data
    || !portionResult.data
  ) {
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
  const personalExpenses = expenseResult.data.map(mapPersonalExpense);
  const sharedBills = sharedResult.data.map(mapSharedBill);
  const sharedBillsById = new Map(sharedBills.map((bill) => [bill.id, bill]));
  const portions = portionResult.data.map(mapSharedPortion);
  const userSharedSpending = portions
    .filter((portion) => {
      const bill = sharedBillsById.get(portion.transactionId);
      return portion.kind === 'user' && bill?.status === 'resolved';
    })
    .map((portion) => ({
      amount: portion.amountSen,
      transactionDate: sharedBillsById.get(portion.transactionId)!.transactionDate,
      status: 'resolved' as const,
    }));
  input.personalSpending = [...personalExpenses, ...userSharedSpending];

  const personalCashOutflow = personalExpenses
    .filter((expense) => isDateInPeriod(expense.transactionDate, period))
    .reduce(
    (total, expense) => total + expense.amount,
    0,
  );
  const sharedCashOutflow = sharedBills.reduce(
    (total, bill) => total + bill.amountSen,
    0,
  );
  const friendReceivables = portions.reduce((total, portion) => {
    const bill = sharedBillsById.get(portion.transactionId);
    return portion.kind === 'friend'
      && bill?.status === 'resolved'
      && ['unrequested', 'requested'].includes(portion.settlementStatus)
      ? total + portion.amountSen
      : total;
  }, 0);

  return {
    ...calculateMonthlySummary(input),
    snapshotCount: entryResult.data.length,
    hasSnapshots: entryResult.data.length > 0,
    totalCashOutflow: personalCashOutflow + sharedCashOutflow,
    friendReceivables,
    unresolvedBillCount: sharedBills.filter(({ status }) => status === 'unresolved').length,
  };
}
