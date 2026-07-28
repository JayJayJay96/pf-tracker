type ClaimsResult =
  | {
      data: {
        claims: {
          sub?: string;
        };
      };
      error: null;
    }
  | {
      data: null;
      error: unknown;
    };

type GetClaims = () => Promise<ClaimsResult>;

export async function getProtectedRouteRedirect(_getClaims: GetClaims) {
  const { data, error } = await _getClaims();

  if (error || !data?.claims.sub) {
    return '/auth/sign-in';
  }

  return null;
}
