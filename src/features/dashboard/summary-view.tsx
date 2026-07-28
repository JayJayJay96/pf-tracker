import Link from 'next/link';

import { formatRM } from '../../domain/money';
import type { ISODate } from '../../domain/periods';
import type { MonthlySummary } from '../../domain/summary';
import type { DashboardSummary } from './queries';

type SummaryViewProps = {
  periodStart: ISODate;
  summary: MonthlySummary & Partial<Pick<
    DashboardSummary,
    | 'totalCashOutflow'
    | 'friendReceivables'
    | 'paidOnBehalf'
    | 'unresolvedBillCount'
    | 'upcomingCommitmentCount'
    | 'upcomingCommitmentsSen'
    | 'pendingRequestCount'
    | 'daysToNextSalary'
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
  const metrics = [
    ['Confirmed income', formatRM(summary.confirmedIncome)],
    ['Commitments', formatRM(summary.activeCommitments)],
    ['Savings', formatRM(summary.savings)],
    ['Investments', formatRM(summary.investments)],
    ['Personal spending', formatRM(summary.resolvedPersonalSpending)],
    ['Total cash outflow', formatRM(summary.totalCashOutflow ?? 0)],
    ['Friends owe', formatRM(summary.friendReceivables ?? 0)],
    ['Paid on behalf of friends', formatRM(summary.paidOnBehalf ?? 0)],
    [
      'Upcoming commitments',
      `${summary.upcomingCommitmentCount ?? 0} · ${formatRM(summary.upcomingCommitmentsSen ?? 0)}`,
    ],
    ['Pending requests', String(summary.pendingRequestCount ?? 0)],
    ['Days to next salary', String(summary.daysToNextSalary ?? 'Not available')],
  ] as const;

  return (
    <main className="dashboard-shell">
      <section className="dashboard-topline" aria-labelledby="dashboard-title">
        <div>
          <p className="eyebrow">Monthly control room</p>
          <h1 id="dashboard-title">Personal Finance Tracker</h1>
          <p className="dashboard-subtitle">{monthLabel(periodStart)}</p>
        </div>
        <form className="period-form" method="get">
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
      </section>

      <nav className="dashboard-nav" aria-label="Primary">
        <a href="/plan">Monthly Plan</a>
        <Link href="/transactions">Transactions</Link>
        <a href="/expenses">Personal Expenses</a>
        <a href="/shared-bills">Shared Bills</a>
        <Link href="/friends">Friends</Link>
        <Link href="/reports">Reports</Link>
      </nav>

      {!hasSnapshots ? (
        <p className="notice-panel">
          No plan snapshots for this month. Add templates in Monthly Plan, then generate it.
        </p>
      ) : <p className="muted-line">{snapshotCount} plan snapshots loaded.</p>}
      {(summary.unresolvedBillCount ?? 0) > 0 ? (
        <p className="warning-panel" role="status">
          {summary.unresolvedBillCount}{' '}
          unresolved shared {summary.unresolvedBillCount === 1 ? 'bill' : 'bills'}.
          Cash outflow is included, but personal spending awaits resolution.
        </p>
      ) : null}

      <section className="dashboard-hero" aria-labelledby="remaining-heading">
        <div>
          <p className="eyebrow">Available this month</p>
          <h2 id="remaining-heading">Remaining spendable</h2>
        </div>
        <p className="hero-amount">{formatSignedRM(summary.remainingSpendable)}</p>
        <p className="hero-note">
          This is a conservative guide. It subtracts planned active commitments before they are paid.
        </p>
      </section>

      <dl className="metric-grid">
        {metrics.map(([label, value]) => (
          <div className="metric-card" key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
