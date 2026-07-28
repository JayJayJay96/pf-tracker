import { describe, expect, it } from 'vitest';

import { sanitizeRelativeNextPath } from './redirects';

describe('sanitizeRelativeNextPath', () => {
  it.each([
    { candidate: '/dashboard', expected: '/dashboard' },
    { candidate: '/plan?month=2026-07#income', expected: '/plan?month=2026-07#income' },
    { candidate: undefined, expected: '/' },
    { candidate: '', expected: '/' },
    { candidate: 'dashboard', expected: '/' },
    { candidate: 'https://attacker.example/steal', expected: '/' },
    { candidate: '//attacker.example/steal', expected: '/' },
    { candidate: '/\\attacker.example/steal', expected: '/' },
    { candidate: '/a/..//attacker.example', expected: '/' },
    { candidate: '/%2e%2e//attacker.example', expected: '/' },
  ])('maps $candidate to $expected', ({ candidate, expected }) => {
    expect(sanitizeRelativeNextPath(candidate)).toBe(expected);
  });
});
