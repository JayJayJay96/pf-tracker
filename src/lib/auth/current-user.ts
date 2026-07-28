type ClaimsResult = {
  data: {
    claims?: {
      sub?: unknown;
    };
  } | null;
  error: unknown;
};

/** Resolves verified claims for page guards without exposing unauthenticated data. */
export async function getCurrentUserId(
  getClaims: () => Promise<ClaimsResult>,
): Promise<string | null> {
  const { data, error } = await getClaims();
  const subject = data?.claims?.sub;

  if (error || typeof subject !== 'string' || subject.trim() === '') {
    return null;
  }

  return subject;
}

/** Resolves the authenticated identity for mutations, never form input. */
export async function requireCurrentUserId(
  getClaims: () => Promise<ClaimsResult>,
): Promise<string> {
  const userId = await getCurrentUserId(getClaims);
  if (!userId) {
    throw new Error('Authentication required');
  }
  return userId;
}
