import { addSen, subtractSen, type Sen } from './money';
import { isDateInPeriod, type CalendarMonth, type ISODate } from './periods';

type DatedAmount = { amount: Sen; transactionDate: ISODate };
type Income = DatedAmount & { status: 'confirmed' | 'pending' };
type Commitment = DatedAmount & { status: 'active' | 'inactive' };
type PersonalSpending = DatedAmount & { status: 'resolved' | 'pending' };

export type MonthlySummaryInput = {
  period: CalendarMonth;
  income: Income[];
  commitments: Commitment[];
  savings: DatedAmount[];
  investments: DatedAmount[];
  personalSpending: PersonalSpending[];
};

export type MonthlySummary = {
  confirmedIncome: Sen;
  activeCommitments: Sen;
  savings: Sen;
  investments: Sen;
  resolvedPersonalSpending: Sen;
  remainingSpendable: Sen;
};

function sumInPeriod(entries: DatedAmount[], period: CalendarMonth): Sen {
  return entries.reduce(
    (total, entry) => isDateInPeriod(entry.transactionDate, period) ? addSen(total, entry.amount) : total,
    0,
  );
}

/** Calculates allocations and remaining spendable for one calendar month. */
export function calculateMonthlySummary(input: MonthlySummaryInput): MonthlySummary {
  const confirmedIncome = sumInPeriod(input.income.filter((entry) => entry.status === 'confirmed'), input.period);
  const activeCommitments = sumInPeriod(input.commitments.filter((entry) => entry.status === 'active'), input.period);
  const savings = sumInPeriod(input.savings, input.period);
  const investments = sumInPeriod(input.investments, input.period);
  const resolvedPersonalSpending = sumInPeriod(input.personalSpending.filter((entry) => entry.status === 'resolved'), input.period);
  const remainingSpendable = subtractSen(
    subtractSen(subtractSen(subtractSen(confirmedIncome, activeCommitments), savings), investments),
    resolvedPersonalSpending,
  );

  return { confirmedIncome, activeCommitments, savings, investments, resolvedPersonalSpending, remainingSpendable };
}
