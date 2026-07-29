import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import {
  MobileTabBar,
  PrimaryNav,
  SecondaryNav,
} from '../../src/features/navigation/app-nav';
import { getProtectedRouteRedirect } from '../../src/lib/auth/protected-route';
import { createClient } from '../../src/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const destination = await getProtectedRouteRedirect(() => supabase.auth.getClaims());

  if (destination) {
    redirect(destination);
  }

  async function signOut() {
    'use server';

    const serverSupabase = await createClient();
    await serverSupabase.auth.signOut();
    redirect('/auth/sign-in');
  }

  return (
    <>
      {/*
        Visible only once focused. Without it, keyboard and screen-reader users
        crossed nine to fifteen navigation links before reaching any content.
      */}
      <a
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-2 focus-visible:left-2 focus-visible:z-30 focus-visible:rounded-lg focus-visible:border focus-visible:border-hairline-strong focus-visible:bg-surface focus-visible:px-3 focus-visible:py-2 focus-visible:text-ink focus-visible:no-underline"
        href="#main"
      >
        Skip to content
      </a>
      <header className="app-header">
        <Link className="app-brand" href="/">PF Tracker</Link>
        <PrimaryNav />
        <SecondaryNav />
        <form action={signOut}>
          <button className="ghost-button" type="submit">Sign out</button>
        </form>
      </header>
      {/*
        Clears both the tab bar and the floating Add button above it, so the
        last element on a page never sits permanently underneath them.
      */}
      <div className="app-content pb-36 sm:pb-0" id="main" tabIndex={-1}>
        {children}
      </div>
      <MobileTabBar />
    </>
  );
}
