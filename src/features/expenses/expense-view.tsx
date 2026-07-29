import Link from 'next/link';

import { formatRM } from '../../domain/money';
import { DraftForm } from '../forms/draft-form';
import type { Expense, ExpenseCategory, ExpenseFilters } from './types';

type FormAction = (formData: FormData) => void | Promise<void>;

type ExpenseViewProps = {
  categories: ExpenseCategory[];
  expenses: Expense[];
  filters: ExpenseFilters;
  defaultTransactionDate?: string;
  userId?: string;
  actions?: {
    createCategory: FormAction;
    create: FormAction;
    update: FormAction;
    delete: FormAction;
  };
};

function ExpenseFields({
  categories,
  expense,
  defaultTransactionDate,
}: {
  categories: ExpenseCategory[];
  expense?: Expense;
  defaultTransactionDate?: string;
}) {
  return (
    <>
      <label>
        Amount
        <input
          name="amount"
          inputMode="decimal"
          pattern="RM(?:0|[1-9][0-9]*)\.[0-9]{2}"
          placeholder="RM0.00"
          required
          defaultValue={expense ? formatRM(expense.amountSen) : undefined}
        />
      </label>
      <label>
        Description
        <input name="description" required defaultValue={expense?.description} />
      </label>
      <label>
        Merchant
        <input name="merchant" defaultValue={expense?.merchant ?? ''} />
      </label>
      <label>
        Transaction date
        <input
          name="transactionDate"
          type="date"
          required
          defaultValue={expense?.transactionDate ?? defaultTransactionDate}
        />
      </label>
      <label>
        Category
        <select name="categoryId" required defaultValue={expense?.categoryId}>
          <option value="">Select category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
      </label>
      <label>
        Payment method
        <select name="paymentMethod" required defaultValue={expense?.paymentMethod ?? 'tng'}>
          <option value="tng">Touch &apos;n Go</option>
          <option value="cash">Cash</option>
        </select>
      </label>
      <label>
        Notes
        <textarea name="notes" defaultValue={expense?.notes ?? ''} />
      </label>
    </>
  );
}

function recordedLabel(recordedAt: string): string {
  return new Intl.DateTimeFormat('en-MY', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kuala_Lumpur',
  }).format(new Date(recordedAt));
}

export function ExpenseView({
  categories,
  expenses,
  filters,
  defaultTransactionDate,
  userId,
  actions,
}: ExpenseViewProps) {
  return (
    <main>
      <nav aria-label="Primary">
        <Link href="/">Dashboard</Link>{' '}
        <Link href="/transactions">Transactions</Link>{' '}
        <Link href="/plan">Monthly Plan</Link>{' '}
        <Link href="/reports">Reports</Link>
      </nav>
      <h1>Personal Expenses</h1>

      <section aria-labelledby="add-expense-heading">
        <h2 id="add-expense-heading">Add personal expense</h2>
        {userId ? <DraftForm
          action={actions?.create}
          userId={userId}
          formId="personal-expense"
        >
          <ExpenseFields
            categories={categories}
            defaultTransactionDate={defaultTransactionDate}
          />
          <button type="submit" disabled={categories.length === 0}>Save expense</button>
        </DraftForm> : (
          <form action={actions?.create}>
            <ExpenseFields
              categories={categories}
              defaultTransactionDate={defaultTransactionDate}
            />
            <button type="submit" disabled={categories.length === 0}>Save expense</button>
          </form>
        )}
      </section>

      <section aria-labelledby="categories-heading">
        <h2 id="categories-heading">Expense categories</h2>
        <form action={actions?.createCategory}>
          <label>
            New category name
            <input name="name" required />
          </label>
          <button type="submit">Add category</button>
        </form>
        {categories.length === 0 ? <p>Add a category before recording an expense.</p> : (
          <p>{categories.map((category) => category.name).join(', ')}</p>
        )}
      </section>

      <section aria-labelledby="history-heading">
        <h2 id="history-heading">Transaction history</h2>
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
            Category filter
            <select name="categoryId" defaultValue={filters.categoryId ?? ''}>
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>
          <label>
            Payment method filter
            <select name="paymentMethod" defaultValue={filters.paymentMethod ?? ''}>
              <option value="">All payment methods</option>
              <option value="tng">Touch &apos;n Go</option>
              <option value="cash">Cash</option>
            </select>
          </label>
          <button type="submit">Filter history</button>
        </form>

        {expenses.length === 0 ? <p>No personal expenses match these filters.</p> : (
          <ul>
            {expenses.map((expense) => (
              <li key={expense.id} id={`transaction-${expense.id}`}>
                <strong>{expense.description}</strong>{' '}
                <span>{formatRM(expense.amountSen)}</span>{' '}
                <time dateTime={expense.transactionDate}>{expense.transactionDate}</time>{' '}
                <span>{expense.categoryName}</span>{' '}
                <span>{expense.paymentMethod === 'tng' ? 'Touch n Go' : 'Cash'}</span>
                {expense.merchant ? <p>Merchant: {expense.merchant}</p> : null}
                {expense.notes ? <p>Notes: {expense.notes}</p> : null}
                <p>
                  Recorded{' '}
                  <time dateTime={expense.recordedAt}>{recordedLabel(expense.recordedAt)}</time>
                </p>
                <details>
                  <summary>Edit {expense.description}</summary>
                  <form action={actions?.update}>
                    <input type="hidden" name="expenseId" value={expense.id} />
                    <ExpenseFields categories={categories} expense={expense} />
                    <button type="submit">Save expense changes</button>
                  </form>
                </details>
                <details>
                  <summary>Delete {expense.description}?</summary>
                  <p>This permanently removes the expense and updates its historical month.</p>
                  <form action={actions?.delete}>
                    <input type="hidden" name="expenseId" value={expense.id} />
                    <button type="submit">Confirm permanent deletion</button>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
