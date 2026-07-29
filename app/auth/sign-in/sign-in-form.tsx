'use client';

import { type FormEvent, useState } from 'react';

import { signInWithPassword } from '../../../src/lib/auth/password-sign-in';
import { createClient } from '../../../src/lib/supabase/client';

const FIELD_CLASS = 'w-full rounded-lg border border-hairline bg-black/35 px-3.5 '
  + 'py-2.5 text-ink placeholder:text-ink-muted';

export function SignInForm() {
  const [message, setMessage] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(undefined);

    const formData = new FormData(event.currentTarget);
    const email = formData.get('email');
    const password = formData.get('password');

    if (typeof email !== 'string' || typeof password !== 'string') {
      setMessage('Enter your email and password.');
      setIsSubmitting(false);
      return;
    }

    const result = await signInWithPassword(createClient(), email, password);
    if (result.ok) {
      window.location.assign(result.redirectTo);
      return;
    }

    setMessage(result.message);
    setIsSubmitting(false);
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <div className="grid gap-1.5">
        <label className="text-sm text-ink-muted" htmlFor="email">Email</label>
        <input
          className={FIELD_CLASS}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
        />
      </div>
      <div className="grid gap-1.5">
        <label className="text-sm text-ink-muted" htmlFor="password">Password</label>
        <input
          className={FIELD_CLASS}
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <button
        className="mt-1 w-full rounded-lg border border-hairline-strong bg-accent-soft px-4 py-2.5 font-semibold text-ink hover:border-accent hover:bg-accent/20 disabled:cursor-not-allowed disabled:border-ink-muted/35 disabled:bg-transparent disabled:text-ink-muted"
        type="submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </button>
      {message ? (
        <p
          className="rounded-lg border border-negative/50 bg-negative/10 px-3.5 py-2.5 text-sm font-semibold text-negative"
          role="alert"
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
