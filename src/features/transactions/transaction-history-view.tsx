import Link from 'next/link';

import { formatRM } from '../../domain/money';
import type {
  TransactionFilters,
  TransactionHistory,
  TransactionHistoryItem,
} from './queries';

function typeLabel(transaction: TransactionHistoryItem): string {
  if (transaction.type === 'personal_expense') return 'Personal expense';
  return transaction.sharedStatus === 'resolved'
    ? 'Shared expense — resolved'
    : 'Shared expense — unresolved';
}

function editorLink(transaction: TransactionHistoryItem) {
  if (transaction.type === 'personal_expense') {
    return (
      <Link href={`/expenses#transaction-${transaction.id}`}>
        Edit personal expense
      </Link>
    );
  }
  if (transaction.sharedStatus === 'unresolved') {
    return (
      <Link href={`/shared-bills#transaction-${transaction.id}`}>
        Resolve shared bill
      </Link>
    );
  }
  return (
    <Link href={`/shared-bills#transaction-${transaction.id}`}>
      View locked shared bill
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
    <main>
      <h1>Transactions</h1>
      <p>
        One owner-only history for personal expenses and shared bills.
        Editing stays in each record&apos;s type-specific workflow.
      </p>

      <section aria-labelledby="filters-heading">
        <h2 id="filters-heading">Filter transactions</h2>
        <form method="get">
          <label>
            Search description or merchant
            <input name="search" defaultValue={filters.search} />
          </label>
          <label>
            From
            <input name="from" type="date" defaultValue={filters.from} />
          </label>
          <label>
            To
            <input name="to" type="date" defaultValue={filters.to} />
          </label>
          <label>
            Category
            <select name="categoryId" defaultValue={filters.categoryId ?? ''}>
              <option value="">All categories</option>
              {history.categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>
          <label>
            Payment method
            <select name="paymentMethod" defaultValue={filters.paymentMethod ?? ''}>
              <option value="">All payment methods</option>
              <option value="tng">Touch &apos;n Go</option>
              <option value="cash">Cash</option>
            </select>
          </label>
          <label>
            Transaction type
            <select name="type" defaultValue={filters.type ?? ''}>
              <option value="">Personal and shared</option>
              <option value="personal">Personal</option>
              <option value="shared">Shared</option>
            </select>
          </label>
          <label>
            Shared state
            <select name="sharedStatus" defaultValue={filters.sharedStatus ?? ''}>
              <option value="">Any shared state</option>
              <option value="unresolved">Unresolved</option>
              <option value="resolved">Resolved</option>
            </select>
          </label>
          <label>
            Friend
            <select name="friendId" defaultValue={filters.friendId ?? ''}>
              <option value="">All friends</option>
              {history.friends.map((friend) => (
                <option key={friend.id} value={friend.id}>{friend.name}</option>
              ))}
            </select>
          </label>
          <label>
            Payment-request status
            <select name="requestStatus" defaultValue={filters.requestStatus ?? ''}>
              <option value="">Any payment status</option>
              <option value="unrequested">Unrequested</option>
              <option value="requested">Requested</option>
              <option value="paid">Paid</option>
              <option value="forgiven">Forgiven</option>
            </select>
          </label>
          <label>
            Sort
            <select name="sort" defaultValue={filters.sort}>
              <option value="date">Transaction date</option>
              <option value="amount">Amount</option>
              <option value="newest">Newest recorded</option>
              <option value="friend_outstanding">Friend outstanding</option>
            </select>
          </label>
          <button type="submit">Apply filters</button>
        </form>
      </section>

      <section aria-labelledby="history-heading">
        <h2 id="history-heading">Unified history</h2>
        {history.transactions.length === 0 ? (
          <p>No transactions match these filters.</p>
        ) : (
          <ul>
            {history.transactions.map((transaction) => (
              <li key={transaction.id}>
                <details>
                  <summary>
                    {transaction.transactionDate} — {transaction.description}:{' '}
                    {formatRM(transaction.amountSen)}
                  </summary>
                  <p>{typeLabel(transaction)} · {
                    transaction.paymentMethod === 'tng' ? 'Touch n Go' : 'Cash'
                  }</p>
                  {transaction.merchant ? <p>Merchant: {transaction.merchant}</p> : null}
                  {transaction.categoryName
                    ? <p>Category: {transaction.categoryName}</p>
                    : null}
                  {transaction.type === 'shared_expense'
                    && transaction.sharedStatus === 'resolved' ? (
                      <>
                        <p>
                          Your portion {formatRM(transaction.userPortionSen)}; current friend
                          outstanding {formatRM(transaction.friendOutstandingSen)}
                        </p>
                        <p>Resolved shared allocations are locked.</p>
                        <ul>
                          {transaction.friendPortions.map((portion) => (
                            <li key={`${portion.friendId}:${portion.requestId ?? portion.status}`}>
                              {portion.friendName}: {formatRM(portion.amountSen)} — {portion.status}
                              {portion.requestId ? (
                                <>
                                  {' '}
                                  <Link
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
                  <p>{editorLink(transaction)}</p>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
