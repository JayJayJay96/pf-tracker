import { describe, expect, it } from 'vitest';

import { getCurrentUserId, requireCurrentUserId } from './current-user';

describe('current user authorization', () => {
  it('returns the authenticated claims subject', async () => {
    await expect(requireCurrentUserId(async () => ({
      data: { claims: { sub: 'user-a' } },
      error: null,
    }))).resolves.toBe('user-a');
  });

  it('rejects a failed claims lookup', async () => {
    await expect(requireCurrentUserId(async () => ({
      data: null,
      error: { message: 'invalid token' },
    }))).rejects.toThrow('Authentication required');
  });

  it('rejects claims without a subject', async () => {
    await expect(requireCurrentUserId(async () => ({
      data: { claims: {} },
      error: null,
    }))).rejects.toThrow('Authentication required');
  });

  it('returns null for an unauthenticated page request so it can redirect quietly', async () => {
    await expect(getCurrentUserId(async () => ({
      data: null,
      error: { message: 'missing token' },
    }))).resolves.toBeNull();
  });
});
