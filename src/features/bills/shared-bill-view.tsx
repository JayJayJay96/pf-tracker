import { formatMoney } from '../../domain/money';
import { ActionForm } from '../forms/action-form';
import { ConfirmSubmit } from '../forms/confirm-submit';
import { MoneyInput } from '../forms/money-input';
import type { FormResult } from '../forms/result';
import { displayDate } from '../ui/dates';
import {
  Disclosure,
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
const CHECK_ROW = 'flex min-h-9 items-center gap-2 text-sm text-ink';

type SharedBillViewProps = {
  friends: Friend[];
  bills: SharedBill[];
  defaultTransactionDate: string;
  userId?: string;
  actions?: {
    createFriend: FormAction;
    deleteFriend: FormAction;
    createBill: FormAction;
    resolveBill: FormAction;
    splitEvenly: FormAction;
    deleteBill: FormAction;
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
        {/*
          A list rather than one comma-joined line, because a name typed wrongly
          used to be permanent: there was nowhere to act on an individual friend.
        */}
        {friends.length === 0 ? (
          <Empty>Add a friend before splitting a bill.</Empty>
        ) : (
          <RecordList>
            {friends.map((friend) => (
              <Record key={friend.id}>
                <span className="text-ink">{friend.name}</span>
                <ActionForm action={actions?.deleteFriend} resetOnSuccess={false}>
                  <input type="hidden" name="friendId" value={friend.id} />
                  <ConfirmSubmit
                    label={`Remove ${friend.name}`}
                    description={'This only works while no bill involves them, so '
                      + 'nothing already owed can be lost.'}
                    confirmLabel="Yes, remove them"
                  />
                </ActionForm>
              </Record>
            ))}
          </RecordList>
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
                  <>
                    {/*
                      Splitting evenly is what most bills need, and it used to be
                      reachable only by driving the full editor: name an item,
                      retype the amount, enter a zero discount, tick everyone,
                      then confirm. It leads now, and the editor is here for the
                      bills that genuinely differ per item.
                    */}
                    {friends.length === 0 ? (
                      <Empty>Add a friend above before splitting this bill.</Empty>
                    ) : (
                      <ActionForm
                        action={actions?.splitEvenly}
                        resetOnSuccess={false}
                        successMessage="Split evenly."
                      >
                        <input type="hidden" name="billId" value={bill.id} />
                        <fieldset className="col-span-full grid gap-1 border-0 p-0">
                          <legend className="pb-1 text-sm text-ink-muted">
                            Split evenly with
                          </legend>
                          {friends.map((friend) => (
                            <label className={CHECK_ROW} key={friend.id}>
                              <input
                                type="checkbox"
                                name="friendIds"
                                value={friend.id}
                              />
                              {friend.name}
                            </label>
                          ))}
                        </fieldset>
                        <button className={SUBMIT_CLASS} type="submit">
                          Split evenly
                        </button>
                      </ActionForm>
                    )}

                    <Disclosure summary="Split by item, or add a service charge">
                      <ResolutionEditor
                        billId={bill.id}
                        totalSen={bill.amountSen}
                        friends={friends}
                        action={actions?.resolveBill}
                      />
                    </Disclosure>
                  </>
                ) : (
                  <ul className="grid list-none gap-1 p-0">
                    {bill.friendPortions.map((portion) => (
                      <li className="text-sm text-ink-muted" key={portion.friendName}>
                        {portion.friendName} owes {formatMoney(portion.amountSen)}
                      </li>
                    ))}
                  </ul>
                )}

                {/*
                  A bill was previously permanent once saved, with no way to undo
                  a typo. Deleting removes the bill and its split; if a friend has
                  already been asked to pay, the action explains why it will not.
                */}
                <ActionForm action={actions?.deleteBill} resetOnSuccess={false}>
                  <input type="hidden" name="billId" value={bill.id} />
                  <ConfirmSubmit
                    label={`Delete ${bill.description}`}
                    description={'This permanently removes the bill, its split, and '
                      + 'its effect on the month it belongs to.'}
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
