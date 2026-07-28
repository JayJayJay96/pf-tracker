import { describe, expect, it } from 'vitest';

import manifest from '../../app/manifest';

describe('PWA manifest', () => {
  it('provides a standalone app shell with required install icons', () => {
    expect(manifest()).toMatchObject({
      name: 'Personal Finance Tracker',
      short_name: 'PF Tracker',
      start_url: '/',
      display: 'standalone',
      icons: [
        expect.objectContaining({ src: '/icon-192x192.png', sizes: '192x192' }),
        expect.objectContaining({ src: '/icon-512x512.png', sizes: '512x512' }),
      ],
    });
  });
});
