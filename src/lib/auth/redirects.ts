const APP_ORIGIN = 'http://app.local';

export function sanitizeRelativeNextPath(candidate: string | undefined) {
  if (!candidate?.startsWith('/')) {
    return '/';
  }

  try {
    const destination = new URL(candidate, APP_ORIGIN);

    if (destination.origin !== APP_ORIGIN || destination.pathname.startsWith('//')) {
      return '/';
    }

    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return '/';
  }
}
