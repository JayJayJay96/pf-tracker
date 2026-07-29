import Link from 'next/link';

import { formatRM } from '../../domain/money';
import type {
  ReportPeriodInput,
  ReportResult,
} from './queries';

function displayDate(value: string): string {
  return new Intl.DateTimeFormat('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

function metricRows(summary: ReportResult['summary']) {
  return [
    ['Income received', summary.incomeSen],
    ['Pending income (excluded)', summary.pendingIncomeSen],
    ['Commitments', summary.commitmentsSen],
    ['Savings', summary.savingsSen],
    ['Investments', summary.investmentsSen],
    ['Personal spending', summary.personalSpendingSen],
    ['Remaining spendable', summary.remainingSpendableSen],
    ['Total amount paid', summary.totalPaidSen],
    ['Paid for friends', summary.paidForFriendsSen],
    ['Requested from friends', summary.requestedSen],
    ['Collected from friends', summary.collectedSen],
    ['Still outstanding', summary.outstandingSen],
  ] as const;
}

function formatSignedAmount(amountSen: number): string {
  if (amountSen < 0) return `−${formatRM(Math.abs(amountSen))}`;
  return formatRM(amountSen);
}

function formatChange(amountSen: number): string {
  if (amountSen > 0) return `+${formatRM(amountSen)}`;
  return formatSignedAmount(amountSen);
}

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
    <main>
      <h1>{report.period.label} report</h1>
      <p>
        Reporting uses transaction dates. Recorded dates remain visible for audit context.
        Friend repayments are collections, never income.
      </p>

      <section aria-labelledby="range-heading">
        <h2 id="range-heading">Report range</h2>
        <form method="get">
          <label>
            Range
            <select name="range" defaultValue={selection.kind}>
              <option value="month">Specific month</option>
              <option value="custom">Custom date range</option>
              <option value="ytd">Year to date</option>
              <option value="year">Specific year</option>
            </select>
          </label>
          <label>
            Month
            <input
              name="month"
              type="month"
              defaultValue={selection.kind === 'month' ? selection.month : today.slice(0, 7)}
            />
          </label>
          <label>
            From
            <input
              name="from"
              type="date"
              defaultValue={selection.kind === 'custom' ? selection.from : today}
            />
          </label>
          <label>
            To
            <input
              name="to"
              type="date"
              defaultValue={selection.kind === 'custom' ? selection.to : today}
            />
          </label>
          <label>
            Year
            <input
              name="year"
              type="number"
              min="2000"
              max="9999"
              defaultValue={'year' in selection ? selection.year : today.slice(0, 4)}
            />
          </label>
          <button type="submit">View report</button>
        </form>
      </section>

      <section aria-labelledby="summary-heading">
        <h2 id="summary-heading">Financial summary</h2>
        <dl>
          {metricRows(report.summary).map(([label, amount]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{formatSignedAmount(amount)}</dd>
            </div>
          ))}
        </dl>
      </section>

      {report.comparison ? (
        <section aria-labelledby="comparison-heading">
          <h2 id="comparison-heading">Compared with {report.comparison.period.label}</h2>
          <table>
            <thead>
              <tr>
                <th scope="col">Metric</th>
                <th scope="col">Current</th>
                <th scope="col">Previous</th>
                <th scope="col">Change</th>
              </tr>
            </thead>
            <tbody>
              {([
                ['Income', report.comparison.incomeSen],
                ['Commitments', report.comparison.commitmentsSen],
                ['Savings', report.comparison.savingsSen],
                ['Investments', report.comparison.investmentsSen],
                ['Personal spending', report.comparison.personalSpendingSen],
                ['Outstanding', report.comparison.outstandingSen],
              ] as const).map(([label, metric]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td>{formatRM(metric.currentSen)}</td>
                  <td>{formatRM(metric.previousSen)}</td>
                  <td>{formatChange(metric.changeSen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <section aria-labelledby="history-heading">
        <h2 id="history-heading">Historical transactions</h2>
        {report.transactions.length === 0 ? <p>No transactions in this period.</p> : (
          <ul>
            {report.transactions.map((transaction) => (
              <li key={transaction.id}>
                <details>
                  <summary>
                    {transaction.transactionDate} — {transaction.description}:{' '}
                    {formatRM(transaction.amountSen)}
                  </summary>
                  <p>
                    {transaction.type === 'shared_expense' ? 'Shared expense' : 'Personal expense'}
                    {transaction.sharedStatus ? ` — ${transaction.sharedStatus}` : ''}
                    {transaction.categoryName ? ` — ${transaction.categoryName}` : ''}
                  </p>
                  {transaction.type === 'shared_expense' && transaction.sharedStatus === 'resolved'
                    ? (
                      <p>
                        Your portion {formatRM(transaction.userPortionSen)}; friend portions{' '}
                        {formatRM(transaction.friendPortionSen)}
                      </p>
                    )
                    : null}
                  {transaction.items.length > 0 ? (
                    <>
                      <h3>Bill items</h3>
                      <ul>
                        {transaction.items.map((item) => (
                          <li key={item.id}>
                            {item.description}: {formatRM(item.amountSen)}
                            {item.discountSen > 0
                              ? ` (${formatRM(item.discountSen)} discount)`
                              : ''}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                  {transaction.friendPortions.length > 0 ? (
                    <>
                      <h3>Friend portions</h3>
                      <ul>
                        {transaction.friendPortions.map((portion) => (
                          <li key={`${portion.friendId}:${portion.requestId ?? 'unrequested'}`}>
                            {portion.friendName}: {formatRM(portion.amountSen)} — {portion.status}
                            {portion.requestId ? (
                              <>
                                {' '}
                                <Link href={`/friends/${portion.friendId}/requests/${portion.requestId}`}>
                                  View payment request
                                </Link>
                              </>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                  <p>
                    Recorded{' '}
                    <time dateTime={transaction.recordedAt}>
                      {displayDate(transaction.recordedAt)}
                    </time>
                  </p>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="export-heading">
        <h2 id="export-heading">Private exports</h2>
        <p>Exports are generated on demand for the signed-in owner and are never cached.</p>
        <ul>
          <li><a href="/api/export/transactions">Transactions CSV</a></li>
          <li><a href="/api/export/friends">Friend balances CSV</a></li>
          <li><a href="/api/export/requests">Payment requests CSV</a></li>
          <li><a href="/api/export/backup">Full JSON backup</a></li>
        </ul>
      </section>
    </main>
  );
}
