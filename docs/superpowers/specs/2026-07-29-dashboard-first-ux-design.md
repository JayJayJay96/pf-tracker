# Dashboard-First UX Design

## Goal

Make the tracker easier to use day to day by centering the app around the three most common jobs:

1. Check remaining spendable.
2. Add a personal expense.
3. Add a shared bill.

Monthly planning, friend payment status, and reports remain available, but they become supporting paths instead of competing with the daily workflow.

## Current Problem

The app has the main functions, but the navigation exposes every feature at the same level. A new or casual user has to understand the internal model first: monthly templates, generated snapshots, personal expenses, shared bills, friends, payment requests, transactions, and reports.

The better daily shape is task-first: show the money signal, then put the two common recording actions directly in reach.

## Design Direction

Use a dashboard-first command center, with a little persistent navigation cleanup.

The dashboard keeps the large remaining spendable hero, then adds a quick-action row:

- Add personal expense.
- Add shared bill.
- View transactions.

Below that, add a compact daily workflow section that explains what to do next based on existing app concepts:

- Record spending.
- Record shared bill.
- Review unresolved shared bills.

This is not a wizard and does not add a new data model. It is a clearer front door into existing pages.

## Navigation

Primary daily navigation should be:

- Dashboard
- Expenses
- Shared Bills
- Transactions

Secondary navigation should remain available but visually quieter:

- Monthly Plan
- Friends
- Reports

The protected app header should provide this stable navigation so users do not have to relearn each page. Page-level nav can be reduced or removed where it duplicates the header.

## Expenses Page

Make "Add personal expense" the first obvious working area. Categories and history should still exist, but the page should read in this order:

1. Add expense.
2. Expense categories.
3. Transaction history/filtering.

When no categories exist, the empty state should explain that a category is needed before saving an expense.

## Shared Bills Page

Make "Record shared bill" the first obvious working area. Friends are supporting setup, not the main page goal.

The page should read in this order:

1. Record shared bill.
2. Friends.
3. Shared bill history.

If no friends exist, the page can still allow recording an unresolved bill, and explain friends are needed when resolving allocation.

## Mobile Behavior

On small screens, keep navigation compact and predictable. The main daily routes should remain visible without requiring horizontal scrolling. Secondary routes can wrap below.

## Constraints

- Do not change finance calculations.
- Do not change database schema.
- Do not remove existing pages.
- Do not add new dependencies.
- Keep the dark UI with subtle blue accents.
- Keep copy short and practical.

## Testing

Add or update render tests to verify:

- Dashboard exposes quick actions for personal expenses and shared bills.
- App header exposes primary and secondary route groups.
- Expenses page renders the add-expense section before category setup.
- Shared Bills page renders record-shared-bill before friend setup.

Run typecheck, unit tests, and production build before pushing.
