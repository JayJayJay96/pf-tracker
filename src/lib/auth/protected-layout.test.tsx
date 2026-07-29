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

async function render() {
  return renderToStaticMarkup(
    await ProtectedLayout({ children: <main><h1>Monthly Plan</h1></main> }),
  );
}

describe('protected app layout', () => {
  it('renders the page inside the shell', async () => {
    const page = await render();

    expect(page).toContain('class="app-header"');
    expect(page).toContain('<main><h1>Monthly Plan</h1></main>');
    expect(page).toContain('Sign out');
  });

  it('names each route once per viewport, never twice in the same one', async () => {
    const page = await render();
    const times = (href: string) => page.split(`href="${href}"`).length - 1;

    // Primary routes appear twice in the markup - the header row and the phone
    // tab bar - but each is display:none at the other's breakpoint, so only one
    // is ever rendered or exposed to assistive technology.
    for (const href of ['/expenses', '/shared-bills', '/transactions']) {
      expect(times(href), href).toBe(2);
    }
    // Secondary routes live only in the header.
    for (const href of ['/plan', '/friends', '/reports']) {
      expect(times(href), href).toBe(1);
    }
    // Previously the header carried two lists, the dashboard added a third, and
    // every view rendered its own, so a single screen showed the same route
    // several times under different labels.
    expect(page).not.toContain('Monthly Plan</a>');
    expect(page).not.toContain('Personal Expenses</a>');
  });

  it('offers a skip link ahead of the navigation', async () => {
    const page = await render();

    expect(page).toContain('href="#main"');
    expect(page).toContain('Skip to content');
    expect(page).toContain('id="main"');
    expect(page.indexOf('Skip to content')).toBeLessThan(page.indexOf('app-header'));
  });

  it('provides a bottom bar and an add shortcut for phones', async () => {
    const page = await render();

    expect(page).toContain('href="/expenses?add=1"');
    expect(page).toContain('Add an expense');
    // Both are hidden once there is room for the header nav.
    expect(page).toContain('sm:hidden');
  });
});
