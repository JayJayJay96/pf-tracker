# Password Login Design

## Goal

Replace the passwordless email magic-link screen with a single-owner email-and-password sign-in screen so the tracker does not depend on outbound email delivery.

## Chosen approach

The existing Supabase Auth project remains the identity provider. The browser form will call `supabase.auth.signInWithPassword({ email, password })`; successful sessions continue to use the existing cookie-based SSR session handling and row-level security policies.

## Scope

- Replace the magic-link request with email and password inputs.
- Show a non-sensitive error for an invalid email/password combination.
- Do not create accounts from the application and do not send email.
- Preserve protected routes, exports, session cookies, and all existing database policies.
- Create the single owner account manually in Supabase Auth, then disable public signups.

## Explicit non-goals

- No unauthenticated public mode.
- No service-role key in Vercel or browser code.
- No password reset, multi-user management, or custom SMTP work in this change.

## Verification

- Unit test the sign-in client request through an extracted submit helper.
- Verify an invalid password surfaces the expected generic message.
- Run lint, typecheck, unit tests, and production build before deployment.
