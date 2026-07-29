import { formatRM } from '../../domain/money';
import { MoneyInput } from '../forms/money-input';
import type { FormResult } from '../forms/result';
import { ActionForm } from '../forms/action-form';
import type { Friend, SharedBill } from './queries';
import { ResolutionEditor } from './resolution-editor';

type FormAction = (
  previous: FormResult,
  formData: FormData,
) => Promise<FormResult>;

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

function SharedBillFields({ defaultTransactionDate }: { defaultTransactionDate: string }) {
  return (
    <>
      <MoneyInput name="amount" label="Amount" required />
      <label>
        Description
        <input name="description" required />
      </label>
      <label>
        Transaction date
        <input
          name="transactionDate"
          type="date"
          defaultValue={defaultTransactionDate}
          required
        />
      </label>
      <label>
        Payment method
        <select name="paymentMethod" defaultValue="tng" required>
          <option value="tng">Touch &apos;n Go</option>
          <option value="cash">Cash</option>
        </select>
      </label>
      <button type="submit">Save unresolved bill</button>
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
    <main>
      <h1>Shared Bills</h1>

      <section aria-labelledby="record-bill-heading">
        <h2 id="record-bill-heading">Record shared bill</h2>
        <ActionForm
          action={actions?.createBill}
          userId={userId}
          formId={userId ? 'shared-bill' : undefined}
          successMessage="Shared bill saved."
        >
          <SharedBillFields defaultTransactionDate={defaultTransactionDate} />
        </ActionForm>
      </section>

      <section aria-labelledby="friends-heading">
        <h2 id="friends-heading">Friends</h2>
        <ActionForm action={actions?.createFriend}>
          <label>
            Friend name
            <input name="name" required />
          </label>
          <button type="submit">Add friend</button>
        </ActionForm>
        {friends.length === 0
          ? <p>Add a friend before resolving a bill.</p>
          : <p>{friends.map(({ name }) => name).join(', ')}</p>}
      </section>

      <section aria-labelledby="shared-bills-heading">
        <h2 id="shared-bills-heading">Shared bill history</h2>
        {bills.length === 0 ? <p>No shared bills recorded.</p> : (
          <ul>
            {bills.map((bill) => (
              <li key={bill.id} id={`transaction-${bill.id}`}>
                <strong>{bill.description}</strong>{' '}
                <span>{formatRM(bill.amountSen)} cash outflow</span>{' '}
                <time dateTime={bill.transactionDate}>{bill.transactionDate}</time>
                {bill.status === 'unresolved' ? (
                  <>
                    <p>Unresolved — personal spending is not final yet.</p>
                    <ResolutionEditor
                      billId={bill.id}
                      totalSen={bill.amountSen}
                      friends={friends}
                      action={actions?.resolveBill}
                    />
                  </>
                ) : (
                  <>
                    <p>Resolved — Your portion {formatRM(bill.userPortionSen)}</p>
                    {bill.friendPortions.map((portion) => (
                      <p key={portion.friendName}>
                        {portion.friendName} owes {formatRM(portion.amountSen)}
                      </p>
                    ))}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
