import type { ReactNode } from 'react';

/**
 * Layout primitives for the authenticated screens.
 *
 * These exist because the app had no component layer: every screen rendered bare
 * `main`, `section` and `h1` elements and depended on one global stylesheet
 * targeting those tag names behind `main:not(.dashboard-shell)`. Styling was
 * therefore addressed by where a tag sat in the tree, so any new screen landed
 * unstyled, and the auth routes - outside that ancestor - got nothing at all.
 *
 * Converted screens compose these and stop depending on that block.
 */

export function PageShell({
  title,
  intro,
  children,
}: {
  title: string;
  /** One line under the heading. Omit it rather than pad with filler. */
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto grid w-full max-w-[1180px] gap-6 px-5 pt-8 pb-16">
      <div className="grid gap-1.5">
        <h1 className="text-3xl font-bold tracking-tight text-ink">{title}</h1>
        {intro ? <p className="text-sm text-ink-muted">{intro}</p> : null}
      </div>
      {children}
    </main>
  );
}

/**
 * A titled panel. The heading is wired to the section with `aria-labelledby`,
 * which every screen previously had to remember to do by hand.
 */
export function Section({
  id,
  title,
  action,
  children,
}: {
  /** Used for the heading id, so it must be unique on the page. */
  id: string;
  title: string;
  /** Optional trailing control, such as a count or a link. */
  action?: ReactNode;
  children: ReactNode;
}) {
  const headingId = `${id}-heading`;
  return (
    <section
      aria-labelledby={headingId}
      className="grid gap-4 rounded-2xl border border-hairline bg-surface/70 px-5 py-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-ink" id={headingId}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * A labelled control. The control nests inside the label, so it is named without
 * needing an id, and nothing else may go in here: a hint placed inside a label
 * becomes part of the control's accessible name.
 */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm text-ink-muted">{label}</span>
      {children}
    </label>
  );
}

/**
 * Search and filtering. Deliberately quieter than an entry form, because the two
 * were previously identical and a screen offered three stacked forms with no way
 * to tell which one recorded something.
 */
export function FilterForm({ children }: { children: ReactNode }) {
  return (
    <form
      className="grid items-end gap-3 rounded-xl border border-dashed border-hairline px-4 py-4 sm:grid-cols-2 lg:grid-cols-4"
      method="get"
    >
      {children}
    </form>
  );
}

/** Vertical list of records, replacing the globally styled `ul`/`li` pair. */
export function RecordList({ children }: { children: ReactNode }) {
  return <ul className="grid list-none gap-2.5 p-0">{children}</ul>;
}

export function Record({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <li
      className="grid gap-1.5 rounded-xl border border-hairline bg-black/25 px-4 py-3.5"
      id={id}
    >
      {children}
    </li>
  );
}

/** Empty state. A screen should say why a list is empty, not just show nothing. */
export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-ink-muted">{children}</p>;
}

/** Collapsed extra detail. Not for destructive actions - those use ConfirmSubmit. */
export function Disclosure({
  summary,
  children,
}: {
  summary: string;
  children: ReactNode;
}) {
  return (
    <details className="grid gap-2">
      <summary className="cursor-pointer py-1 text-sm text-accent">{summary}</summary>
      {children}
    </details>
  );
}
