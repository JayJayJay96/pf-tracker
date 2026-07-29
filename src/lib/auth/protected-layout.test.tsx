import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import ProtectedLayout from '../../../app/(app)/layout';

vi.mock('../supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getClaims: vi.fn(),
      signOut: vi.fn(),
    },
  })),
}));

vi.mock('./protected-route', () => ({
  getProtectedRouteRedirect: vi.fn(async () => null),
}));

describe('protected app layout', () => {
  it('wraps protected pages separately from dashboard-specific styling', async () => {
    const page = renderToStaticMarkup(
      await ProtectedLayout({ children: <main><h1>Monthly Plan</h1></main> }),
    );

    expect(page).toContain('class="app-header"');
    expect(page).toContain('class="app-primary-nav"');
    expect(page).toContain('href="/"');
    expect(page).toContain('Expenses');
    expect(page).toContain('Shared Bills');
    expect(page).toContain('Transactions');
    expect(page).toContain('class="app-secondary-nav"');
    expect(page).toContain('Income &amp; Commitments');
    expect(page).toContain('Friends');
    expect(page).toContain('Reports');
    expect(page).toContain('class="app-content"');
    expect(page).toContain('<main><h1>Monthly Plan</h1></main>');
  });
});
