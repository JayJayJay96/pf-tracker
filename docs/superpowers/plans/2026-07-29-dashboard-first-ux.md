# Dashboard-First UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make daily use easier by centering the app on checking remaining spendable, adding personal expenses, adding shared bills, and managing recurring income/commitments.

**Architecture:** Keep the existing Next.js routes, Supabase data flow, and monthly plan template model. Add reusable navigation/action markup in the protected shell and dashboard, reorder existing page sections, and rename visible monthly-plan language to income/commitment setup without changing the route or schema.

**Tech Stack:** Next.js App Router, React, TypeScript, plain CSS, Vitest render tests.

## Global Constraints

- Do not change finance calculations.
- Do not change database schema.
- Do not remove existing pages.
- Do not add new dependencies.
- Keep the dark UI with subtle blue accents.
- Keep copy short and practical.
- Reuse recurring monthly plan templates for income and commitments so fixed items continue into future months.

---

### Task 1: Stable Daily Navigation

**Files:**
- Modify: `app/(app)/layout.tsx`
- Modify: `app/globals.css`
- Modify: `src/lib/auth/protected-layout.test.tsx`

**Interfaces:**
- Consumes: protected route layout children.
- Produces: `.app-primary-nav`, `.app-secondary-nav`, and `.app-content` wrappers.

- [ ] **Step 1: Write failing test**

Update `src/lib/auth/protected-layout.test.tsx`:

```typescript
expect(page).toContain('class="app-primary-nav"');
expect(page).toContain('href="/"');
expect(page).toContain('Expenses');
expect(page).toContain('Shared Bills');
expect(page).toContain('Transactions');
expect(page).toContain('class="app-secondary-nav"');
expect(page).toContain('Income &amp; Commitments');
expect(page).toContain('Friends');
expect(page).toContain('Reports');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/auth/protected-layout.test.tsx`

Expected: FAIL because the protected layout does not yet render primary and secondary nav groups.

- [ ] **Step 3: Implement header navigation**

In `app/(app)/layout.tsx`, import `Link` if not already present and render:

```tsx
<nav className="app-primary-nav" aria-label="Daily">
  <Link href="/">Dashboard</Link>
  <Link href="/expenses">Expenses</Link>
  <Link href="/shared-bills">Shared Bills</Link>
  <Link href="/transactions">Transactions</Link>
</nav>
<nav className="app-secondary-nav" aria-label="Support">
  <Link href="/plan">Income &amp; Commitments</Link>
  <Link href="/friends">Friends</Link>
  <Link href="/reports">Reports</Link>
</nav>
```

Keep the sign-out form in the header.

- [ ] **Step 4: Add CSS for navigation groups**

In `app/globals.css`, style `.app-header` as a wrapping grid/flex header, `.app-primary-nav` as prominent pill links, and `.app-secondary-nav` as quieter links. Keep mobile wrapping without horizontal scroll.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/auth/protected-layout.test.tsx`

Expected: PASS.

### Task 2: Dashboard Quick Actions

**Files:**
- Modify: `src/features/dashboard/summary-view.tsx`
- Modify: `src/features/dashboard/summary-view.test.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `SummaryViewProps`.
- Produces: `.quick-actions` and `.daily-workflow` dashboard sections.

- [ ] **Step 1: Write failing dashboard test**

Update the first test in `src/features/dashboard/summary-view.test.tsx`:

```typescript
expect(page).toContain('class="quick-actions"');
expect(page).toContain('href="/expenses"');
expect(page).toContain('Add personal expense');
expect(page).toContain('href="/shared-bills"');
expect(page).toContain('Add shared bill');
expect(page).toContain('href="/transactions"');
expect(page).toContain('View transactions');
expect(page).toContain('href="/plan"');
expect(page).toContain('Edit income and commitments');
expect(page).toContain('class="daily-workflow"');
```

Add an empty-state test:

```typescript
expect(page).toContain('Add income and commitments');
```

Use `hasSnapshots={false}` and zero summary values for that empty-state case.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/dashboard/summary-view.test.tsx`

Expected: FAIL because quick actions and daily workflow are not rendered yet.

- [ ] **Step 3: Implement dashboard actions**

In `SummaryView`, add a quick action section after the hero:

```tsx
<section className="quick-actions" aria-label="Quick actions">
  <Link href="/expenses">Add personal expense</Link>
  <Link href="/shared-bills">Add shared bill</Link>
  <Link href="/transactions">View transactions</Link>
  <Link href="/plan">
    {hasSnapshots ? 'Edit income and commitments' : 'Add income and commitments'}
  </Link>
</section>
```

Add a compact daily workflow section:

```tsx
<section className="daily-workflow" aria-labelledby="daily-workflow-heading">
  <h2 id="daily-workflow-heading">Today&apos;s workflow</h2>
  <ol>
    <li>Check remaining spendable before spending.</li>
    <li>Record personal expenses right after paying.</li>
    <li>Record shared bills first, then resolve friends when ready.</li>
  </ol>
