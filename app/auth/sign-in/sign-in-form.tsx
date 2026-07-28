'use client';

import { type FormEvent, useState } from 'react';

import { signInWithPassword } from '../../../src/lib/auth/password-sign-in';
import { createClient } from '../../../src/lib/supabase/client';

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
    <form onSubmit={handleSubmit}>
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="email" required />
      <label htmlFor="password">Password</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in...' : 'Sign in'}
      </button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}
