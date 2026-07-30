import Link from 'next/link';

import { formatMoney } from '../../domain/money';
import { addMonths, type ISODate } from '../../domain/periods';
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

function monthLabel(periodStart: ISODate): string {
  return new Intl.DateTimeFormat('en-MY', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${periodStart}T00:00:00Z`));
}

function monthParam(periodStart: ISODate): string {
  return periodStart.slice(0, 7);
}

/** One segment of the allocation bar: a share of confirmed income. */
type Slice = { label: string; amountSen: number; className: string };

function AllocationBar({ incomeSen, slices }: { incomeSen: number; slices: Slice[] }) {
  // Without income there is no whole for the parts to be shares of.
  if (incomeSen <= 0) {
    return null;
  }
  const shown = slices.filter((slice) => slice.amountSen > 0);
  if (shown.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="allocation-heading" className="grid gap-3">
      <h2 className="text-sm font-semibold text-ink-muted" id="allocation-heading">
        Where this month&rsquo;s income goes
      </h2>
      {/*
        Decorative: the list below states every figure as text, so the bar is
        never the only way to read this.
      */}
      <div
        aria-hidden="true"
        className="flex h-3 w-full overflow-hidden rounded-full bg-black/40"
      >
        {shown.map((slice) => (
          <div
            className={slice.className}
            key={slice.label}
            style={{ width: `${(slice.amountSen / incomeSen) * 100}%` }}
          />
        ))}
      </div>
      <dl className="flex flex-wrap gap-x-5 gap-y-2">
        {shown.map((slice) => (
          <div className="flex items-center gap-2" key={slice.label}>
            <span aria-hidden="true" className={`size-2.5 rounded-full ${slice.className}`} />
            <dt className="text-sm text-ink-muted">{slice.label}</dt>
            <dd className="text-sm font-semibold text-ink">{formatMoney(slice.amountSen)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Tile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'positive' | 'negative';
}) {
  const valueTone = tone === 'positive'
    ? 'text-positive'
    : tone === 'negative' ? 'text-negative' : 'text-ink';
  return (
    <div className="rounded-xl border border-hairline bg-black/25 px-4 py-3.5">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className={`mt-1 text-xl font-bold tabular-nums ${valueTone}`}>{value}</dd>
    </div>
  );
}

export function SummaryView({
  periodStart,
  summary,
  snapshotCount,
  hasSnapshots,
}: SummaryViewProps) {
  // Deliberately unused: the raw snapshot count is internal bookkeeping and no
  // longer shown. Kept in the props so the page contract is unchanged.
  void snapshotCount;

  const remaining = summary.remainingSpendable;
  const isOverspent = remaining < 0;
  const income = summary.confirmedIncome;
  const daysToSalary = summary.daysToNextSalary ?? null;
  const unresolvedBills = summary.unresolvedBillCount ?? 0;
  const pendingRequests = summary.pendingRequestCount ?? 0;
  const upcomingCount = summary.upcomingCommitmentCount ?? 0;
  const perDay = daysToSalary !== null && daysToSalary > 0 && remaining > 0
    ? Math.floor(remaining / daysToSalary)
    : null;

  const attention = [
    unresolvedBills > 0 && {
      href: '/shared-bills',
      text: `${unresolvedBills} shared ${unresolvedBills === 1 ? 'bill' : 'bills'} to resolve`,
    },
    pendingRequests > 0 && {
      href: '/friends',
      text: `${pendingRequests} payment ${pendingRequests === 1 ? 'request' : 'requests'} pending`,
    },
    upcomingCount > 0 && {
      href: '/plan',
      text: `${upcomingCount} upcoming · ${formatMoney(summary.upcomingCommitmentsSen ?? 0)}`,
    },
  ].filter((item): item is { href: string; text: string } => Boolean(item));

  return (
    <main className="mx-auto grid w-full max-w-[1180px] gap-6 px-5 pt-8 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {monthLabel(periodStart)}
        </h1>
        <nav aria-label="Change month" className="flex items-center gap-2">
          <Link
            aria-label="Previous month"
            className="rounded-lg border border-hairline px-3 py-2 text-ink-muted no-underline hover:border-hairline-strong hover:text-ink"
            href={`/?month=${monthParam(addMonths(periodStart, -1))}`}
          >
            &lsaquo;
          </Link>
          <Link
            className="rounded-lg border border-hairline px-3 py-2 text-sm text-ink-muted no-underline hover:border-hairline-strong hover:text-ink"
            href="/"
          >
            This month
          </Link>
          <Link
            aria-label="Next month"
            className="rounded-lg border border-hairline px-3 py-2 text-ink-muted no-underline hover:border-hairline-strong hover:text-ink"
            href={`/?month=${monthParam(addMonths(periodStart, 1))}`}
          >
            &rsaquo;
          </Link>
        </nav>
      </header>

      <section
        aria-labelledby="remaining-heading"
        className={`grid gap-2 rounded-2xl border px-5 py-6 ${
          isOverspent
            ? 'border-negative/50 bg-negative/10'
            : 'border-hairline-strong bg-accent-soft'
        }`}
      >
        <h2 className="text-sm font-semibold text-ink-muted" id="remaining-heading">
          {isOverspent ? 'Over budget' : 'Remaining spendable'}
        </h2>
        <p
          className={`text-5xl font-bold tracking-tight tabular-nums ${
            isOverspent ? 'text-negative' : 'text-ink'
          }`}
        >
          {formatMoney(remaining)}
        </p>
        {isOverspent ? (
          <p className="text-sm text-negative">
            Commitments and spending exceed confirmed income by{' '}
            {formatMoney(-remaining)} this month.
          </p>
        ) : (
          <p className="text-sm text-ink-muted">
            {income > 0 ? `of ${formatMoney(income)} income` : 'No confirmed income yet'}
            {daysToSalary !== null ? ` · ${daysToSalary} days to payday` : ''}
            {perDay !== null ? ` · about ${formatMoney(perDay)} a day` : ''}
          </p>
        )}
        {!hasSnapshots ? (
          <p className="text-sm text-ink-muted">
            Nothing is set up for this month yet.{' '}
            <Link className="font-semibold text-accent underline" href="/plan">
              Add income and commitments
            </Link>
            .
          </p>
        ) : null}
      </section>

      <AllocationBar
        incomeSen={income}
        slices={[
          { label: 'Commitments', amountSen: summary.activeCommitments, className: 'bg-warning' },
          { label: 'Savings', amountSen: summary.savings, className: 'bg-positive' },
          { label: 'Investments', amountSen: summary.investments, className: 'bg-accent' },
          {
            label: 'Spent',
            amountSen: summary.resolvedPersonalSpending,
            className: 'bg-negative',
          },
          {
            label: 'Left',
            // Needs real contrast against the dark track, or the largest share
            // of the bar reads as empty space.
            amountSen: remaining > 0 ? remaining : 0,
            className: 'bg-ink-muted/70',
          },
        ]}
      />

      {attention.length > 0 ? (
        <section aria-labelledby="attention-heading" className="grid gap-2">
          <h2 className="text-sm font-semibold text-ink-muted" id="attention-heading">
            Needs attention
          </h2>
          <ul className="flex flex-wrap gap-2">
            {attention.map((item) => (
              <li key={item.href}>
                <Link
                  className="inline-block rounded-lg border border-warning/40 bg-warning/10 px-3.5 py-2 text-sm font-semibold text-warning no-underline hover:border-warning"
                  href={item.href}
                >
                  {item.text}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label="Quick actions" className="flex flex-wrap gap-2">
        <Link
          className="rounded-lg border border-hairline-strong bg-accent-soft px-4 py-2.5 font-semibold text-ink no-underline hover:border-accent hover:bg-accent/20"
          href="/expenses"
        >
          Add expense
        </Link>
        <Link
          className="rounded-lg border border-hairline px-4 py-2.5 text-ink no-underline hover:border-hairline-strong"
          href="/shared-bills"
        >
          Add shared bill
        </Link>
        <Link
          className="rounded-lg border border-hairline px-4 py-2.5 text-ink-muted no-underline hover:border-hairline-strong hover:text-ink"
          href="/transactions"
        >
          Transactions
        </Link>
      </section>

      {/*
        Headed, so the figures are not an unlabelled wall, and so they can be
        referred to unambiguously - "Commitments" also appears in the breakdown
        legend above.
      */}
      <section aria-labelledby="totals-heading" className="grid gap-3">
        <h2 className="text-sm font-semibold text-ink-muted" id="totals-heading">
          Month totals
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile label="Confirmed income" tone="positive" value={formatMoney(income)} />
          <Tile label="Commitments" value={formatMoney(summary.activeCommitments)} />
          <Tile
            label="Personal spending"
            value={formatMoney(summary.resolvedPersonalSpending)}
          />
          <Tile
            label="Friends owe you"
            tone={(summary.friendReceivables ?? 0) > 0 ? 'positive' : 'neutral'}
            value={formatMoney(summary.friendReceivables ?? 0)}
          />
        </dl>
      </section>

      <section aria-labelledby="detail-heading" className="grid gap-3">
        <h2 className="text-sm font-semibold text-ink-muted" id="detail-heading">
          Allocations and friends
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile label="Savings" value={formatMoney(summary.savings)} />
          <Tile label="Investments" value={formatMoney(summary.investments)} />
          <Tile label="Total cash out" value={formatMoney(summary.totalCashOutflow ?? 0)} />
          <Tile label="Paid for friends" value={formatMoney(summary.paidOnBehalf ?? 0)} />
        </dl>
      </section>
    </main>
  );
}
