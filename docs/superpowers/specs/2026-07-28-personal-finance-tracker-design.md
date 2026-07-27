# Personal Finance Tracker MVP Design

## Goal

Build a private, mobile-first Malaysian Ringgit personal-finance PWA that
shows a conservative amount safe to spend, records personal and shared
expenses, and tracks money friends owe the user.

## Chosen Platform

- Next.js with TypeScript
- Supabase Auth using passwordless email sign-in links
- Supabase PostgreSQL with row-level security
- Vercel deployment
- Responsive custom UI and standard PWA manifest/service worker support

## Scope Boundaries

The MVP supports one account owner, RM only, calendar-month reporting, Touch
'n Go and cash labels, and friends owing the user. It excludes bank and TNG
integrations, OCR, AI input, partial repayments, friend accounts, and the
user owing friends.

## Architecture

The Next.js application owns rendering, interaction, and form validation.
Supabase is the authoritative database and authentication provider. Every
user-owned row contains a `user_id`, and row-level security permits access
only to that owner.

Financial calculation logic is implemented as pure TypeScript domain modules,
separate from page components and database access. This includes monthly
summary calculations, bill allocation, rounding, validation, and friend
balance calculations. Server-side services persist validated commands and
return explicit errors for invalid state transitions.

## Primary Data Model

The implementation uses the entities described in the project source of
truth: income templates and entries; commitment templates and entries;
savings and investment plan entries; transactions; bill items and item
assignments; bill participants; bill adjustments; friends; payment requests
and request-item snapshots; categories; and financial periods.

Recurring templates create dated period-entry snapshots. A template update
only affects later generated entries. Transaction date determines reporting;
recorded date records when the user entered the data.

## Financial Behaviour

The dashboard calculates remaining spendable money as confirmed income minus
all active monthly commitments, savings allocations, investment allocations,
and personal spending. Commitments are subtracted before they are paid so the
result is a conservative spending guide, not a live wallet balance.

For shared expenses, total cash paid is recorded immediately. A resolved bill
stores final portions for the user and each friend. The user's final portion
is personal spending; friend portions are receivables. Friend repayments
settle receivables and are never income.

An unresolved shared bill shows full cash outflow but does not increase final
personal spending. It remains prominently flagged until resolved.

Bill allocations use item subtotals and adjustments in this order: item
discounts, bill discounts, service charge, tax, then rounding. Default
proportional distribution is used for bill-level charges and discounts. Any
currency residue after rounding is assigned to the user by default. The final
participant portions must exactly equal the final bill total.

## Payment Requests

A payment request contains selected unrequested portions for exactly one
friend. Creation snapshots the bill description, date, and amount and locks
the selected portions. New bills do not alter existing requests. A request
can be pending, paid, cancelled, or forgiven. It is paid only in full;
cancelling unlocks included portions so the bill can be corrected or
requested again.

## Screens and User Flows

- Home: selected-month summary, spendable amount, outflow, friend receivables,
  upcoming commitments, unresolved bills, and pending requests.
- Add: quick income, planning allocation, personal expense, unresolved shared
  expense, or fully allocated shared expense entry.
- Transactions: searchable and filterable history, with bill-resolution and
  drill-down views.
- Friends: balances, ledger, request creation, request status changes, and
  copyable request summaries.
- More: Monthly Plan, reports, categories/settings, and CSV/JSON export.

## Security and Reliability

All browser writes are authenticated and validated on the server boundary.
Database constraints protect state transitions and referential integrity;
application code prevents user-facing invalid operations such as duplicate
active requests for the same bill portion. Deletion uses confirmation and
preserves historical correctness; archive behaviour is preferred where a
record is referenced by reports.

The initial PWA is online-first: Supabase remains the write source of truth,
while browser storage preserves form drafts and unsaved input. Full offline
record creation, duplicate-safe queueing, conflict management, and background
sync are a later, separately tested phase.

## Testing Strategy

Unit tests cover money arithmetic, allocation, rounding, monthly summaries,
period generation, and payment-request state transitions. Integration tests
cover authenticated database rules and server commands. End-to-end tests cover
the core user flows: setup, quick expense, unresolved-to-resolved shared bill,
request creation, full settlement, backdated entry, and historical review.

## Delivery Strategy

Deliver in small vertical slices: foundation and auth; monthly planning and
dashboard; personal expenses; shared-bill allocation; friend settlement;
reports/export/PWA; then offline-sync hardening. Each slice must provide a
working, demonstrable user outcome and pass its calculation and workflow
tests before the next begins.
