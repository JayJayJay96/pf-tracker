import Link from 'next/link';

import { formatMoney } from '../../domain/money';
import {
  Disclosure,
  Empty,
  Field,
  FilterForm,
  PageShell,
  Record,
  RecordList,
  Section,
} from '../ui/page';
import type {
  TransactionFilters,
  TransactionHistory,
  TransactionHistoryItem,
} from './queries';

const LINK_CLASS = 'text-accent underline';

function typeLabel(transaction: TransactionHistoryItem): string {
  if (transaction.type === 'personal_expense') return 'Personal expense';
  return transaction.sharedStatus === 'resolved'
    ? 'Shared expense — resolved'
    : 'Shared expense — unresolved';
}

function editorLink(transaction: TransactionHistoryItem) {
  if (transaction.type === 'personal_expense') {
    return (
      <Link className={LINK_CLASS} href={`/expenses#transaction-${transaction.id}`}>
        Edit personal expense
      </Link>
    );
  }
  return (
    <Link className={LINK_CLASS} href={`/shared-bills#transaction-${transaction.id}`}>
      {transaction.sharedStatus === 'unresolved'
        ? 'Resolve shared bill'
        : 'View locked shared bill'}
    </Link>
  );
}

export function TransactionHistoryView({
  history,
  filters,
}: {
  history: TransactionHistory;
  filters: TransactionFilters;
}) {
  return (
    <PageShell
      intro={'One history for personal expenses and shared bills. Editing stays in '
        + 'each record’s own workflow.'}
      title="Transactions"
    >
      <Section id="filters" title="Filter transactions">
        <FilterForm>
          <Field label="Search description or merchant">
            <input name="search" defaultValue={filters.search} />
          </Field>
          <Field label="From">
            <input name="from" type="date" defaultValue={filters.from} />
          </Field>
          <Field label="To">
            <input name="to" type="date" defaultValue={filters.to} />
          </Field>
          <Field label="Category">
            <select name="categoryId" defaultValue={filters.categoryId ?? ''}>
              <option value="">All categories</option>
              {history.categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Payment method">
            <select name="paymentMethod" defaultValue={filters.paymentMethod ?? ''}>
              <option value="">All payment methods</option>
              <option value="tng">Touch &apos;n Go</option>
              <option value="cash">Cash</option>
            </select>
          </Field>
          <Field label="Transaction type">
            <select name="type" defaultValue={filters.type ?? ''}>
              <option value="">Personal and shared</option>
              <option value="personal">Personal</option>
              <option value="shared">Shared</option>
            </select>
          </Field>
          <Field label="Shared state">
            <select name="sharedStatus" defaultValue={filters.sharedStatus ?? ''}>
              <option value="">Any shared state</option>
              <option value="unresolved">Unresolved</option>
              <option value="resolved">Resolved</option>
            </select>
          </Field>
          <Field label="Friend">
            <select name="friendId" defaultValue={filters.friendId ?? ''}>
              <option value="">All friends</option>
              {history.friends.map((friend) => (
                <option key={friend.id} value={friend.id}>{friend.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Payment-request status">
            <select name="requestStatus" defaultValue={filters.requestStatus ?? ''}>
              <option value="">Any payment status</option>
              <option value="unrequested">Unrequested</option>
              <option value="requested">Requested</option>
              <option value="paid">Paid</option>
              <option value="forgiven">Forgiven</option>
            </select>
          </Field>
          <Field label="Sort">
            <select name="sort" defaultValue={filters.sort}>
              <option value="date">Transaction date</option>
              <option value="amount">Amount</option>
              <option value="newest">Newest recorded</option>
              <option value="friend_outstanding">Friend outstanding</option>
            </select>
          </Field>
          <button
            className="justify-self-start rounded-lg border border-hairline bg-transparent px-4 py-2.5 text-ink hover:border-hairline-strong"
            type="submit"
          >
            Apply filters
          </button>
        </FilterForm>
      </Section>

      <Section id="history" title="Unified history">
        {history.transactions.length === 0 ? (
          <Empty>No transactions match these filters.</Empty>
        ) : (
          <RecordList>
            {history.transactions.map((transaction) => (
              <Record key={transaction.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <strong className="text-ink">{transaction.description}</strong>
                  <span className="font-semibold text-ink tabular-nums">
                    {formatMoney(transaction.amountSen)}
                  </span>
                </div>
                <p className="text-sm text-ink-muted">
                  <time dateTime={transaction.transactionDate}>
                    {transaction.transactionDate}
                  </time>
                  {' · '}
                  {typeLabel(transaction)}
                  {' · '}
                  {transaction.paymentMethod === 'tng' ? 'Touch n Go' : 'Cash'}
                  {transaction.categoryName ? ` · ${transaction.categoryName}` : ''}
                  {transaction.merchant ? ` · ${transaction.merchant}` : ''}
                </p>

                {transaction.type === 'shared_expense'
                  && transaction.sharedStatus === 'resolved' ? (
                    <Disclosure summary="Portions">
                      <p className="text-sm text-ink-muted">
                        Your portion {formatMoney(transaction.userPortionSen)}; friends
                        still owe {formatMoney(transaction.friendOutstandingSen)}. Resolved
                        shared allocations are locked.
                      </p>
                      <ul className="grid list-none gap-1 p-0">
                        {transaction.friendPortions.map((portion) => (
                          <li
                            className="text-sm text-ink-muted"
                            key={`${portion.friendId}:${portion.requestId ?? portion.status}`}
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
                    </Disclosure>
                  ) : null}

                <p className="text-sm">{editorLink(transaction)}</p>
              </Record>
            ))}
          </RecordList>
        )}
      </Section>
    </PageShell>
  );
}
