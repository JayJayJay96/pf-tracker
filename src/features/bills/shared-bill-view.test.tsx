import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SharedBillView } from './shared-bill-view';

describe('shared bill view', () => {
  it('prioritizes recording a shared bill before friend setup and history', () => {
    const page = renderToStaticMarkup(
      <SharedBillView
        friends={[]}
        bills={[]}
        defaultTransactionDate="2026-07-29"
      />,
    );

    expect(page).toContain('Record shared bill');
    expect(page).toContain('Friends');
    expect(page).toContain('Shared bill history');
    expect(page.indexOf('id="record-bill-heading"')).toBeLessThan(
      page.indexOf('id="friends-heading"'),
    );
    expect(page.indexOf('id="friends-heading"')).toBeLessThan(
      page.indexOf('id="shared-bills-heading"'),
    );
    expect(page).toContain('Add a friend before resolving a bill.');
  });
});
