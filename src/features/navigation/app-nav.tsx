'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * The application's only navigation.
 *
 * Every route is named once, here. Previously the header carried two lists, the
 * dashboard added a third, and each view rendered its own with a different set of
 * links, so `/plan` appeared as "Income & Commitments", "Monthly Plan" and "Edit
 * income and commitments" depending on where you clicked from. Nothing anywhere
 * indicated which route you were on.
 */
export type NavItem = { href: string; label: string; short: string };

export const PRIMARY: NavItem[] = [
  { href: '/', label: 'Dashboard', short: 'Home' },
  { href: '/expenses', label: 'Expenses', short: 'Expenses' },
  { href: '/shared-bills', label: 'Shared Bills', short: 'Bills' },
  { href: '/transactions', label: 'Transactions', short: 'History' },
];

export const SECONDARY: NavItem[] = [
  { href: '/plan', label: 'Income & Commitments', short: 'Plan' },
  { href: '/friends', label: 'Friends', short: 'Friends' },
  { href: '/reports', label: 'Reports', short: 'Reports' },
];

/** `/` matches only itself; every other route also matches its subpaths. */
function isCurrent(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

export function PrimaryNav() {
  const pathname = usePathname() ?? '';
  return (
    <nav aria-label="Main" className="hidden flex-1 items-center gap-1.5 sm:flex">
      {PRIMARY.map((item) => {
        const current = isCurrent(pathname, item.href);
        return (
          <Link
            aria-current={current ? 'page' : undefined}
            className={`rounded-lg border px-3 py-2 text-sm no-underline ${
              current
                ? 'border-hairline-strong bg-accent-soft font-semibold text-ink'
                : 'border-hairline text-ink-muted hover:border-hairline-strong hover:text-ink'
            }`}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SecondaryNav() {
  const pathname = usePathname() ?? '';
  return (
    <nav
      aria-label="More"
      className="order-last flex w-full flex-wrap items-center gap-1 sm:order-none sm:w-auto"
    >
      {SECONDARY.map((item) => {
        const current = isCurrent(pathname, item.href);
        return (
          <Link
            aria-current={current ? 'page' : undefined}
            className={`rounded-lg px-2.5 py-2 text-sm no-underline ${
              current
                ? 'bg-accent-soft font-semibold text-ink'
                : 'text-ink-muted hover:bg-accent-soft hover:text-ink'
            }`}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Bottom tab bar for phones, where the header's link row was a wall of controls
 * before any content. Paired with a single Add action, because logging a purchase
 * at a counter is the app's most frequent job and previously took eight or more
 * interactions from a cold open.
 */
export function MobileTabBar() {
  const pathname = usePathname() ?? '';
  return (
    <>
      <Link
        aria-label="Add an expense"
        className="fixed right-4 bottom-20 z-20 flex size-14 items-center justify-center rounded-full border border-hairline-strong bg-accent text-2xl font-bold text-canvas no-underline shadow-lg sm:hidden"
        href="/expenses?add=1"
      >
        +
      </Link>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 border-t border-hairline bg-canvas/95 backdrop-blur sm:hidden"
      >
        {PRIMARY.map((item) => {
          const current = isCurrent(pathname, item.href);
          return (
            <Link
              aria-current={current ? 'page' : undefined}
              className={`px-2 py-3 text-center text-xs no-underline ${
                current ? 'font-semibold text-accent' : 'text-ink-muted'
              }`}
              href={item.href}
              key={item.href}
            >
              {item.short}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
