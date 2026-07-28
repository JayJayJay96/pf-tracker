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
  listPendingRequests?(userId: string): Promise<QueryResult>;
  listPaidCommitments?(userId: string, periodStart: ISODate): Promise<QueryResult>;
};

export type DashboardSummary = MonthlySummary & {
  snapshotCount: number;
  hasSnapshots: boolean;
  totalCashOutflow: number;
  friendReceivables: number;
  paidOnBehalf: number;
  unresolvedBillCount: number;
  upcomingCommitmentCount: number;
  upcomingCommitmentsSen: number;
  pendingRequestCount: number;
  daysToNextSalary: number | null;
};

type EntryRow = {
  entryDate: ISODate;
  entryType: 'income' | 'commitment' | 'savings' | 'investment';
  amountSen: number;
  actualAmountSen: number | null;
  status: string;
};

function optionalAmount(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error('Invalid dashboard data');
  }
  return value as number;
}

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
    actualAmountSen: optionalAmount(row.actual_amount_sen),
    status,
  };
}

function pendingRequest(value: unknown): void {
  if (
    typeof value !== 'object'
    || value === null
    || typeof (value as Record<string, unknown>).id !== 'string'
    || (value as Record<string, unknown>).status !== 'pending'
  ) {
    throw new Error('Invalid dashboard data');
  }
}

function paidCommitment(value: unknown): number {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Invalid dashboard data');
  }
  const row = value as Record<string, unknown>;
  if (
    !Number.isSafeInteger(row.amount_sen)
    || (row.amount_sen as number) < 0
    || typeof row.paid_date !== 'string'
  ) {
    throw new Error('Invalid dashboard data');
  }
  getCalendarMonth(row.paid_date);
  return optionalAmount(row.actual_amount_sen) ?? row.amount_sen as number;
}

function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`))
      / 86_400_000,
  );
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
  today: ISODate = periodStart,
): Promise<DashboardSummary> {
  const period = getCalendarMonth(periodStart);
  if (period.startDate !== periodStart) {
    throw new Error('Period start must be the first day of a calendar month');
  }

  getCalendarMonth(today);
  const [
    entryResult,
    expenseResult,
    sharedResult,
    portionResult,
    requestResult,
    paidCommitmentResult,
  ] = await Promise.all([
    repository.listEntries(userId, periodStart),
    repository.listPersonalExpenses(userId, periodStart),
    repository.listSharedBills?.(userId, periodStart)
      ?? Promise.resolve({ data: [], error: null }),
    repository.listSharedPortions?.(userId, periodStart)
      ?? Promise.resolve({ data: [], error: null }),
    repository.listPendingRequests?.(userId)
      ?? Promise.resolve({ data: [], error: null }),
    repository.listPaidCommitments?.(userId, periodStart)
      ?? Promise.resolve({ data: [], error: null }),
  ]);
  const error = entryResult.error
    ?? expenseResult.error
    ?? sharedResult.error
    ?? portionResult.error
    ?? requestResult.error
    ?? paidCommitmentResult.error;
  if (error) {
    throw new Error(error.message);
  }
  if (
    !entryResult.data
    || !expenseResult.data
    || !sharedResult.data
    || !portionResult.data
    || !requestResult.data
    || !paidCommitmentResult.data
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

  const entries = entryResult.data.map(mapEntry);
  entries.forEach((entry) => {
    const datedAmount = {
      amount: entry.actualAmountSen ?? entry.amountSen,
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
        if (!['active', 'inactive', 'pending', 'paid'].includes(entry.status)) {
          throw new Error('Invalid dashboard data');
        }
        input.commitments.push({
          ...datedAmount,
          status: entry.status === 'inactive' ? 'inactive' : 'active',
        });
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
  const paidOnBehalf = portions.reduce((total, portion) => {
    const bill = sharedBillsById.get(portion.transactionId);
    return portion.kind === 'friend' && bill?.status === 'resolved'
      ? total + portion.amountSen
      : total;
  }, 0);
  const upcomingCommitments = entries.filter((entry) => (
    entry.entryType === 'commitment'
    && ['active', 'pending'].includes(entry.status)
    && entry.entryDate >= today
  ));
  const nextSalary = entries
    .filter((entry) => (
      entry.entryType === 'income'
      && entry.status === 'confirmed'
      && entry.entryDate >= today
    ))
    .sort((left, right) => left.entryDate.localeCompare(right.entryDate))[0];
  requestResult.data.forEach(pendingRequest);
  const paidCommitmentOutflow = paidCommitmentResult.data.reduce<number>(
    (total, value) => total + paidCommitment(value),
    0,
  );

  return {
    ...calculateMonthlySummary(input),
    snapshotCount: entryResult.data.length,
    hasSnapshots: entryResult.data.length > 0,
    totalCashOutflow: personalCashOutflow + sharedCashOutflow + paidCommitmentOutflow,
    friendReceivables,
    paidOnBehalf,
    unresolvedBillCount: sharedBills.filter(({ status }) => status === 'unresolved').length,
    upcomingCommitmentCount: upcomingCommitments.length,
    upcomingCommitmentsSen: upcomingCommitments.reduce(
      (total, entry) => total + (entry.actualAmountSen ?? entry.amountSen),
      0,
    ),
    pendingRequestCount: requestResult.data.length,
    daysToNextSalary: nextSalary ? daysBetween(today, nextSalary.entryDate) : null,
  };
}
