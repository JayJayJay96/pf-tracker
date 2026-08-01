import Link from 'next/link';

import { formatMoney } from '../../domain/money';
import { displayDate, displayDateTime } from '../ui/dates';
import {
  DataRow,
  DataTable,
  Disclosure,
  Empty,
  Field,
  Figures,
  FilterForm,
  PageShell,
  Record,
  RecordList,
  Section,
} from '../ui/page';
import type { ReportPeriodInput, ReportResult } from './queries';

const LINK_CLASS = 'text-accent underline';

function summaryRows(summary: ReportResult['summary']) {
  return [
    ['Income received', formatMoney(summary.incomeSen)],
    ['Pending income (excluded)', formatMoney(summary.pendingIncomeSen)],
    ['Commitments', formatMoney(summary.commitmentsSen)],
    ['Savings', formatMoney(summary.savingsSen)],
    ['Investments', formatMoney(summary.investmentsSen)],
    ['Personal spending', formatMoney(summary.personalSpendingSen)],
    ['Remaining spendable', formatMoney(summary.remainingSpendableSen)],
    ['Total amount paid', formatMoney(summary.totalPaidSen)],
    ['Paid for friends', formatMoney(summary.paidForFriendsSen)],
    ['Requested from friends', formatMoney(summary.requestedSen)],
    ['Collected from friends', formatMoney(summary.collectedSen)],
    ['Still outstanding', formatMoney(summary.outstandingSen)],
  ] as const;
}

/** A rise carries an explicit sign, so direction reads at a glance. */
function formatChange(amountSen: number): string {
  return amountSen > 0 ? `+${formatMoney(amountSen)}` : formatMoney(amountSen);
}

type CategorySlice = { name: string; amountSen: number };

/**
 * What the owner actually spent, grouped by category.
 *
 * A category is required on every expense, so the tagging cost was already being
 * paid; nothing was reading it back. Two judgements are baked in:
 *
 * - A resolved shared bill contributes the owner's own portion, not the whole
 *   bill. The rest was never their money to spend.
 * - An unresolved shared bill contributes nothing, because its split is not
 *   decided yet. Those are counted separately and reported, so a total that
 *   looks low is explained rather than just wrong.
 */
function spendingByCategory(transactions: ReportResult['transactions']): {
  slices: CategorySlice[];
  totalSen: number;
  unresolvedCount: number;
} {
  const totals = new Map<string, number>();
  let unresolvedCount = 0;

  for (const transaction of transactions) {
    if (transaction.type === 'shared_expense' && transaction.sharedStatus !== 'resolved') {
      unresolvedCount += 1;
      continue;
    }
    const amountSen = transaction.type === 'shared_expense'
      ? transaction.userPortionSen
      : transaction.amountSen;
    if (amountSen <= 0) continue;
    /*
     * A shared bill is named as one rather than called uncategorised, which was
     * misleading: a month of real use put "Uncategorised" at the top of this
     * chart holding 81% of the spending, as though the owner had been careless.
     * They had not - the schema forbids a category on a shared bill
     * (`transaction_type = 'shared_expense' and category_id is null`), because
     * only part of the bill is theirs and the detail belongs to its items. So the
     * slice says what it actually is.
     */
    const name = transaction.categoryName
      ?? (transaction.type === 'shared_expense' ? 'Shared bills' : 'Uncategorised');
    totals.set(name, (totals.get(name) ?? 0) + amountSen);
  }

  const slices = [...totals]
    .map(([name, amountSen]) => ({ name, amountSen }))
    .sort((left, right) => right.amountSen - left.amountSen);

  return {
    slices,
    totalSen: slices.reduce((sum, slice) => sum + slice.amountSen, 0),
    unresolvedCount,
  };
}

