import { describe, expect, it } from 'vitest';

import { getProtectedRouteRedirect } from './protected-route';

describe('getProtectedRouteRedirect', () => {
  it('redirects when verified claims are absent', async () => {
    const destination = await getProtectedRouteRedirect(async () => ({
      data: null,
      error: null,
    }));

    expect(destination).toBe('/auth/sign-in');
  });

  it('redirects when claim verification fails', async () => {
    const destination = await getProtectedRouteRedirect(async () => ({
      data: null,
      error: new Error('invalid claims'),
    }));

    expect(destination).toBe('/auth/sign-in');
  });

  it('allows access when verified claims contain a subject', async () => {
    const destination = await getProtectedRouteRedirect(async () => ({
      data: {
        claims: {
          sub: '00000000-0000-0000-0000-000000000001',
        },
      },
      error: null,
    }));

    expect(destination).toBeNull();
  });
});
