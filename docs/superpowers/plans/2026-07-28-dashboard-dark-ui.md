# Dashboard Dark UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the dashboard into a polished dark UI with subtle blue accents while preserving existing dashboard behavior.

**Architecture:** Keep the dashboard server page and data queries unchanged. Update `SummaryView` markup for semantic layout hooks, add global CSS imported by the root layout, and lightly style the protected app shell.

**Tech Stack:** Next.js, React, TypeScript, plain CSS, Vitest.

## Global Constraints

- No new dependencies.
- Do not change finance calculation logic.
- Do not change auth behavior.
- Keep existing route labels and dashboard metric labels.
- Use dark UI with subtle blue lining.

---

### Task 1: Dashboard Semantic Layout

**Files:**
- Modify: `src/features/dashboard/summary-view.tsx`
- Modify: `src/features/dashboard/summary-view.test.tsx`

**Interfaces:**
- Consumes: `SummaryViewProps`
- Produces: dashboard markup with `dashboard-shell`, `dashboard-hero`, `metric-grid`, and `metric-card` classes.

- [ ] **Step 1: Write failing test**

```typescript
expect(page).toContain('class="dashboard-shell"');
expect(page).toContain('class="dashboard-hero"');
expect(page).toContain('class="metric-grid"');
expect(page).toContain('class="metric-card"');
```

- [ ] **Step 2: Run focused test to verify it fails**

Run: `npx vitest run src/features/dashboard/summary-view.test.tsx`
Expected: FAIL because the new classes are not rendered yet.

- [ ] **Step 3: Update markup**

Wrap the dashboard in a shell, convert the nav and form into header controls, make remaining spendable the hero panel, and render metrics through a small local array to keep repeated cards consistent.

- [ ] **Step 4: Run focused test to verify it passes**

Run: `npx vitest run src/features/dashboard/summary-view.test.tsx`
Expected: PASS.

### Task 2: Global Dark Theme

**Files:**
- Create: `app/globals.css`
- Modify: `app/layout.tsx`
- Modify: `app/(app)/layout.tsx`

**Interfaces:**
- Consumes: generated dashboard class names from Task 1.
- Produces: dark theme, app chrome styling, card grids, form controls, and responsive layout.

- [ ] **Step 1: Add stylesheet import**

Import `./globals.css` from `app/layout.tsx`.

- [ ] **Step 2: Add CSS**

Create dark global styling with blue borders, compact nav links, hero panel, responsive metric cards, status panels, buttons, and inputs.

- [ ] **Step 3: Style protected header**

Add class names to the protected layout header and sign-out button so the shell matches the dashboard.

- [ ] **Step 4: Verify**

Run: `npm run typecheck`, `npm run test:unit`, and `npm run build`.

### Task 3: Commit And Push

**Files:**
- All files modified by Tasks 1 and 2.

**Interfaces:**
- Produces: pushed `main` branch for Vercel auto-deploy.

- [ ] **Step 1: Review diff**

Run: `git diff --check` and `git status --short`.

- [ ] **Step 2: Commit**

Run: `git add ...` then `git commit -m "style: refresh dashboard dark ui"`.

- [ ] **Step 3: Push**

Run: `git push`.