function CategoryBreakdown({ transactions }: {
  transactions: ReportResult['transactions'];
}) {
  const { slices, totalSen, unresolvedCount } = spendingByCategory(transactions);

  return (
    <Section id="categories" title="Spending by category">
      {slices.length === 0 ? (
        <Empty>No categorised spending in this period.</Empty>
      ) : (
        <>
          <ul className="grid list-none gap-2.5 p-0">
            {slices.map((slice) => {
              const share = Math.round((slice.amountSen / totalSen) * 100);
              return (
                <li className="grid gap-1.5" key={slice.name}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="text-ink">{slice.name}</span>
                    <span className="text-sm text-ink-muted tabular-nums">
                      <span className="font-semibold text-ink">
                        {formatMoney(slice.amountSen)}
                      </span>
                      {` · ${share}%`}
                    </span>
                  </div>
                  {/*
                    Decorative: the figure and its share are both stated above, so
                    the bar is never the only way to read this.
                  */}
                  <div
                    aria-hidden="true"
                    className="h-1.5 w-full overflow-hidden rounded-full bg-black/40"
                  >
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${(slice.amountSen / totalSen) * 100}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-sm text-ink-muted">
            {`Total ${formatMoney(totalSen)}`}
            {unresolvedCount > 0
              ? `. Excludes ${unresolvedCount} unresolved shared `
                + `${unresolvedCount === 1 ? 'bill' : 'bills'}, whose split is not `
                + 'settled yet.'
              : '.'}
          </p>
        </>
      )}
    </Section>
  );
}

const EXPORTS = [
  ['/api/export/transactions', 'Transactions CSV'],
  ['/api/export/friends', 'Friend balances CSV'],
  ['/api/export/requests', 'Payment requests CSV'],
  ['/api/export/backup', 'Full JSON backup'],
] as const;

export function ReportView({
  report,
  selection,
  today,
}: {
  report: ReportResult;
  selection: ReportPeriodInput;
  today: string;
}) {
  return (
    <PageShell
      intro={'Reporting uses transaction dates; recorded dates stay visible for audit '
        + 'context. Friend repayments are collections, never income.'}
      title={`${report.period.label} report`}
    >
      <Section id="range" title="Report range">
        <FilterForm>
          <Field label="Range">
            <select name="range" defaultValue={selection.kind}>
              <option value="month">Specific month</option>
              <option value="custom">Custom date range</option>
              <option value="ytd">Year to date</option>
              <option value="year">Specific year</option>
            </select>
          </Field>
          <Field label="Month">
            <input
              name="month"
              type="month"
              defaultValue={selection.kind === 'month' ? selection.month : today.slice(0, 7)}
            />
          </Field>
          <Field label="From">
            <input
              name="from"
              type="date"
              defaultValue={selection.kind === 'custom' ? selection.from : today}
            />
          </Field>
          <Field label="To">
            <input
              name="to"
              type="date"
              defaultValue={selection.kind === 'custom' ? selection.to : today}
            />
          </Field>
          <Field label="Year">
            <input
              name="year"
              type="number"
              inputMode="numeric"
              min="2000"
              max="9999"
              defaultValue={'year' in selection ? selection.year : today.slice(0, 4)}
            />
          </Field>
          <button
            className="justify-self-start rounded-lg border border-hairline bg-transparent px-4 py-2.5 text-ink hover:border-hairline-strong"
            type="submit"
          >
            View report
          </button>
        </FilterForm>
      </Section>

      <Section id="summary" title="Financial summary">
        <Figures rows={summaryRows(report.summary)} />
      </Section>

      <CategoryBreakdown transactions={report.transactions} />



      {report.comparison ? (
        <Section id="comparison" title={`Compared with ${report.comparison.period.label}`}>
          <DataTable
            caption={`This period compared with ${report.comparison.period.label}`}
            head={['Metric', 'Current', 'Previous', 'Change']}
          >
            {([
              ['Income', report.comparison.incomeSen],
              ['Commitments', report.comparison.commitmentsSen],
              ['Savings', report.comparison.savingsSen],
              ['Investments', report.comparison.investmentsSen],
              ['Personal spending', report.comparison.personalSpendingSen],
              ['Outstanding', report.comparison.outstandingSen],
            ] as const).map(([label, metric]) => (
              <DataRow
                cells={[
                  formatMoney(metric.currentSen),
                  formatMoney(metric.previousSen),
                  formatChange(metric.changeSen),
                ]}
                header={label}
                key={label}
              />
            ))}
          </DataTable>
        </Section>
      ) : null}

      <Section id="history" title="Historical transactions">
        {report.transactions.length === 0 ? (
          <Empty>No transactions in this period.</Empty>
        ) : (
          <RecordList>
            {report.transactions.map((transaction) => (
              <Record key={transaction.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <strong className="text-ink">{transaction.description}</strong>
                  <span className="font-semibold text-ink tabular-nums">
                    {formatMoney(transaction.amountSen)}
                  </span>
                </div>
                <p className="text-sm text-ink-muted">
                  <time dateTime={transaction.transactionDate}>
                    {displayDate(transaction.transactionDate)}
                  </time>
                  {' · '}
                  {transaction.type === 'shared_expense'
                    ? 'Shared expense'
                    : 'Personal expense'}
                  {transaction.sharedStatus ? ` — ${transaction.sharedStatus}` : ''}
                  {transaction.categoryName ? ` — ${transaction.categoryName}` : ''}
                </p>

                <Disclosure summary="Details">
                  {transaction.type === 'shared_expense'
                    && transaction.sharedStatus === 'resolved' ? (
                      <p className="text-sm text-ink-muted">
                        Your portion {formatMoney(transaction.userPortionSen)}; friend
                        portions {formatMoney(transaction.friendPortionSen)}
                      </p>
                    ) : null}

                  {transaction.items.length > 0 ? (
                    <>
                      <h3 className="text-sm font-semibold text-ink">Bill items</h3>
                      <ul className="grid list-none gap-1 p-0">
                        {transaction.items.map((item) => (
                          <li className="text-sm text-ink-muted" key={item.id}>
                            {item.description}: {formatMoney(item.amountSen)}
                            {item.discountSen > 0
                              ? ` (${formatMoney(item.discountSen)} discount)`
                              : ''}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}

                  {transaction.friendPortions.length > 0 ? (
                    <>
                      <h3 className="text-sm font-semibold text-ink">Friend portions</h3>
                      <ul className="grid list-none gap-1 p-0">
                        {transaction.friendPortions.map((portion) => (
                          <li
                            className="text-sm text-ink-muted"
                            key={`${portion.friendId}:${portion.requestId ?? 'unrequested'}`}
                          >
                            {portion.friendName}: {formatMoney(portion.amountSen)} —{' '}
                            {portion.status}
                            {portion.requestId ? (
                              <>
                                {' '}
                                <Link
                                  className={LINK_CLASS}
                                  href={`/friends/${portion.friendId}/requests/${portion.requestId}`}
                                >
                                  View payment request
                                </Link>
                              </>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}

                  <p className="text-sm text-ink-muted">
                    Recorded{' '}
                    <time dateTime={transaction.recordedAt}>
                      {displayDateTime(transaction.recordedAt)}
                    </time>
                  </p>
                </Disclosure>
              </Record>
            ))}
          </RecordList>
        )}
      </Section>

      <Section id="export" title="Private exports">
        <p className="text-sm text-ink-muted">
          Exports are generated on demand for the signed-in owner and are never cached.
        </p>
        <ul className="grid list-none gap-2 p-0 sm:grid-cols-2">
          {EXPORTS.map(([href, label]) => (
            <li key={href}>
              <a
                className="inline-block rounded-lg border border-hairline px-3.5 py-2 text-sm text-ink no-underline hover:border-hairline-strong"
                href={href}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </Section>
    </PageShell>
  );
}
