# Password Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace magic-link authentication with a one-owner email-and-password sign-in flow without weakening data access controls.

**Architecture:** Keep Supabase as the identity provider and reuse its existing browser client and SSR cookie session flow. The sign-in component will call `signInWithPassword`; the app will not perform signup or email delivery.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase Auth, Vitest.

## Global Constraints

- Do not expose a Supabase secret/service-role key.
- Do not change database RLS policies or protected-route behavior.
- Do not create accounts or send email from the app.

---

### Task 1: Password sign-in form

**Files:**
- Modify: `app/auth/sign-in/sign-in-form.tsx`
- Create: `app/auth/sign-in/sign-in-form.test.tsx`

**Interfaces:**
- Consumes: `createClient().auth.signInWithPassword({ email: string, password: string })`.
- Produces: a signed-in Supabase browser session when credentials are valid.

- [ ] **Step 1: Write the failing test**

Assert that submitting a valid email/password calls `signInWithPassword` with those values, and that a rejected request displays `Email or password is incorrect.`.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm run test:unit -- app/auth/sign-in/sign-in-form.test.tsx`

Expected: FAIL because the form currently calls `signInWithOtp` and has no password field.

- [ ] **Step 3: Implement the minimal form change**

Replace the OTP request with `signInWithPassword`, add a password input with `autoComplete="current-password"`, remove redirect/email-sending state, and show the defined generic credential error.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm run test:unit -- app/auth/sign-in/sign-in-form.test.tsx`

Expected: PASS.

- [ ] **Step 5: Verify and commit**

Run: `npm run lint; npm run typecheck; npm run test:unit; npm run build`

Commit: `feat: replace magic link with password sign-in`
