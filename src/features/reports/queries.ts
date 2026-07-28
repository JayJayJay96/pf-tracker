import type { ISODate } from '../../domain/periods';

type QueryResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

export type ReportReadRepository = {
  listPlanEntries(userId: string, startDate: ISODate, endDate: ISODate): Promise<QueryResult>;
  listTransactions(userId: string, startDate: ISODate, endDate: ISODate): Promise<QueryResult>;
  listParticipants(userId: string, startDate: ISODate, endDate: ISODate): Promise<QueryResult>;
  listRequests(userId: string): Promise<QueryResult>;
};

export type ReportPeriod = {
  startDate: ISODate;
  endDate: ISODate;
  label: string;
};

export type ReportPeriodInput =
  | { kind: 'month'; month: string }
  | { kind: 'custom'; from: string; to: string }
  | { kind: 'ytd'; year: string }
  | { kind: 'year'; year: string };

export type ReportSummary = {
  incomeSen: number;
  pendingIncomeSen: number;
  commitmentsSen: number;
  savingsSen: number;
  investmentsSen: number;
  personalSpendingSen: number;
  remainingSpendableSen: number;
  totalPaidSen: number;
  paidForFriendsSen: number;
  requestedSen: number;
  collectedSen: number;
  outstandingSen: number;
};

export type ReportTransaction = {
  id: string;
  description: string;
  amountSen: number;
  transactionDate: ISODate;
  recordedAt: string;
  type: 'personal_expense' | 'shared_expense';
  sharedStatus: 'unresolved' | 'resolved' | null;
  categoryName: string | null;
  userPortionSen: number;
  friendPortionSen: number;
  items: Array<{
    id: string;
    description: string;
    amountSen: number;
    discountSen: number;
  }>;
  friendPortions: Array<{
    friendId: string;
    friendName: string;
    amountSen: number;
    status: 'unrequested' | 'requested' | 'paid' | 'forgiven';
    requestId: string | null;
  }>;
};

type ComparisonMetric = {
  currentSen: number;
  previousSen: number;
  changeSen: number;
};

export type ReportResult = {
  period: ReportPeriod;
  summary: ReportSummary;
  transactions: ReportTransaction[];
  comparison?: {
    period: ReportPeriod;
    incomeSen: ComparisonMetric;
    commitmentsSen: ComparisonMetric;
    savingsSen: ComparisonMetric;
    investmentsSen: ComparisonMetric;
    personalSpendingSen: ComparisonMetric;
    outstandingSen: ComparisonMetric;
  };
};

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const monthPattern = /^(\d{4})-(\d{2})$/;

