import { formatMoney } from '../../domain/money';
import { ActionForm } from '../forms/action-form';
import { MoneyInput } from '../forms/money-input';
import type { FormResult } from '../forms/result';
import { displayDate } from '../ui/dates';
import {
  Empty,
  Field,
  PageShell,
  Record,
  RecordList,
  Section,
} from '../ui/page';
import type { Friend, SharedBill } from './queries';
import { ResolutionEditor } from './resolution-editor';

type FormAction = (
  previous: FormResult,
  formData: FormData,
) => Promise<FormResult>;

const SUBMIT_CLASS = 'justify-self-start rounded-lg border border-hairline-strong '
  + 'bg-accent-soft px-4 py-2.5 font-semibold text-ink hover:border-accent '
  + 'hover:bg-accent/20';
const QUIET_SUBMIT_CLASS = 'justify-self-start rounded-lg border border-hairline '
  + 'bg-transparent px-4 py-2.5 text-ink hover:border-hairline-strong';

type SharedBillViewProps = {
  friends: Friend[];
  bills: SharedBill[];
  defaultTransactionDate: string;
  userId?: string;
  actions?: {
    createFriend: FormAction;
    createBill: FormAction;
    resolveBill: FormAction;
  };
};

function SharedBillFields({
  defaultTransactionDate,
}: {
  defaultTransactionDate: string;
}) {
  return (
    <>
      <MoneyInput name="amount" label="Amount" required />
      <Field label="Description">
        <input name="description" required />
      </Field>
      <Field label="Transaction date">
        <input
          name="transactionDate"
          type="date"
          defaultValue={defaultTransactionDate}
          required
        />
      </Field>
      <Field label="Payment method">
        <select name="paymentMethod" defaultValue="tng" required>
          <option value="tng">Touch &apos;n Go</option>
          <option value="cash">Cash</option>
        </select>
      </Field>
      <button className={SUBMIT_CLASS} type="submit">Save unresolved bill</button>
    </>
  );
}

export function SharedBillView({
  friends,
  bills,
  defaultTransactionDate,
  userId,
  actions,
}: SharedBillViewProps) {
  return (
    <PageShell title="Shared Bills">
      <Section id="record-bill" title="Record shared bill">
        <ActionForm
          action={actions?.createBill}
          userId={userId}
          formId={userId ? 'shared-bill' : undefined}
          successMessage="Shared bill saved."
        >
          <SharedBillFields defaultTransactionDate={defaultTransactionDate} />
        </ActionForm>
      </Section>

      <Section id="friends" title="Friends">
        <ActionForm action={actions?.createFriend} successMessage="Friend added.">
          <Field label="Friend name">
            <input name="name" required />
          </Field>
          <button className={QUIET_SUBMIT_CLASS} type="submit">Add friend</button>
        </ActionForm>
        {friends.length === 0 ? (
          <Empty>Add a friend before resolving a bill.</Empty>
        ) : (
          <p className="text-sm text-ink-muted">
            {friends.map(({ name }) => name).join(', ')}
          </p>
        )}
      </Section>

      <Section id="shared-bills" title="Shared bill history">
        {bills.length === 0 ? <Empty>No shared bills recorded.</Empty> : (
          <RecordList>
            {bills.map((bill) => (
              <Record id={`transaction-${bill.id}`} key={bill.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <strong className="text-ink">{bill.description}</strong>
                  <span className="font-semibold text-ink tabular-nums">
                    {formatMoney(bill.amountSen)} cash outflow
                  </span>
                </div>
                <p className="text-sm text-ink-muted">
                  <time dateTime={bill.transactionDate}>
                    {displayDate(bill.transactionDate)}
                  </time>
                  {bill.status === 'unresolved'
                    ? ' · Unresolved — personal spending is not final yet.'
                    : ` · Resolved — your portion ${formatMoney(bill.userPortionSen)}`}
                </p>

                {bill.status === 'unresolved' ? (
                  <ResolutionEditor
                    billId={bill.id}
                    totalSen={bill.amountSen}
                    friends={friends}
                    action={actions?.resolveBill}
                  />
                ) : (
                  <ul className="grid list-none gap-1 p-0">
                    {bill.friendPortions.map((portion) => (
                      <li className="text-sm text-ink-muted" key={portion.friendName}>
                        {portion.friendName} owes {formatMoney(portion.amountSen)}
                      </li>
                    ))}
                  </ul>
                )}
              </Record>
            ))}
          </RecordList>
        )}
      </Section>
    </PageShell>
  );
}
