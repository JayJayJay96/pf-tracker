import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { MonthlyPlanView } from './monthly-plan-view';

describe('monthly plan view', () => {
  it('renders template controls and labels generated entries as snapshots', () => {
    const page = renderToStaticMarkup(
      <MonthlyPlanView
        periodStart="2026-07-01"
        templates={[{
          id: 'template-1',
          name: 'Salary',
          entryType: 'income',
          amountSen: 500_000,
          effectiveStart: '2026-01-01',
          effectiveEnd: null,
          day: 25,
          status: 'confirmed',
          isActive: true,
        }]}
        entries={[{
          id: 'entry-1',
          templateId: 'template-1',
          periodStart: '2026-07-01',
          entryDate: '2026-07-25',
          name: 'Salary',
          entryType: 'income',
          amountSen: 500_000,
          day: 25,
          status: 'confirmed',
        }]}
      />,
    );

    expect(page).toContain('<h1>Monthly Plan</h1>');
    expect(page).toContain('RM5000.00');
    expect(page).toContain('Generated snapshots for July 2026');
    expect(page).toContain('Template edits apply only to months generated afterward.');
    expect(page).toContain('Archive');
  });

  it('renders clear template and month empty states', () => {
    const page = renderToStaticMarkup(
      <MonthlyPlanView periodStart="2026-07-01" templates={[]} entries={[]} />,
    );

    expect(page).toContain('No templates yet.');
    expect(page).toContain('No snapshots generated for July 2026.');
  });
});
