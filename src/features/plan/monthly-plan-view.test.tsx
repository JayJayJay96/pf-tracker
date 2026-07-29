import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { MonthlyPlanView } from './monthly-plan-view';

describe('monthly plan view', () => {
  it('renders recurring setup controls before generated monthly entries', () => {
    const page = renderToStaticMarkup(
      <MonthlyPlanView
        periodStart="2026-07-01"
        templates={[
          {
            id: 'template-1',
            name: 'Salary',
            entryType: 'income',
            amountSen: 500_000,
            effectiveStart: '2026-01-01',
            effectiveEnd: null,
            day: 25,
            status: 'confirmed',
            isActive: true,
          },
          {
            id: 'template-2',
            name: 'PTPTN',
            entryType: 'commitment',
            amountSen: 12_000,
            effectiveStart: '2026-01-01',
            effectiveEnd: null,
            day: 5,
            status: 'active',
            isActive: true,
          },
        ]}
        entries={[{
          id: 'entry-1',
          templateId: 'template-1',
          periodStart: '2026-07-01',
          entryDate: '2026-07-25',
          name: 'Salary',
          entryType: 'income',
          amountSen: 500_000,
          actualAmountSen: 525_050,
          day: 25,
          status: 'confirmed',
          paidDate: null,
          notes: 'Final KPI amount',
        }]}
      />,
    );

    expect(page).toContain('<h1>Income &amp; Commitments</h1>');
    expect(page).toContain('Recurring income');
    expect(page).toContain('Recurring commitments');
    expect(page).toContain('Other monthly allocations');
    expect(page.indexOf('Recurring income')).toBeLessThan(
      page.indexOf('Recurring commitments'),
    );
    expect(page.indexOf('Recurring commitments')).toBeLessThan(
      page.indexOf('Generated monthly entries'),
    );
    expect(page).toContain('These fixed items carry forward into future months.');
    expect(page).toContain('RM5000.00');
    expect(page).toContain('PTPTN');
    expect(page).toContain('RM120.00');
    expect(page).toContain('Actual RM5250.50');
    expect(page).toContain('Update actual');
    expect(page).toContain('Final KPI amount');
    expect(page).toContain('Generated monthly entries for July 2026');
    expect(page).not.toContain('Template edits apply only to months generated afterward.');
    expect(page).toContain('Archive');
  });

  it('renders clear template and month empty states', () => {
    const page = renderToStaticMarkup(
      <MonthlyPlanView periodStart="2026-07-01" templates={[]} entries={[]} />,
    );

    expect(page).toContain('No recurring income yet.');
    expect(page).toContain('No recurring commitments yet.');
    expect(page).toContain('No generated entries for July 2026.');
  });
});