</section>
```

- [ ] **Step 4: Style quick actions**

In `app/globals.css`, add `.quick-actions` as a responsive grid of action buttons and `.daily-workflow` as a compact panel matching the dark blue theme.

- [ ] **Step 5: Run dashboard tests**

Run: `npx vitest run src/features/dashboard/summary-view.test.tsx`

Expected: PASS.

### Task 3: Expenses Page Ordering

**Files:**
- Modify: `src/features/expenses/expense-view.tsx`
- Modify: `src/features/expenses/expense-view.test.tsx`

**Interfaces:**
- Consumes: existing `ExpenseViewProps`.
- Produces: page order with add-expense before categories and history.

- [ ] **Step 1: Write failing order assertion**

In `src/features/expenses/expense-view.test.tsx`, add:

```typescript
expect(page.indexOf('Add personal expense')).toBeLessThan(page.indexOf('Expense categories'));
expect(page.indexOf('Expense categories')).toBeLessThan(page.indexOf('Transaction history'));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/expenses/expense-view.test.tsx`

Expected: FAIL because categories currently render before add expense.

- [ ] **Step 3: Reorder sections**

Move the `add-expense-heading` section above the `categories-heading` section in `ExpenseView`. Keep the category empty-state copy because saving remains disabled when there are no categories.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/expenses/expense-view.test.tsx`

Expected: PASS.

### Task 4: Shared Bills Page Ordering

**Files:**
- Modify: `src/features/bills/shared-bill-view.tsx`
- Create: `src/features/bills/shared-bill-view.test.tsx`

**Interfaces:**
- Consumes: existing `SharedBillViewProps`.
- Produces: page order with record-shared-bill before friends and history.

- [ ] **Step 1: Write failing view test**

Create `src/features/bills/shared-bill-view.test.tsx`:

```typescript
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
    expect(page.indexOf('Record shared bill')).toBeLessThan(page.indexOf('Friends'));
    expect(page.indexOf('Friends')).toBeLessThan(page.indexOf('Shared bill history'));
    expect(page).toContain('Add a friend before resolving a bill.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/bills/shared-bill-view.test.tsx`

Expected: FAIL because friends currently render before record shared bill.

- [ ] **Step 3: Reorder sections**

Move the `record-bill-heading` section above the `friends-heading` section in `SharedBillView`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/bills/shared-bill-view.test.tsx`

Expected: PASS.

### Task 5: Income And Commitments Page Language

**Files:**
- Modify: `src/features/plan/monthly-plan-view.tsx`
- Modify: `src/features/plan/monthly-plan-view.test.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: existing `templates`, `entries`, and `actions`.
- Produces: user-facing setup page ordered as income, commitments, other allocations, generated monthly entries.

- [ ] **Step 1: Write failing plan-page test**

Update `src/features/plan/monthly-plan-view.test.tsx`:

```typescript
expect(page).toContain('<h1>Income &amp; Commitments</h1>');
expect(page).toContain('Recurring income');
expect(page).toContain('Recurring commitments');
expect(page).toContain('Other monthly allocations');
expect(page.indexOf('Recurring income')).toBeLessThan(page.indexOf('Recurring commitments'));
expect(page.indexOf('Recurring commitments')).toBeLessThan(page.indexOf('Generated monthly entries'));
expect(page).toContain('These fixed items carry forward into future months.');
```

Update older expectations from `Monthly Plan`, `Templates`, and `Generated snapshots` to the new visible language.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/plan/monthly-plan-view.test.tsx`

Expected: FAIL because current copy is still monthly-plan/template oriented.

- [ ] **Step 3: Split template lists by type**

Inside `MonthlyPlanView`, derive:

```typescript
const incomeTemplates = templates.filter((template) => template.entryType === 'income');
const commitmentTemplates = templates.filter((template) => template.entryType === 'commitment');
const otherTemplates = templates.filter((template) => (
  template.entryType === 'savings' || template.entryType === 'investment'
));
```

Render sections in this order:

1. `Recurring income`
2. `Recurring commitments`
3. `Other monthly allocations`
4. `Generate selected month`
5. `Generated monthly entries for {label}`

Use the existing `TemplateFields`, create/update/archive actions, and generated entry update form.

- [ ] **Step 4: Keep forms simple**

For create forms in income and commitment sections, include a hidden `entryType` value if the current `TemplateFields` is split, or pass a new optional prop:

```typescript
function TemplateFields({
  template,
  fixedEntryType,
}: {
  template?: PlanTemplate;
  fixedEntryType?: PlanTemplate['entryType'];
})
```

When `fixedEntryType` is present, render:

```tsx
<input type="hidden" name="entryType" value={fixedEntryType} />
```

and do not render the type select for that form. Keep the type select for the "Other monthly allocations" form.

- [ ] **Step 5: Run plan tests**

Run: `npx vitest run src/features/plan/monthly-plan-view.test.tsx`

Expected: PASS.

### Task 6: Final Verification And Push

**Files:**
- All files modified above.

**Interfaces:**
- Produces: pushed `main` branch for Vercel auto-deployment.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npx vitest run src/lib/auth/protected-layout.test.tsx src/features/dashboard/summary-view.test.tsx src/features/expenses/expense-view.test.tsx src/features/bills/shared-bill-view.test.tsx src/features/plan/monthly-plan-view.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run full verification**

Run:

```bash
npm run typecheck
npm run test:unit
npm run build
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 3: Commit implementation**

Run:

```bash
git add app src
git commit -m "feat: streamline daily finance workflow"
```

- [ ] **Step 4: Push**

Run: `git push`

Expected: GitHub receives the commit and Vercel starts a deployment.
