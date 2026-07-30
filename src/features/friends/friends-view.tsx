import Link from 'next/link';

import { formatMoney, formatRM } from '../../domain/money';
import { ActionForm } from '../forms/action-form';
import type { FormResult } from '../forms/result';
import {
  Empty,
  Field,
  Figures,
  PageShell,
  Record,
  RecordList,
  Section,
} from '../ui/page';
import { buildPaymentSummary } from './payment-summary';
import type { FriendBalance, LedgerPortion, PaymentRequest } from './queries';

type FormAction = (
  previous: FormResult,
  formData: FormData,
) => Promise<FormResult>;

const LINK_CLASS = 'text-accent underline';
const SUBMIT_CLASS = 'justify-self-start rounded-lg border border-hairline-strong '
  + 'bg-accent-soft px-4 py-2.5 font-semibold text-ink hover:border-accent '
  + 'hover:bg-accent/20';

/** The balances every friend screen shows, in one order. */
function balanceRows(friend: FriendBalance) {
  return [
    ['Outstanding', `${formatMoney(friend.outstandingSen)} outstanding`],
    ['Unrequested', `${formatMoney(friend.unrequestedSen)} unrequested`],
    ['Requested', `${formatMoney(friend.requestedSen)} requested`],
    ['Paid', `${formatMoney(friend.paidSen)} paid`],
    ['Forgiven', `${formatMoney(friend.forgivenSen)} forgiven`],
  ] as const;
}

export function FriendsView({ friends }: { friends: FriendBalance[] }) {
  return (
    <PageShell title="Friends">
      <Section id="friends" title="Ledgers">
        {friends.length === 0 ? (
          <Empty>Add and allocate a friend on Shared Bills to start a ledger.</Empty>
        ) : (
          <RecordList>
            {friends.map((friend) => (
              <Record key={friend.id}>
                <Link className={LINK_CLASS} href={`/friends/${friend.id}`}>
                  <strong>{friend.name}</strong>
                </Link>
                <p className="text-sm text-ink-muted">
                  {formatMoney(friend.outstandingSen)} outstanding
                  {' · '}
                  {formatMoney(friend.unrequestedSen)} unrequested
                  {' · '}
                  {formatMoney(friend.requestedSen)} requested
                </p>
                <p className="text-sm text-ink-muted">
                  {formatMoney(friend.paidSen)} paid
                  {' · '}
                  {formatMoney(friend.forgivenSen)} forgiven
                  {' · '}
                  {friend.pendingRequestCount} pending requests
                </p>
              </Record>
            ))}
          </RecordList>
        )}
      </Section>
    </PageShell>
  );
}

