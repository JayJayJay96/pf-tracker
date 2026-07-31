import { formatMoney } from '../../domain/money';
import { ActionForm } from '../forms/action-form';
import { ConfirmSubmit } from '../forms/confirm-submit';
import { MoneyInput } from '../forms/money-input';
import type { FormResult } from '../forms/result';
import { displayDate, displayDateTime } from '../ui/dates';
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
import { STARTER_CATEGORY_NAMES } from './actions';
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
    createStarterCategories: FormAction;
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
      {/*
        Kept out of the way so Save stays reachable without scrolling. The inner
        grid matches the columns of the row above, so opening this does not
        suddenly present two controls stretched across the whole panel while
        every field beside them is a quarter of that.
      */}
      <div className="col-span-full">
        <Disclosure summary="Add merchant or notes">
          <div className="grid items-end gap-x-3 gap-y-6 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
            <Field label="Merchant">
              <input name="merchant" defaultValue={expense?.merchant ?? ''} />
            </Field>
            <Field label="Notes">
              <textarea name="notes" defaultValue={expense?.notes ?? ''} />
            </Field>
          </div>
        </Disclosure>
      </div>
    </>
  );
}

/** What the filtered list adds up to, so a filter answers a question. */
function filteredTotal(expenses: Expense[]): string {
  return formatMoney(expenses.reduce((sum, expense) => sum + expense.amountSen, 0));
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
        {/*
          An expense needs a category and nothing seeds any, so the first thing a
          new owner met was a disabled form and an instruction to go and invent a
          taxonomy first. One press gets them past it; naming their own categories
          is still there for anyone who wants to.
        */}
        {blocked ? (
          <div className="grid gap-2.5 rounded-lg border border-hairline bg-black/25 px-4 py-3.5">
            <p className="text-sm text-ink-muted">
              An expense needs a category. Start with a common set, or name your
              own below.
            </p>
            <ActionForm
              action={actions?.createStarterCategories}
              successMessage="Categories added. Record your first expense above."
            >
              <button className={SUBMIT_CLASS} type="submit">
                Add {STARTER_CATEGORY_NAMES.join(', ')}
              </button>
            </ActionForm>
          </div>
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

      {/*
        The total belongs beside the heading: the filters below can narrow to one
        category and one month, and answering "how much on food in July" by adding
        the rows up by hand defeats having filtered at all.
      */}
      <Section
        action={expenses.length > 0 ? (
          <p className="text-sm text-ink-muted">
            {expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'}
            {' · '}
            <span className="font-semibold text-ink tabular-nums">
              {filteredTotal(expenses)}
            </span>
          </p>
        ) : undefined}
        id="history"
        title="Transaction history"
      >
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
                    {displayDate(expense.transactionDate)}
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
                    {displayDateTime(expense.recordedAt)}
                  </time>
                </p>

                <Disclosure summary={`Edit ${expense.description}`}>
                  <ActionForm
                    action={actions?.update}
                    resetOnSuccess={false}
                    successMessage="Changes saved."
                  >
                    <input type="hidden" name="expenseId" value={expense.id} />
                    {/*
                      No wrapper grid here. One used to sit between the form and
                      these fields with a tighter row gap, which overrode the
                      gutter a field's validation message is positioned into - so
                      a bad amount in this form collided with the row beneath it.
                      The form's own grid already lays these out.
                    */}
                    <ExpenseFields
                      categories={categories}
                      expense={expense}
                      defaultTransactionDate={defaultTransactionDate}
                    />
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
