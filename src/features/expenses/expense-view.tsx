import Link from 'next/link';

import { formatRM } from '../../domain/money';
import { ActionForm } from '../forms/action-form';
import { ConfirmSubmit } from '../forms/confirm-submit';
import { MoneyInput } from '../forms/money-input';
import type { FormResult } from '../forms/result';
import type {
  Expense,
  ExpenseCategory,
  ExpenseFilters,
  PaymentMethod,
} from './types';

type FormAction = (
  previous: FormResult,
  formData: FormData,
) => Promise<FormResult>;

type ExpenseViewProps = {
  categories: ExpenseCategory[];
  expenses: Expense[];
  filters: ExpenseFilters;
  defaultTransactionDate?: string;
  /** Owner's configured default, from profiles.default_payment_method. */
  defaultPaymentMethod?: PaymentMethod;
  /** Category of the most recent expense, so repeat entries need no choosing. */
  defaultCategoryId?: string;
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
  defaultPaymentMethod = 'tng',
  defaultCategoryId,
}: {
  categories: ExpenseCategory[];
  expense?: Expense;
  defaultTransactionDate?: string;
  defaultPaymentMethod?: PaymentMethod;
  defaultCategoryId?: string;
}) {
  return (
    <>
      <MoneyInput
        name="amount"
        label="Amount"
        defaultSen={expense ? expense.amountSen : null}
        required
      />
      <label>
        Description
        <input name="description" required defaultValue={expense?.description} />
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
        <select
          name="categoryId"
          required
          defaultValue={expense?.categoryId ?? defaultCategoryId ?? ''}
        >
          <option value="">Select category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
      </label>
      <label>
        Payment method
        <select
          name="paymentMethod"
          required
          defaultValue={expense?.paymentMethod ?? defaultPaymentMethod}
        >
          <option value="tng">Touch &apos;n Go</option>
          <option value="cash">Cash</option>
        </select>
      </label>
      <details className="optional-fields">
        <summary>Add merchant or notes</summary>
        <label>
          Merchant
          <input name="merchant" defaultValue={expense?.merchant ?? ''} />
        </label>
        <label>
          Notes
          <textarea name="notes" defaultValue={expense?.notes ?? ''} />
        </label>
      </details>
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
  defaultPaymentMethod,
  defaultCategoryId,
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
        {categories.length === 0 ? (
          <p className="notice-panel">
            Add your first category below, then this form unlocks.
          </p>
        ) : null}
        <ActionForm
          action={actions?.create}
          userId={userId}
          formId={userId ? 'personal-expense' : undefined}
          successMessage="Expense saved."
          clearOnSuccess={['amount', 'description', 'merchant', 'notes']}
        >
          <ExpenseFields
            categories={categories}
            defaultTransactionDate={defaultTransactionDate}
            defaultPaymentMethod={defaultPaymentMethod}
            defaultCategoryId={defaultCategoryId}
          />
          <button
            type="submit"
            disabled={categories.length === 0}
            aria-describedby={categories.length === 0 ? 'save-expense-blocked' : undefined}
          >
            Save expense
          </button>
          {categories.length === 0 ? (
            <span className="field-hint" id="save-expense-blocked">
              A category is required before an expense can be saved.
            </span>
          ) : null}
        </ActionForm>
      </section>

      <section aria-labelledby="categories-heading">
        <h2 id="categories-heading">Expense categories</h2>
        <ActionForm action={actions?.createCategory} successMessage="Category added.">
          <label className="field">
            <span className="field-label">New category name</span>
            <input name="name" required />
          </label>
          <button type="submit">Add category</button>
        </ActionForm>
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
                  <ActionForm
                    action={actions?.update}
                    resetOnSuccess={false}
                    successMessage="Changes saved."
                  >
                    <input type="hidden" name="expenseId" value={expense.id} />
                    <ExpenseFields
                      categories={categories}
                      expense={expense}
                      defaultTransactionDate={defaultTransactionDate}
                    />
                    <button type="submit">Save expense changes</button>
                  </ActionForm>
                </details>
                <ActionForm action={actions?.delete} resetOnSuccess={false}>
                  <input type="hidden" name="expenseId" value={expense.id} />
                  <ConfirmSubmit
                    label={`Delete ${expense.description}`}
                    description={'This permanently removes the expense and updates its '
                      + 'historical month.'}
                    confirmLabel="Yes, delete permanently"
                  />
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