export function FriendLedgerView({
  friend,
  ledger,
  requests,
  defaultRequestDate,
  createRequestAction,
}: {
  friend: FriendBalance;
  ledger: LedgerPortion[];
  requests: PaymentRequest[];
  defaultRequestDate: string;
  createRequestAction?: FormAction;
}) {
  const unrequested = ledger.filter(({ status }) => status === 'unrequested');
  return (
    <PageShell
      intro={<Link className={LINK_CLASS} href="/friends">Back to all friends</Link>}
      title={friend.name}
    >
      {friend.nickname || friend.phone || friend.notes || !friend.active ? (
        <Section id="profile" title="Profile">
          {friend.nickname ? (
            <p className="text-sm text-ink-muted">Nickname: {friend.nickname}</p>
          ) : null}
          {friend.phone ? (
            <p className="text-sm text-ink-muted">Phone: {friend.phone}</p>
          ) : null}
          {friend.notes ? (
            <p className="text-sm text-ink-muted">Notes: {friend.notes}</p>
          ) : null}
          {!friend.active ? <p className="text-sm text-ink-muted">Archived</p> : null}
        </Section>
      ) : null}

      <Section id="balance" title="Balance">
        <Figures rows={balanceRows(friend)} />
      </Section>

      <Section id="request" title="Create lump-sum request">
        {unrequested.length === 0 ? (
          <Empty>No unrequested portions are available.</Empty>
        ) : (
          <ActionForm action={createRequestAction}>
            <input type="hidden" name="friendId" value={friend.id} />
            <fieldset className="grid gap-1.5 border-0 p-0">
              <legend className="pb-1 text-sm text-ink-muted">
                Portions to request
              </legend>
              {unrequested.map((portion) => (
                <label
                  className="flex min-h-9 items-center gap-2 text-sm text-ink"
                  key={portion.portionId}
                >
                  <input type="checkbox" name="portionIds" value={portion.portionId} />
                  {portion.transactionDate} — {portion.description}:{' '}
                  {formatMoney(portion.amountSen)}
                </label>
              ))}
            </fieldset>
            <Field label="Request date">
              <input
                name="requestDate"
                type="date"
                defaultValue={defaultRequestDate}
                required
              />
            </Field>
            <Field label="Note">
              <input name="note" />
            </Field>
            <button className={SUBMIT_CLASS} type="submit">Create payment request</button>
          </ActionForm>
        )}
      </Section>

      <Section id="ledger" title="Ledger">
        {ledger.length === 0 ? <Empty>No friend portions yet.</Empty> : (
          <RecordList>
            {ledger.map((portion) => (
              <Record key={`${portion.transactionDate}:${portion.portionId}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <strong className="text-ink">{portion.description}</strong>
                  <span className="font-semibold text-ink tabular-nums">
                    {formatMoney(portion.amountSen)}
                  </span>
                </div>
                <p className="text-sm text-ink-muted">
                  <time dateTime={portion.transactionDate}>
                    {portion.transactionDate}
                  </time>
                  {' · '}
                  {portion.status}
                  {portion.settledOn ? ` on ${portion.settledOn}` : ''}
                  {portion.requestId ? (
                    <>
                      {' · '}
                      <Link
                        className={LINK_CLASS}
                        href={`/friends/${friend.id}/requests/${portion.requestId}`}
                      >
                        View request
                      </Link>
                    </>
                  ) : null}
                </p>
              </Record>
            ))}
          </RecordList>
        )}
      </Section>

      <Section id="history" title="Payment request history">
        {requests.length === 0 ? <Empty>No payment requests yet.</Empty> : (
          <RecordList>
            {requests.map((request) => (
              <Record key={request.id}>
                <Link
                  className={LINK_CLASS}
                  href={`/friends/${friend.id}/requests/${request.id}`}
                >
                  {request.requestDate} — {formatMoney(request.totalSen)}
                </Link>
                <p className="text-sm text-ink-muted">{request.status}</p>
              </Record>
            ))}
          </RecordList>
        )}
      </Section>
    </PageShell>
  );
}

/** One of the three ways a pending request can be closed. */
function SettleForm({
  action,
  requestId,
  status,
  occurredOn,
  confirmation,
  submitLabel,
  paidAmount,
  withPaidDate = false,
}: {
  action?: FormAction;
  requestId: string;
  status: 'paid' | 'cancelled' | 'forgiven';
  occurredOn: string;
  confirmation: string;
  submitLabel: string;
  paidAmount?: string;
  withPaidDate?: boolean;
}) {
  return (
    <ActionForm action={action} resetOnSuccess={false}>
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="status" value={status} />
      {paidAmount !== undefined ? (
        <input type="hidden" name="paidAmount" value={paidAmount} />
      ) : null}
      {withPaidDate ? (
        <Field label="Paid date">
          <input type="date" name="occurredOn" defaultValue={occurredOn} required />
        </Field>
      ) : (
        <input type="hidden" name="occurredOn" value={occurredOn} />
      )}
      <label className="flex min-h-9 items-center gap-2 text-sm text-ink">
        <input type="checkbox" required />
        {confirmation}
      </label>
      <button className={SUBMIT_CLASS} type="submit">{submitLabel}</button>
    </ActionForm>
  );
}

export function PaymentRequestView({
  friend,
  request,
  defaultOccurredOn,
  transitionAction,
}: {
  friend: FriendBalance;
  request: PaymentRequest;
  defaultOccurredOn: string;
  transitionAction?: FormAction;
}) {
  const summary = buildPaymentSummary({
    friendName: friend.name,
    items: request.items,
    totalSen: request.totalSen,
  });
  return (
    <PageShell
      intro={
        <Link className={LINK_CLASS} href={`/friends/${friend.id}`}>
          Back to {friend.name}
        </Link>
      }
      title="Payment request"
    >
      <Section id="request" title={`${request.requestDate} — ${request.status}`}>
        <textarea
          aria-label="Copyable payment summary"
          className="w-full rounded-lg border border-hairline bg-black/35 px-3.5 py-2.5 font-mono text-sm text-ink"
          readOnly
          rows={request.items.length + 5}
          value={summary}
        />
        {request.note ? (
          <p className="text-sm text-ink-muted">Note: {request.note}</p>
        ) : null}
      </Section>

      {request.status === 'pending' ? (
        <Section id="settlement" title="Settle request">
          <SettleForm
            action={transitionAction}
            confirmation={`Confirm full payment of ${formatMoney(request.totalSen)}`}
            occurredOn={defaultOccurredOn}
            // The strict format is what the action parses back into sen.
            paidAmount={formatRM(request.totalSen)}
            requestId={request.id}
            status="paid"
            submitLabel="Mark paid in full"
            withPaidDate
          />
          <SettleForm
            action={transitionAction}
            confirmation="Confirm cancellation and unlock portions"
            occurredOn={defaultOccurredOn}
            requestId={request.id}
            status="cancelled"
            submitLabel="Cancel request"
          />
          <SettleForm
            action={transitionAction}
            confirmation="Confirm forgiveness"
            occurredOn={defaultOccurredOn}
            requestId={request.id}
            status="forgiven"
            submitLabel="Forgive request"
          />
        </Section>
      ) : (
        <Empty>
          Settled on {request.paidOn ?? request.cancelledOn ?? request.forgivenOn}.
        </Empty>
      )}
    </PageShell>
  );
}
