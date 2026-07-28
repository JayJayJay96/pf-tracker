import { randomUUID } from 'node:crypto';

import { expect, test, type APIRequestContext } from '@playwright/test';

const APP_ORIGIN = 'http://localhost:3000';
const SUPABASE_ORIGIN = 'http://127.0.0.1:54321';
const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';

test('completes a local passwordless sign-in roundtrip', async ({
  context,
  page,
  request,
}) => {
  const email = `auth-roundtrip-${Date.now()}-${randomUUID()}@example.test`;
  const navigationHistory: string[] = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      const url = new URL(frame.url());
      navigationHistory.push(`${url.origin}${url.pathname}`);
    }
  });

  await page.goto('/auth/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send sign-in link' }).click();
  await expect(page.getByRole('status')).toHaveText('Check your email for a sign-in link.');

  const confirmationUrl = await waitForConfirmationUrl(request, email);
  await page.evaluate((url) => {
    window.location.assign(url);
  }, confirmationUrl);

  await expect
    .poll(
      () => {
        const currentUrl = new URL(page.url());
        return `${currentUrl.origin}${currentUrl.pathname}`;
      },
      {
        message: `Navigation history: ${navigationHistory.join(' -> ')}`,
      },
    )
    .toBe(`${APP_ORIGIN}/`);
  await expect(
    page.getByRole('heading', { name: 'Personal Finance Tracker' }),
  ).toBeVisible();

  const cookies = await context.cookies();
  expect(
    cookies.some(
      (cookie) =>
        cookie.domain === 'localhost' &&
        /^sb-.+-auth-token(?:\.\d+)?$/.test(cookie.name) &&
        cookie.value.length > 0,
    ),
  ).toBe(true);
});

async function waitForConfirmationUrl(request: APIRequestContext, email: string) {
  const deadline = Date.now() + 15_000;
  const search = new URL('/api/v1/search', MAILPIT_URL);
  search.searchParams.set('query', `to:${email}`);

  while (Date.now() < deadline) {
    const searchResponse = await request.get(search.toString());
    if (searchResponse.ok()) {
      const mailbox = (await searchResponse.json()) as MailpitSearchResponse;
      const messageId = mailbox.messages[0]?.ID;

      if (messageId) {
        const messageResponse = await request.get(
          new URL(`/api/v1/message/${encodeURIComponent(messageId)}`, MAILPIT_URL).toString(),
        );

        if (messageResponse.ok()) {
          const message = (await messageResponse.json()) as MailpitMessage;
          const confirmationUrl = findConfirmationUrl(message.HTML, message.Text);

          if (confirmationUrl) {
            return confirmationUrl;
          }
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error('Timed out waiting for the local Supabase auth email.');
}

function findConfirmationUrl(html: string, text: string) {
  const candidates = [
    ...html.matchAll(/href=["']([^"']+)["']/gi),
    ...text.matchAll(/https?:\/\/[^\s<>"']+/gi),
  ];

  for (const candidate of candidates) {
    const rawUrl = (candidate[1] ?? candidate[0]).replaceAll('&amp;', '&');

    try {
      const url = new URL(rawUrl);
      if (
        (url.origin === SUPABASE_ORIGIN && url.pathname === '/auth/v1/verify') ||
        (url.origin === APP_ORIGIN && url.pathname === '/auth/confirm')
      ) {
        return url.toString();
      }
    } catch {
      // Ignore non-URL href values in the captured email.
    }
  }

  return null;
}

type MailpitSearchResponse = {
  messages: Array<{
    ID: string;
  }>;
};

type MailpitMessage = {
  HTML: string;
  Text: string;
};
