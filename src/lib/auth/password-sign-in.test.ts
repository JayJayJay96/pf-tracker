import { describe, expect, it, vi } from 'vitest';

import { signInWithPassword } from './password-sign-in';

describe('password sign-in', () => {
  it('submits the supplied credentials to Supabase', async () => {
    const signInWithPasswordRequest = vi.fn(async () => ({ error: null }));

    const result = await signInWithPassword(
      { auth: { signInWithPassword: signInWithPasswordRequest } },
      'owner@example.com',
      'correct-horse-battery-staple',
    );

    expect(signInWithPasswordRequest).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'correct-horse-battery-staple',
    });
    expect(result).toEqual({ ok: true, redirectTo: '/' });
  });

  it('returns a generic error when Supabase rejects the credentials', async () => {
    const result = await signInWithPassword(
      { auth: { signInWithPassword: vi.fn(async () => ({ error: new Error('invalid') })) } },
      'owner@example.com',
      'wrong-password',
    );

    expect(result).toEqual({ ok: false, message: 'Email or password is incorrect.' });
  });
});
