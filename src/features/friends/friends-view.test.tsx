import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  FriendLedgerView,
  FriendsView,
  PaymentRequestView,
} from './friends-view';

const friend = {
  id: 'friend-1',
  name: 'Alex',
  nickname: null,
  phone: null,
  notes: null,
  active: true,
  unrequestedSen: 6_240,
  requestedSen: 1_800,
  paidSen: 2_000,
  forgivenSen: 500,
  outstandingSen: 8_040,
  collectedSen: 2_000,
  pendingRequestCount: 1,
};

describe('friends screens', () => {
  it('shows outstanding and lifecycle totals per friend', () => {
    const html = renderToStaticMarkup(<FriendsView friends={[friend]} />);

    expect(html).toContain('Alex');
    expect(html).toContain('RM80.40 outstanding');
    expect(html).toContain('RM62.40 unrequested');
    expect(html).toContain('RM18.00 requested');
    expect(html).toContain('RM20.00 paid');
  });

  it('offers only unrequested ledger portions for a lump-sum request', () => {
    const html = renderToStaticMarkup(<FriendLedgerView
      friend={{
        ...friend,
        nickname: 'Al',
        phone: '+60123456789',
        notes: 'Prefers Touch n Go',
        active: false,
      }}
      defaultRequestDate="2026-07-18"
      ledger={[
        {
          portionId: 'portion-1',
          description: 'Dinner',
          transactionDate: '2026-07-10',
          amountSen: 6_240,
          status: 'unrequested',
          requestId: null,
          settledOn: null,
        },
        {
          portionId: 'portion-2',
          description: 'Movie',
          transactionDate: '2026-07-14',
          amountSen: 1_800,
          status: 'requested',
          requestId: 'request-1',
          settledOn: null,
        },
      ]}
      requests={[]}
    />);

    expect(html).toContain('Create lump-sum request');
    expect(html).toContain('Al');
    expect(html).toContain('+60123456789');
    expect(html).toContain('Prefers Touch n Go');
    expect(html).toContain('Archived');
    expect(html).toContain('name="portionIds"');
    expect(html).toContain('value="portion-1"');
    expect(html).not.toContain('value="portion-2"');
    expect(html).toContain('Movie');
    expect(html).toContain('requested');
  });

  it('shows a copyable immutable summary and full-settlement controls', () => {
    const html = renderToStaticMarkup(<PaymentRequestView
      friend={friend}
      request={{
        id: 'request-1',
        friendId: 'friend-1',
        totalSen: 8_040,
        requestDate: '2026-07-18',
        status: 'pending',
        note: null,
        paidOn: null,
        cancelledOn: null,
        forgivenOn: null,
        items: [
          {
            id: 'item-1',
            portionId: 'bill-participant-1',
            description: 'Dinner',
            transactionDate: '2026-07-10',
            amountSen: 6_240,
          },
          {
            id: 'item-2',
            portionId: 'bill-participant-2',
            description: 'Movie',
            transactionDate: '2026-07-14',
            amountSen: 1_800,
          },
        ],
      }}
      defaultOccurredOn="2026-07-22"
    />);

    expect(html).toContain('10 Jul 2026 — Dinner: RM62.40');
    expect(html).toContain('Total: RM80.40');
    expect(html).toContain('Mark paid in full');
    expect(html).toContain('value="RM80.40"');
    expect(html).toContain('Cancel request');
    expect(html).toContain('Forgive request');
  });
});
