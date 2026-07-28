import { describe, expect, it, vi } from 'vitest';

import { createAuthConfirmHandler } from './confirm-route';

const APP_URL = 'https://finance.example';

describe('auth confirmation route', () => {
  it('exchanges a PKCE code and redirects to the sanitized next path', async () => {
    const harness = createHarness();
    const handleConfirm = createAuthConfirmHandler(harness.createClient);

    const response = await handleConfirm(
      request('/auth/confirm?code=pkce-code&next=%2Fplan%3Fmonth%3D2026-07'),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      'https://finance.example/plan?month=2026-07',
    );
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(harness.exchangeCodeForSession).toHaveBeenCalledWith('pkce-code');
    expect(harness.verifyOtp).not.toHaveBeenCalled();
  });

  it('returns to sign in when PKCE code exchange fails', async () => {
    const harness = createHarness({ codeError: new Error('expired code') });
    const handleConfirm = createAuthConfirmHandler(harness.createClient);

    const response = await handleConfirm(
      request('/auth/confirm?code=expired-code&next=%2Fplan'),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      'https://finance.example/auth/sign-in?error=invalid_or_expired_link&next=%2Fplan',
    );
    expect(harness.exchangeCodeForSession).toHaveBeenCalledWith('expired-code');
    expect(harness.verifyOtp).not.toHaveBeenCalled();
  });

  it('verifies a supported token hash and redirects to the sanitized next path', async () => {
    const harness = createHarness();
    const handleConfirm = createAuthConfirmHandler(harness.createClient);

    const response = await handleConfirm(
      request('/auth/confirm?token_hash=hashed-token&type=email&next=%2Ffriends'),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://finance.example/friends');
    expect(harness.verifyOtp).toHaveBeenCalledWith({
      token_hash: 'hashed-token',
      type: 'email',
    });
    expect(harness.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('returns to sign in when token-hash verification fails', async () => {
    const harness = createHarness({ tokenError: new Error('expired token') });
    const handleConfirm = createAuthConfirmHandler(harness.createClient);

    const response = await handleConfirm(
      request('/auth/confirm?token_hash=expired-token&type=magiclink'),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      'https://finance.example/auth/sign-in?error=invalid_or_expired_link',
    );
    expect(harness.verifyOtp).toHaveBeenCalledWith({
      token_hash: 'expired-token',
      type: 'magiclink',
    });
  });

  it('rejects an unsupported token type without creating an auth client', async () => {
    const harness = createHarness();
    const handleConfirm = createAuthConfirmHandler(harness.createClient);

    const response = await handleConfirm(
      request('/auth/confirm?token_hash=hashed-token&type=sms'),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      'https://finance.example/auth/sign-in?error=invalid_or_expired_link',
    );
    expect(harness.createClient).not.toHaveBeenCalled();
  });

  it.each([
    'https://attacker.example/steal',
    '/a/..//attacker.example/steal',
  ])('keeps a successful callback on-origin for next=%s', async (next) => {
    const harness = createHarness();
    const handleConfirm = createAuthConfirmHandler(harness.createClient);
    const url = new URL('/auth/confirm', APP_URL);
    url.searchParams.set('code', 'pkce-code');
    url.searchParams.set('next', next);

    const response = await handleConfirm(new Request(url));

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://finance.example/');
    expect(harness.exchangeCodeForSession).toHaveBeenCalledWith('pkce-code');
  });
});

function request(path: string) {
  return new Request(new URL(path, APP_URL));
}

function createHarness({
  codeError = null,
  tokenError = null,
}: {
  codeError?: Error | null;
  tokenError?: Error | null;
} = {}) {
  const exchangeCodeForSession = vi.fn(async () => ({
    error: codeError,
  }));
  const verifyOtp = vi.fn(async () => ({
    error: tokenError,
  }));
  const createClient = vi.fn(async () => ({
    auth: {
      exchangeCodeForSession,
      verifyOtp,
    },
  }));

  return {
    createClient,
    exchangeCodeForSession,
    verifyOtp,
  };
}
