import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  // The template lets each route name itself; every route shared one title before.
  title: {
    default: 'Personal Finance Tracker',
    template: '%s · PF Tracker',
  },
  description: 'Private monthly planning, personal spending, and shared bills.',
};

export const viewport: Viewport = {
  themeColor: '#0b1621',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
