import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SummaryView } from './summary-view';

describe('dashboard summary view', () => {
  it('renders all requested RM totals and explains the conservative result', () => {
    const page = renderToStaticMarkup(
      <SummaryView
        periodStart="2026-07-01"
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
    expect(page).toContain('conservative');
    expect(page).toContain('planned active commitments before they are paid');
  });

  it('renders a negative remaining value without passing it to the unsigned formatter', () => {
    const page = renderToStaticMarkup(
      <SummaryView
        periodStart="2026-07-01"
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
});
