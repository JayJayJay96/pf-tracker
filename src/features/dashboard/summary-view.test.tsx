import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SummaryView } from './summary-view';

describe('dashboard summary view', () => {
  it('renders all requested RM totals and explains the conservative result', () => {
    const page = renderToStaticMarkup(
      <SummaryView
        periodStart="2026-07-01"
        snapshotCount={4}
        hasSnapshots
        summary={{
          confirmedIncome: 500_000,
          activeCommitments: 120_000,
          savings: 50_000,
          investments: 30_000,
          resolvedPersonalSpending: 0,
          remainingSpendable: 300_000,
        }}
      />,
    );

    expect(page).toContain('July 2026');
    expect(page).toContain('Remaining spendable');
    expect(page).toContain('RM3000.00');
    expect(page).toContain('Confirmed income');
    expect(page).toContain('RM5000.00');
    expect(page).toContain('Personal spending');
    expect(page).toContain('RM0.00');
    expect(page).toContain('href="/friends"');
    expect(page).toContain('conservative');
    expect(page).toContain('planned active commitments before they are paid');
  });

  it('renders a negative remaining value without passing it to the unsigned formatter', () => {
    const page = renderToStaticMarkup(
      <SummaryView
        periodStart="2026-07-01"
        snapshotCount={2}
        hasSnapshots
        summary={{
          confirmedIncome: 100,
          activeCommitments: 200,
          savings: 0,
          investments: 0,
          resolvedPersonalSpending: 0,
          remainingSpendable: -100,
        }}
      />,
    );

    expect(page).toContain('-RM1.00');
  });

  it('does not show an empty state when snapshots total zero after status filtering', () => {
    const page = renderToStaticMarkup(
      <SummaryView
        periodStart="2026-07-01"
        snapshotCount={2}
        hasSnapshots
        summary={{
          confirmedIncome: 0,
          activeCommitments: 0,
          savings: 0,
          investments: 0,
          resolvedPersonalSpending: 0,
          remainingSpendable: 0,
        }}
      />,
    );

    expect(page).not.toContain('No plan snapshots for this month.');
    expect(page).toContain('2 plan snapshots loaded.');
  });

  it('shows an empty state only when the selected month has no snapshots', () => {
    const page = renderToStaticMarkup(
      <SummaryView
        periodStart="2026-07-01"
        snapshotCount={0}
        hasSnapshots={false}
        summary={{
          confirmedIncome: 0,
          activeCommitments: 0,
          savings: 0,
          investments: 0,
          resolvedPersonalSpending: 0,
          remainingSpendable: 0,
        }}
      />,
    );

    expect(page).toContain('No plan snapshots for this month.');
  });

  it('shows shared cash outflow, friend receivables, and unresolved warning', () => {
    const page = renderToStaticMarkup(
      <SummaryView
        periodStart="2026-07-01"
        snapshotCount={0}
        hasSnapshots={false}
        summary={{
          confirmedIncome: 0,
          activeCommitments: 0,
          savings: 0,
          investments: 0,
          resolvedPersonalSpending: 501,
          remainingSpendable: -501,
          totalCashOutflow: 2001,
          friendReceivables: 500,
          unresolvedBillCount: 1,
        }}
      />,
    );

    expect(page).toContain('Total cash outflow');
    expect(page).toContain('RM20.01');
    expect(page).toContain('Friends owe');
    expect(page).toContain('RM5.00');
    expect(page).toContain('1 unresolved shared bill');
  });
});
