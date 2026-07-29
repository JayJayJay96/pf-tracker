'use client';

import Link from 'next/link';

/**
 * Route-level failure. Copy stays neutral because this boundary covers every
 * screen in the group, not just the plan. Form validation no longer lands here —
 * server actions report their own errors in place — so reaching this means
 * something genuinely failed to load.
 */
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto grid w-full max-w-md gap-4 px-5 py-16">
      <h1 className="text-2xl font-bold tracking-tight text-ink">
        Something went wrong
      </h1>
      <p className="text-sm text-ink-muted" role="alert">
        That screen could not be loaded. Your saved data is unaffected.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-lg border border-hairline-strong bg-accent-soft px-4 py-2.5 font-semibold text-ink hover:border-accent hover:bg-accent/20"
          type="button"
          onClick={reset}
        >
          Try again
        </button>
        <Link
          className="rounded-lg border border-hairline px-4 py-2.5 text-ink-muted no-underline hover:border-hairline-strong hover:text-ink"
          href="/"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