function validDate(value: string): value is ISODate {
  if (!isoDatePattern.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function toISODate(date: Date): ISODate {
  return date.toISOString().slice(0, 10) as ISODate;
}

function monthPeriod(monthValue: string): ReportPeriod {
  const match = monthPattern.exec(monthValue);
  if (!match) throw new Error('Invalid report period');
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error('Invalid report period');
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return {
    startDate: toISODate(start),
    endDate: toISODate(end),
    label: new Intl.DateTimeFormat('en-MY', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(start),
  };
}

function shortDate(value: string): string {
  return new Intl.DateTimeFormat('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

export function resolveReportPeriod(
  input: ReportPeriodInput,
  today: ISODate,
): ReportPeriod {
  if (!validDate(today)) throw new Error('Invalid report period');
  switch (input.kind) {
    case 'month':
      return monthPeriod(input.month);
    case 'custom':
      if (!validDate(input.from) || !validDate(input.to) || input.from > input.to) {
        throw new Error('Invalid report period');
      }
      return {
        startDate: input.from,
        endDate: input.to,
        label: `${shortDate(input.from)} – ${shortDate(input.to)}`,
      };
    case 'ytd': {
      if (!/^\d{4}$/.test(input.year) || input.year !== today.slice(0, 4)) {
        throw new Error('Invalid report period');
      }
      return {
        startDate: `${input.year}-01-01`,
        endDate: today,
        label: `${input.year} year to date`,
      };
    }
    case 'year':
      if (!/^\d{4}$/.test(input.year)) throw new Error('Invalid report period');
      return {
        startDate: `${input.year}-01-01`,
        endDate: `${input.year}-12-31`,
        label: input.year,
      };
  }
}

export function previousMonthPeriod(period: ReportPeriod): ReportPeriod | undefined {
  if (period.startDate.slice(8) !== '01') return undefined;
  const expected = monthPeriod(period.startDate.slice(0, 7));
  if (expected.endDate !== period.endDate) return undefined;
  const start = new Date(`${period.startDate}T00:00:00Z`);
  start.setUTCMonth(start.getUTCMonth() - 1);
  return monthPeriod(toISODate(start).slice(0, 7));
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') throw new Error('Invalid report data');
  return value as Record<string, unknown>;
}

function integer(value: unknown, allowZero = true): number {
  if (
    !Number.isSafeInteger(value)
    || (allowZero ? (value as number) < 0 : (value as number) <= 0)
  ) {
    throw new Error('Invalid report data');
  }
  return value as number;
}

function date(value: unknown): ISODate {
  if (typeof value !== 'string' || !validDate(value)) throw new Error('Invalid report data');
  return value;
}

function nullableDate(value: unknown): ISODate | null {
  return value === null ? null : date(value);
}

type PlanEntry = {
  id: string;
  entryDate: ISODate;
  name: string;
  entryType: 'income' | 'commitment' | 'savings' | 'investment';
  amountSen: number;
  status: string;
};

function mapPlanEntry(value: unknown): PlanEntry {
  const row = object(value);
  if (
    typeof row.id !== 'string'
    || typeof row.name !== 'string'
    || !['income', 'commitment', 'savings', 'investment'].includes(String(row.entry_type))
    || typeof row.status !== 'string'
  ) throw new Error('Invalid report data');
  return {
    id: row.id,
    entryDate: date(row.entry_date),
    name: row.name,
    entryType: row.entry_type as PlanEntry['entryType'],
    amountSen: integer(row.amount_sen),
    status: row.status,
  };
}

type Transaction = Omit<
  ReportTransaction,
  'userPortionSen' | 'friendPortionSen' | 'friendPortions'
>;

function mapBillItem(value: unknown): ReportTransaction['items'][number] {
  const row = object(value);
  if (typeof row.id !== 'string' || typeof row.description !== 'string') {
    throw new Error('Invalid report data');
  }
  return {
    id: row.id,
    description: row.description,
    amountSen: integer(row.amount_sen),
    discountSen: integer(row.discount_sen),
  };
}

function mapTransaction(value: unknown): Transaction {
  const row = object(value);
  const type = String(row.transaction_type);
  const sharedStatus = row.shared_status;
  if (
    typeof row.id !== 'string'
    || typeof row.description !== 'string'
    || typeof row.recorded_at !== 'string'
    || !['personal_expense', 'shared_expense'].includes(type)
    || !(
      sharedStatus === null
      || sharedStatus === 'unresolved'
      || sharedStatus === 'resolved'
    )
  ) throw new Error('Invalid report data');
  const category = related(row.categories);
  const billItems = row.bill_items ?? [];
  if (!Array.isArray(billItems)) throw new Error('Invalid report data');
  if (category && typeof category.name !== 'string') throw new Error('Invalid report data');
  return {
    id: row.id,
    description: row.description,
    amountSen: integer(row.amount_sen, false),
    transactionDate: date(row.transaction_date),
    recordedAt: row.recorded_at,
    type: type as Transaction['type'],
    sharedStatus,
    categoryName: category ? category.name as string : null,
    items: billItems.map(mapBillItem),
  };
}

type Participant = {
  transactionId: string;
  kind: 'user' | 'friend';
  amountSen: number;
  status: 'unrequested' | 'requested' | 'paid' | 'forgiven' | null;
  settledOn: ISODate | null;
  friendId: string | null;
  friendName: string | null;
  requestId: string | null;
};

function related(value: unknown): Record<string, unknown> | null {
  const selected = Array.isArray(value) ? value[0] : value;
  return selected == null ? null : object(selected);
}

function mapParticipant(value: unknown): Participant {
  const row = object(value);
  const settlement = related(row.friend_portion_settlements);
  const friend = related(row.friends);
  const kind = String(row.participant_kind);
  const status = settlement?.status ?? null;
  if (
    typeof row.transaction_id !== 'string'
    || !['user', 'friend'].includes(kind)
    || (
      kind === 'friend'
      && (
        typeof row.friend_id !== 'string'
        || !friend
        || typeof friend.name !== 'string'
        || !['unrequested', 'requested', 'paid', 'forgiven'].includes(String(status))
      )
    )
  ) throw new Error('Invalid report data');
  const requestId = settlement?.payment_request_id;
  if (requestId !== null && requestId !== undefined && typeof requestId !== 'string') {
    throw new Error('Invalid report data');
  }
  return {
    transactionId: row.transaction_id,
    kind: kind as Participant['kind'],
    amountSen: integer(row.amount_sen),
    status: status as Participant['status'],
    settledOn: settlement ? nullableDate(settlement.settled_on) : null,
    friendId: kind === 'friend' ? row.friend_id as string : null,
    friendName: kind === 'friend' ? friend!.name as string : null,
    requestId: typeof requestId === 'string' ? requestId : null,
  };
}

type PaymentRequest = {
  totalSen: number;
  requestDate: ISODate;
  status: 'pending' | 'paid' | 'cancelled' | 'forgiven';
  paidOn: ISODate | null;
};

function mapRequest(value: unknown): PaymentRequest {
  const row = object(value);
  const status = String(row.status);
  if (
    typeof row.id !== 'string'
    || !['pending', 'paid', 'cancelled', 'forgiven'].includes(status)
  ) throw new Error('Invalid report data');
  return {
    totalSen: integer(row.total_sen, false),
    requestDate: date(row.request_date),
    status: status as PaymentRequest['status'],
    paidOn: nullableDate(row.paid_on),
  };
}

function inPeriod(value: ISODate, period: ReportPeriod): boolean {
  return value >= period.startDate && value <= period.endDate;
}

function sum<T>(values: T[], amount: (value: T) => number): number {
  return values.reduce((total, value) => total + amount(value), 0);
}

function summarise(
  period: ReportPeriod,
  planEntries: PlanEntry[],
  transactions: Transaction[],
  participants: Participant[],
  requests: PaymentRequest[],
): { summary: ReportSummary; transactions: ReportTransaction[] } {
  const datedEntries = planEntries.filter(({ entryDate }) => inPeriod(entryDate, period));
  const datedTransactions = transactions.filter(
    ({ transactionDate }) => inPeriod(transactionDate, period),
  );
  const transactionIds = new Set(datedTransactions.map(({ id }) => id));
  const datedParticipants = participants.filter(({ transactionId }) => (
    transactionIds.has(transactionId)
  ));
  const resolvedIds = new Set(datedTransactions
    .filter(({ type, sharedStatus }) => type === 'shared_expense' && sharedStatus === 'resolved')
    .map(({ id }) => id));
  const resolvedParticipants = datedParticipants.filter(({ transactionId }) => (
    resolvedIds.has(transactionId)
  ));
  const userPortions = resolvedParticipants.filter(({ kind }) => kind === 'user');
  const friendPortions = resolvedParticipants.filter(({ kind }) => kind === 'friend');
  const personalTransactions = datedTransactions.filter(({ type }) => (
    type === 'personal_expense'
  ));
  const incomeSen = sum(datedEntries.filter(({ entryType, status }) => (
    entryType === 'income' && status === 'confirmed'
  )), ({ amountSen }) => amountSen);
  const pendingIncomeSen = sum(datedEntries.filter(({ entryType, status }) => (
    entryType === 'income' && status === 'pending'
  )), ({ amountSen }) => amountSen);
  const commitmentsSen = sum(datedEntries.filter(({ entryType, status }) => (
    entryType === 'commitment' && status === 'active'
  )), ({ amountSen }) => amountSen);
  const savingsSen = sum(datedEntries.filter(({ entryType }) => (
    entryType === 'savings'
  )), ({ amountSen }) => amountSen);
  const investmentsSen = sum(datedEntries.filter(({ entryType }) => (
    entryType === 'investment'
  )), ({ amountSen }) => amountSen);
  const personalSpendingSen = sum(personalTransactions, ({ amountSen }) => amountSen)
    + sum(userPortions, ({ amountSen }) => amountSen);
  const reportTransactions: ReportTransaction[] = datedTransactions.map((transaction) => ({
    ...transaction,
    userPortionSen: sum(
      resolvedParticipants.filter(({ transactionId, kind }) => (
        transactionId === transaction.id && kind === 'user'
      )),
      ({ amountSen }) => amountSen,
    ),
    friendPortionSen: sum(
      resolvedParticipants.filter(({ transactionId, kind }) => (
        transactionId === transaction.id && kind === 'friend'
      )),
      ({ amountSen }) => amountSen,
    ),
    friendPortions: resolvedParticipants
      .filter(({ transactionId, kind }) => (
        transactionId === transaction.id && kind === 'friend'
      ))
      .map((portion) => ({
        friendId: portion.friendId!,
        friendName: portion.friendName!,
        amountSen: portion.amountSen,
        status: portion.status!,
        requestId: portion.requestId,
      })),
  }));
  return {
    summary: {
      incomeSen,
      pendingIncomeSen,
      commitmentsSen,
      savingsSen,
      investmentsSen,
      personalSpendingSen,
      remainingSpendableSen: incomeSen
        - commitmentsSen
        - savingsSen
        - investmentsSen
        - personalSpendingSen,
      totalPaidSen: sum(datedTransactions, ({ amountSen }) => amountSen),
      paidForFriendsSen: sum(friendPortions, ({ amountSen }) => amountSen),
      requestedSen: sum(requests.filter(({ requestDate, status }) => (
        status === 'pending' && inPeriod(requestDate, period)
      )), ({ totalSen }) => totalSen),
      collectedSen: sum(requests.filter(({ paidOn, status }) => (
        status === 'paid' && paidOn !== null && inPeriod(paidOn, period)
      )), ({ totalSen }) => totalSen),
      outstandingSen: sum(friendPortions.filter(({ status }) => (
        status === 'unrequested' || status === 'requested'
      )), ({ amountSen }) => amountSen),
    },
    transactions: reportTransactions.sort(
      (left, right) => right.transactionDate.localeCompare(left.transactionDate),
    ),
  };
}

function compare(currentSen: number, previousSen: number): ComparisonMetric {
  return { currentSen, previousSen, changeSen: currentSen - previousSen };
}

export async function getReport(
  repository: ReportReadRepository,
  userId: string,
  period: ReportPeriod,
  comparisonPeriod?: ReportPeriod,
): Promise<ReportResult> {
  const startDate = comparisonPeriod && comparisonPeriod.startDate < period.startDate
    ? comparisonPeriod.startDate
    : period.startDate;
  const endDate = comparisonPeriod && comparisonPeriod.endDate > period.endDate
    ? comparisonPeriod.endDate
    : period.endDate;
  const results = await Promise.all([
    repository.listPlanEntries(userId, startDate, endDate),
    repository.listTransactions(userId, startDate, endDate),
    repository.listParticipants(userId, startDate, endDate),
    repository.listRequests(userId),
  ]);
  const error = results.find((result) => result.error)?.error;
  if (error) throw new Error(error.message);
  if (results.some((result) => result.data === null)) throw new Error('Invalid report data');
  const entries = results[0].data!.map(mapPlanEntry);
  const transactions = results[1].data!.map(mapTransaction);
  const participants = results[2].data!.map(mapParticipant);
  const requests = results[3].data!.map(mapRequest);
  const current = summarise(period, entries, transactions, participants, requests);
  if (!comparisonPeriod) return { period, ...current };
  const previous = summarise(
    comparisonPeriod,
    entries,
    transactions,
    participants,
    requests,
  );
  return {
    period,
    ...current,
    comparison: {
      period: comparisonPeriod,
      incomeSen: compare(current.summary.incomeSen, previous.summary.incomeSen),
      commitmentsSen: compare(
        current.summary.commitmentsSen,
        previous.summary.commitmentsSen,
      ),
      savingsSen: compare(current.summary.savingsSen, previous.summary.savingsSen),
      investmentsSen: compare(
        current.summary.investmentsSen,
        previous.summary.investmentsSen,
      ),
      personalSpendingSen: compare(
        current.summary.personalSpendingSen,
        previous.summary.personalSpendingSen,
      ),
      outstandingSen: compare(
        current.summary.outstandingSen,
        previous.summary.outstandingSen,
      ),
    },
  };
}
