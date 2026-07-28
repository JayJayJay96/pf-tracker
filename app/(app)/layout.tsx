import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

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
      <header className="app-header">
        <Link className="app-brand" href="/">
          PF Tracker
        </Link>
        <form action={signOut}>
          <button className="ghost-button" type="submit">Sign out</button>
        </form>
      </header>
      <div className="app-content">{children}</div>
    </>
  );
}
