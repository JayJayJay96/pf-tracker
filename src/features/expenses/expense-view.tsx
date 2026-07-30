import { formatMoney } from '../../domain/money';
import { ActionForm } from '../forms/action-form';
import { ConfirmSubmit } from '../forms/confirm-submit';
import { MoneyInput } from '../forms/money-input';
import type { FormResult } from '../forms/result';
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
  Expense,
  ExpenseCategory,
  ExpenseFilters,
  PaymentMethod,
} from './types';

type FormAction = (
  previous: FormResult,
  formData: FormData,
) => Promise<FormResult>;

const SUBMIT_CLASS = 'justify-self-start rounded-lg border border-hairline-strong '
  + 'bg-accent-soft px-4 py-2.5 font-semibold text-ink hover:border-accent '
  + 'hover:bg-accent/20 disabled:cursor-not-allowed disabled:border-ink-muted/35 '
  + 'disabled:bg-transparent disabled:text-ink-muted';
const QUIET_SUBMIT_CLASS = 'justify-self-start rounded-lg border border-hairline '
  + 'bg-transparent px-4 py-2.5 text-ink hover:border-hairline-strong';

type ExpenseViewProps = {
  categories: ExpenseCategory[];
  expenses: Expense[];
  filters: ExpenseFilters;
  defaultTransactionDate?: string;
  /** Owner's configured default, from profiles.default_payment_method. */
  defaultPaymentMethod?: PaymentMethod;
  /** Category of the most recent expense, so repeat entries need no choosing. */
  defaultCategoryId?: string;
  /** Focuses the amount on arrival, for the Add shortcut on mobile. */
  autoFocusAmount?: boolean;
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
  autoFocusAmount,
}: {
  categories: ExpenseCategory[];
  expense?: Expense;
  defaultTransactionDate?: string;
  defaultPaymentMethod?: PaymentMethod;
  defaultCategoryId?: string;
  autoFocusAmount?: boolean;
}) {
  return (
    <>
      <MoneyInput
        name="amount"
        label="Amount"
        defaultSen={expense ? expense.amountSen : null}
        autoFocus={autoFocusAmount}
        required
      />
      <Field label="Description">
        <input name="description" required defaultValue={expense?.description} />
      </Field>
      <Field label="Transaction date">
        <input
          name="transactionDate"
          type="date"
          required
          defaultValue={expense?.transactionDate ?? defaultTransactionDate}
        />
      </Field>
      <Field label="Category">
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
      </Field>
      <Field label="Payment method">
        <select
          name="paymentMethod"
          required
          defaultValue={expense?.paymentMethod ?? defaultPaymentMethod}
        >
          <option value="tng">Touch &apos;n Go</option>
          <option value="cash">Cash</option>
        </select>
      </Field>
      {/* Kept out of the way so Save stays reachable without scrolling. */}
      <div className="col-span-full">
        <Disclosure summary="Add merchant or notes">
          <Field label="Merchant">
            <input name="merchant" defaultValue={expense?.merchant ?? ''} />
          </Field>
          <Field label="Notes">
            <textarea name="notes" defaultValue={expense?.notes ?? ''} />
          </Field>
        </Disclosure>
      </div>
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
  autoFocusAmount,
  userId,
  actions,
}: ExpenseViewProps) {
  const blocked = categories.length === 0;
  return (
    <PageShell title="Personal Expenses">
      <Section id="add-expense" title="Add personal expense">
        {blocked ? (
          <p className="rounded-lg border border-hairline bg-black/25 px-4 py-3 text-sm text-ink-muted">
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
            autoFocusAmount={autoFocusAmount}
          />
          <button
            className={SUBMIT_CLASS}
            type="submit"
            disabled={blocked}
            aria-describedby={blocked ? 'save-expense-blocked' : undefined}
          >
            Save expense
          </button>
          {blocked ? (
            <span className="text-sm text-ink-muted" id="save-expense-blocked">
              A category is required before an expense can be saved.
            </span>
          ) : null}
        </ActionForm>
      </Section>

      <Section id="categories" title="Expense categories">
        <ActionForm action={actions?.createCategory} successMessage="Category added.">
          <Field label="New category name">
            <input name="name" required />
          </Field>
          <button className={QUIET_SUBMIT_CLASS} type="submit">Add category</button>
        </ActionForm>
        {blocked ? (
          <Empty>Add a category before recording an expense.</Empty>
        ) : (
          <p className="text-sm text-ink-muted">
            {categories.map((category) => category.name).join(', ')}
          </p>
        )}
      </Section>

      <Section id="history" title="Transaction history">
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
          <Field label="Category filter">
            <select name="categoryId" defaultValue={filters.categoryId ?? ''}>
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Payment method filter">
            <select name="paymentMethod" defaultValue={filters.paymentMethod ?? ''}>
              <option value="">All payment methods</option>
              <option value="tng">Touch &apos;n Go</option>
              <option value="cash">Cash</option>
            </select>
          </Field>
          <button className={QUIET_SUBMIT_CLASS} type="submit">Filter history</button>
        </FilterForm>

        {expenses.length === 0 ? (
          <Empty>No personal expenses match these filters.</Empty>
        ) : (
          <RecordList>
            {expenses.map((expense) => (
              <Record id={`transaction-${expense.id}`} key={expense.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <strong className="text-ink">{expense.description}</strong>
                  <span className="font-semibold text-ink tabular-nums">
                    {formatMoney(expense.amountSen)}
                  </span>
                </div>
                <p className="text-sm text-ink-muted">
                  <time dateTime={expense.transactionDate}>
                    {expense.transactionDate}
                  </time>
                  {' · '}
                  {expense.categoryName}
                  {' · '}
                  {expense.paymentMethod === 'tng' ? 'Touch n Go' : 'Cash'}
                  {expense.merchant ? ` · ${expense.merchant}` : ''}
                </p>
                {expense.notes ? (
                  <p className="text-sm text-ink-muted">Notes: {expense.notes}</p>
                ) : null}
                <p className="text-sm text-ink-muted">
                  Recorded{' '}
                  <time dateTime={expense.recordedAt}>
                    {recordedLabel(expense.recordedAt)}
                  </time>
                </p>

                <Disclosure summary={`Edit ${expense.description}`}>
                  <ActionForm
                    action={actions?.update}
                    resetOnSuccess={false}
                    successMessage="Changes saved."
                  >
                    <input type="hidden" name="expenseId" value={expense.id} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <ExpenseFields
                        categories={categories}
                        expense={expense}
                        defaultTransactionDate={defaultTransactionDate}
                      />
                    </div>
                    <button className={QUIET_SUBMIT_CLASS} type="submit">
                      Save expense changes
                    </button>
                  </ActionForm>
                </Disclosure>

                <ActionForm action={actions?.delete} resetOnSuccess={false}>
                  <input type="hidden" name="expenseId" value={expense.id} />
                  <ConfirmSubmit
                    label={`Delete ${expense.description}`}
                    description={'This permanently removes the expense and updates its '
                      + 'historical month.'}
                    confirmLabel="Yes, delete permanently"
                  />
                </ActionForm>
              </Record>
            ))}
          </RecordList>
        )}
      </Section>
    </PageShell>
  );
}
