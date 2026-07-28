import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Personal Finance Tracker',
    short_name: 'PF Tracker',
    description: 'Private personal spending, shared bills, and friend settlements.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f4ed',
    theme_color: '#173f35',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
