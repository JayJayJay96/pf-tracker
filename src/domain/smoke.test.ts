import { describe, expect, it } from 'vitest';

import { domainSmokeStatus } from './smoke';

describe('domain test harness', () => {
  it('reports that the domain layer is available to unit tests', () => {
    expect(domainSmokeStatus()).toBe('ready');
  });
});
