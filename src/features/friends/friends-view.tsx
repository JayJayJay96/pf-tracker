import Link from 'next/link';

import { formatRM } from '../../domain/money';
import { buildPaymentSummary } from './payment-summary';
import type {
  FriendBalance,
  LedgerPortion,
  PaymentRequest,
} from './queries';

type FormAction = (formData: FormData) => void | Promise<void>;

function PrimaryNavigation() {
  return (
    <nav aria-label="Primary">
      <Link href="/">Dashboard</Link>{' '}
      <Link href="/shared-bills">Shared Bills</Link>{' '}
      <Link href="/friends">Friends</Link>{' '}
      <Link href="/reports">Reports</Link>
    </nav>
  );
}

export function FriendsView({ friends }: { friends: FriendBalance[] }) {
  return (
    <main>
      <PrimaryNavigation />
      <h1>Friends</h1>
      {friends.length === 0 ? (
        <p>Add and allocate a friend on Shared Bills to start a ledger.</p>
      ) : (
        <ul>
          {friends.map((friend) => (
            <li key={friend.id}>
              <Link href={`/friends/${friend.id}`}><strong>{friend.name}</strong></Link>
              <p>{formatRM(friend.outstandingSen)} outstanding</p>
              <p>{formatRM(friend.unrequestedSen)} unrequested</p>
              <p>{formatRM(friend.requestedSen)} requested</p>
              <p>{formatRM(friend.paidSen)} paid</p>
              <p>{formatRM(friend.forgivenSen)} forgiven</p>
              <p>{friend.pendingRequestCount} pending requests</p>
            </li>
          ))}
        </ul>
      )}
    </main>
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
    <main>
      <PrimaryNavigation />
      <h1>{friend.name}</h1>
      <section aria-labelledby="profile-heading">
        <h2 id="profile-heading">Profile</h2>
        {friend.nickname && <p>Nickname: {friend.nickname}</p>}
        {friend.phone && <p>Phone: {friend.phone}</p>}
        {friend.notes && <p>Notes: {friend.notes}</p>}
        {!friend.active && <p>Archived</p>}
      </section>
      <section aria-labelledby="balance-heading">
        <h2 id="balance-heading">Balance</h2>
        <p>{formatRM(friend.outstandingSen)} outstanding</p>
        <p>{formatRM(friend.unrequestedSen)} unrequested</p>
        <p>{formatRM(friend.requestedSen)} requested</p>
        <p>{formatRM(friend.paidSen)} paid</p>
        <p>{formatRM(friend.forgivenSen)} forgiven</p>
      </section>

      <section aria-labelledby="request-heading">
        <h2 id="request-heading">Create lump-sum request</h2>
        {unrequested.length === 0 ? (
          <p>No unrequested portions are available.</p>
        ) : (
          <form action={createRequestAction}>
            <input type="hidden" name="friendId" value={friend.id} />
            {unrequested.map((portion) => (
              <label key={portion.portionId}>
                <input
                  type="checkbox"
                  name="portionIds"
                  value={portion.portionId}
                />
                {portion.transactionDate} — {portion.description}:{' '}
                {formatRM(portion.amountSen)}
              </label>
            ))}
            <label>
              Request date
              <input
                name="requestDate"
                type="date"
                defaultValue={defaultRequestDate}
                required
              />
            </label>
            <label>
              Note
              <input name="note" />
            </label>
            <button type="submit">Create payment request</button>
          </form>
        )}
      </section>

      <section aria-labelledby="ledger-heading">
        <h2 id="ledger-heading">Ledger</h2>
        {ledger.length === 0 ? <p>No friend portions yet.</p> : (
          <ul>
            {ledger.map((portion) => (
              <li key={`${portion.transactionDate}:${portion.portionId}`}>
                <time dateTime={portion.transactionDate}>
                  {portion.transactionDate}
                </time>{' '}
                {portion.description}: {formatRM(portion.amountSen)} — {portion.status}
                {portion.requestId && (
                  <> — <Link href={`/friends/${friend.id}/requests/${portion.requestId}`}>
                    request
                  </Link></>
                )}
                {portion.settledOn && <> on {portion.settledOn}</>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="history-heading">
        <h2 id="history-heading">Payment request history</h2>
        {requests.length === 0 ? <p>No payment requests yet.</p> : (
          <ul>
            {requests.map((request) => (
              <li key={request.id}>
                <Link href={`/friends/${friend.id}/requests/${request.id}`}>
                  {request.requestDate} — {formatRM(request.totalSen)}
                </Link>{' '}
                {request.status}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
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
    <main>
      <PrimaryNavigation />
      <p><Link href={`/friends/${friend.id}`}>Back to {friend.name}</Link></p>
      <h1>Payment request</h1>
      <p>
        <time dateTime={request.requestDate}>{request.requestDate}</time>{' '}
        — {request.status}
      </p>
      <textarea
        aria-label="Copyable payment summary"
        readOnly
        rows={request.items.length + 5}
        value={summary}
      />
      {request.note && <p>Note: {request.note}</p>}

      {request.status === 'pending' ? (
        <section aria-labelledby="settlement-heading">
          <h2 id="settlement-heading">Settle request</h2>
          <form action={transitionAction}>
            <input type="hidden" name="requestId" value={request.id} />
            <input type="hidden" name="status" value="paid" />
            <input
              type="hidden"
              name="paidAmount"
              value={formatRM(request.totalSen)}
            />
            <label>
              Paid date
              <input
                type="date"
                name="occurredOn"
                defaultValue={defaultOccurredOn}
                required
              />
            </label>
            <label>
              <input type="checkbox" required />
              Confirm full payment of {formatRM(request.totalSen)}
            </label>
            <button type="submit">Mark paid in full</button>
          </form>
          <form action={transitionAction}>
            <input type="hidden" name="requestId" value={request.id} />
            <input type="hidden" name="status" value="cancelled" />
            <input type="hidden" name="occurredOn" value={defaultOccurredOn} />
            <label>
              <input type="checkbox" required />
              Confirm cancellation and unlock portions
            </label>
            <button type="submit">Cancel request</button>
          </form>
          <form action={transitionAction}>
            <input type="hidden" name="requestId" value={request.id} />
            <input type="hidden" name="status" value="forgiven" />
            <input type="hidden" name="occurredOn" value={defaultOccurredOn} />
            <label>
              <input type="checkbox" required />
              Confirm forgiveness
            </label>
            <button type="submit">Forgive request</button>
          </form>
        </section>
      ) : (
        <p>
          Settled on {request.paidOn ?? request.cancelledOn ?? request.forgivenOn}.
        </p>
      )}
    </main>
  );
}
