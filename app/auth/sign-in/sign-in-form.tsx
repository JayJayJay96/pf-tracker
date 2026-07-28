'use client';

import { type FormEvent, useState } from 'react';

import { createClient } from '../../../src/lib/supabase/client';

type SignInFormProps = {
  nextPath: string;
};

export function SignInForm({ nextPath }: SignInFormProps) {
  const [message, setMessage] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(undefined);

    const formData = new FormData(event.currentTarget);
    const email = formData.get('email');

    if (typeof email !== 'string') {
      setMessage('Enter a valid email address.');
      setIsSubmitting(false);
      return;
    }

    const emailRedirectTo = new URL('/auth/confirm', window.location.origin);
    if (nextPath !== '/') {
      emailRedirectTo.searchParams.set('next', nextPath);
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: emailRedirectTo.toString(),
        shouldCreateUser: true,
      },
    });

    setMessage(
      error
        ? 'We could not send the sign-in link. Please try again.'
        : 'Check your email for a sign-in link.',
    );
    setIsSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="email" required />
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Sending…' : 'Send sign-in link'}
      </button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}
