import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { sanitizeRelativeNextPath } from './redirects';

type AuthResult = Promise<{
  error: unknown;
}>;

type AuthConfirmClient = {
  auth: {
    exchangeCodeForSession(code: string): AuthResult;
    verifyOtp(params: { token_hash: string; type: EmailOtpType }): AuthResult;
  };
};

type CreateAuthClient = () => Promise<AuthConfirmClient>;

const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  'email',
  'magiclink',
  'signup',
  'invite',
  'recovery',
  'email_change',
]);

export function createAuthConfirmHandler(createClient: CreateAuthClient) {
  return async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code')?.trim();
    const tokenHash = requestUrl.searchParams.get('token_hash')?.trim();
    const candidateType = requestUrl.searchParams.get('type');
    const nextPath = sanitizeRelativeNextPath(
      requestUrl.searchParams.get('next') ?? undefined,
    );

    let authenticated = false;

    if (code) {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      authenticated = !error;
    } else if (tokenHash && candidateType && EMAIL_OTP_TYPES.has(candidateType)) {
      const supabase = await createClient();
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: candidateType as EmailOtpType,
      });
      authenticated = !error;
    }

    if (authenticated) {
      return noStoreRedirect(new URL(nextPath, requestUrl));
    }

    const signInUrl = new URL('/auth/sign-in', requestUrl);
    signInUrl.searchParams.set('error', 'invalid_or_expired_link');
    if (nextPath !== '/') {
      signInUrl.searchParams.set('next', nextPath);
    }

    return noStoreRedirect(signInUrl);
  };
}

function noStoreRedirect(destination: URL) {
  const response = NextResponse.redirect(destination, 303);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
