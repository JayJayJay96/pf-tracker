import Link from 'next/link';

import { formatRM } from '../../domain/money';
import type { ISODate } from '../../domain/periods';
import type { MonthlySummary } from '../../domain/summary';
import type { DashboardSummary } from './queries';

type SummaryViewProps = {
  periodStart: ISODate;
  summary: MonthlySummary & Partial<Pick<
    DashboardSummary,
    'totalCashOutflow' | 'friendReceivables' | 'unresolvedBillCount'
  >>;
  snapshotCount: number;
  hasSnapshots: boolean;
};

function formatSignedRM(amountSen: number): string {
  return amountSen < 0 ? `-${formatRM(-amountSen)}` : formatRM(amountSen);
}

function monthLabel(periodStart: ISODate): string {
  return new Intl.DateTimeFormat('en-MY', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${periodStart}T00:00:00Z`));
}

export function SummaryView({
  periodStart,
  summary,
  snapshotCount,
  hasSnapshots,
}: SummaryViewProps) {
  return (
    <main>
      <nav aria-label="Primary">
        <a href="/plan">Monthly Plan</a>{' '}
        <a href="/expenses">Personal Expenses</a>{' '}
        <a href="/shared-bills">Shared Bills</a>{' '}
        <Link href="/friends">Friends</Link>
      </nav>
      <h1>Personal Finance Tracker</h1>

      <form method="get">
        <label>
          Period
          <input
            name="month"
            type="month"
            required
            defaultValue={periodStart.slice(0, 7)}
          />
        </label>
        <button type="submit">View period</button>
      </form>

      <h2>{monthLabel(periodStart)}</h2>
      {!hasSnapshots ? (
        <p>No plan snapshots for this month. Add templates in Monthly Plan, then generate it.</p>
      ) : <p>{snapshotCount} plan snapshots loaded.</p>}
      {(summary.unresolvedBillCount ?? 0) > 0 ? (
        <p role="status">
          {summary.unresolvedBillCount}{' '}
          unresolved shared {summary.unresolvedBillCount === 1 ? 'bill' : 'bills'}.
          Cash outflow is included, but personal spending awaits resolution.
        </p>
      ) : null}

      <section aria-labelledby="remaining-heading">
        <h3 id="remaining-heading">Remaining spendable</h3>
        <p>{formatSignedRM(summary.remainingSpendable)}</p>
        <p>
          This is a conservative guide. It subtracts planned active commitments before they are paid.
        </p>
      </section>

      <dl>
        <div>
          <dt>Confirmed income</dt>
          <dd>{formatRM(summary.confirmedIncome)}</dd>
        </div>
        <div>
          <dt>Commitments</dt>
          <dd>{formatRM(summary.activeCommitments)}</dd>
        </div>
        <div>
          <dt>Savings</dt>
          <dd>{formatRM(summary.savings)}</dd>
        </div>
        <div>
          <dt>Investments</dt>
          <dd>{formatRM(summary.investments)}</dd>
        </div>
        <div>
          <dt>Personal spending</dt>
          <dd>{formatRM(summary.resolvedPersonalSpending)}</dd>
        </div>
        <div>
          <dt>Total cash outflow</dt>
          <dd>{formatRM(summary.totalCashOutflow ?? 0)}</dd>
        </div>
        <div>
          <dt>Friends owe</dt>
          <dd>{formatRM(summary.friendReceivables ?? 0)}</dd>
        </div>
      </dl>
    </main>
  );
}
