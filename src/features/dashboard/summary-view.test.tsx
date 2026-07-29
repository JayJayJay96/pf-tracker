import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SummaryView } from './summary-view';

type Summary = Parameters<typeof SummaryView>[0]['summary'];

const EMPTY: Summary = {
  confirmedIncome: 0,
  activeCommitments: 0,
  savings: 0,
  investments: 0,
  resolvedPersonalSpending: 0,
  remainingSpendable: 0,
};

function render(summary: Partial<Summary>, options: {
  snapshotCount?: number;
  hasSnapshots?: boolean;
} = {}) {
  return renderToStaticMarkup(
    <SummaryView
      hasSnapshots={options.hasSnapshots ?? true}
      periodStart="2026-07-01"
      snapshotCount={options.snapshotCount ?? 4}
      summary={{ ...EMPTY, ...summary }}
    />,
  );
}

describe('dashboard summary view', () => {
  it('leads with the month and offers a stepper rather than a month field', () => {
    const page = render({});

    expect(page).toContain('July 2026');
    expect(page).toContain('href="/?month=2026-06"');
    expect(page).toContain('href="/?month=2026-08"');
    // The app's own name was previously the page's largest heading.
    expect(page).not.toContain('Personal Finance Tracker');
  });

  it('gives the hero number a denominator and a pace', () => {
    const page = render({
      confirmedIncome: 1_000_000,
      activeCommitments: 200_000,
      remainingSpendable: 800_000,
      daysToNextSalary: 8,
    });

    expect(page).toContain('Remaining spendable');
    expect(page).toContain('RM8,000.00');
    expect(page).toContain('of RM10,000.00 income');
    expect(page).toContain('8 days to payday');
    // 800000 sen spread over 8 days.
    expect(page).toContain('about RM1,000.00 a day');
  });

  it('groups thousands so large figures stay readable', () => {
    const page = render({ confirmedIncome: 1_234_567, remainingSpendable: 1_234_567 });

    expect(page).toContain('RM12,345.67');
    expect(page).not.toContain('RM12345.67');
  });

  it('renders an overspent month as a warning rather than in the same calm white', () => {
    const page = render({
      confirmedIncome: 100_000,
      activeCommitments: 200_000,
      remainingSpendable: -100_000,
    });

    expect(page).toContain('Over budget');
    expect(page).toContain('-RM1,000.00');
    expect(page).toContain('text-negative');
    expect(page).toContain('exceed confirmed income by RM1,000.00');
    // The reassuring wording must not survive into a negative month.
    expect(page).not.toContain('Remaining spendable');
  });

  it('breaks income down into where it went', () => {
    const page = render({
      confirmedIncome: 1_000_000,
      activeCommitments: 200_000,
      savings: 100_000,
      investments: 50_000,
      resolvedPersonalSpending: 30_000,
      remainingSpendable: 620_000,
    });

    expect(page).toContain('Where this month');
    expect(page).toContain('Commitments');
    expect(page).toContain('Savings');
    expect(page).toContain('Investments');
    expect(page).toContain('Spent');
    // Commitments are a fifth of the month's income.
    expect(page).toContain('width:20%');
  });

  it('omits the breakdown when there is no income to divide up', () => {
    const page = render({ activeCommitments: 200_000, remainingSpendable: -200_000 });

    expect(page).not.toContain('Where this month');
  });

  it('surfaces only the things actually needing attention, as links', () => {
    const page = render({
      unresolvedBillCount: 2,
      pendingRequestCount: 1,
      upcomingCommitmentCount: 3,
      upcomingCommitmentsSen: 98_000,
    });

    expect(page).toContain('Needs attention');
    expect(page).toContain('2 shared bills to resolve');
    expect(page).toContain('1 payment request pending');
    expect(page).toContain('3 upcoming · RM980.00');
    expect(page).toContain('href="/shared-bills"');
    expect(page).toContain('href="/friends"');
  });

  it('hides the attention row entirely when nothing needs doing', () => {
    const page = render({ confirmedIncome: 1_000_000, remainingSpendable: 1_000_000 });

    expect(page).not.toContain('Needs attention');
  });

  it('points a month with no setup at the place to set it up', () => {
    const page = render({}, { hasSnapshots: false, snapshotCount: 0 });

    expect(page).toContain('Nothing is set up for this month yet');
    expect(page).toContain('Add income and commitments');
    expect(page).toContain('href="/plan"');
  });

  it('keeps internal bookkeeping off the screen', () => {
    const page = render({}, { snapshotCount: 7 });

    // "7 plan snapshots loaded" leaked the data model at the user.
    expect(page).not.toContain('snapshots');
    expect(page).not.toContain('Monthly control room');
  });

  it('reports friend balances and cash out', () => {
    const page = render({
      totalCashOutflow: 2_001,
      friendReceivables: 500,
      paidOnBehalf: 6_000,
    });

    expect(page).toContain('Friends owe you');
    expect(page).toContain('RM5.00');
    expect(page).toContain('Total cash out');
    expect(page).toContain('RM20.01');
    expect(page).toContain('Paid for friends');
    expect(page).toContain('RM60.00');
  });

  it('stays excluded from the legacy stylesheet block', () => {
    // The legacy rules key off main:not(.dashboard-shell); losing this class
    // would apply every legacy form rule to the dashboard.
    expect(render({})).toContain('dashboard-shell');
  });
});
