import { randomUUID } from 'node:crypto';

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const APP_ORIGIN = 'http://localhost:3000';
const SUPABASE_ORIGIN = 'http://127.0.0.1:54321';
const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';

test('moves a shared bill from unresolved cash outflow to exact portions', async ({
  page,
  request,
}) => {
  await signIn(page, request);
  await page.goto('/shared-bills');

  const friendForm = page.getByRole('heading', { name: 'Friends' })
    .locator('..').locator('form');
  await friendForm.getByLabel('Friend name').fill('Alex');
  await friendForm.getByRole('button', { name: 'Add friend' }).click();

  const billForm = page.getByRole('heading', { name: 'Record shared bill' })
    .locator('..').locator('form');
  await billForm.getByLabel('Amount').fill('RM10.01');
  await billForm.getByLabel('Description').fill('Shared lunch');
  await billForm.getByLabel('Transaction date').fill('2026-07-03');
  await billForm.getByLabel('Payment method').selectOption('tng');
  await billForm.getByRole('button', { name: 'Save unresolved bill' }).click();

  const bill = page.getByRole('listitem').filter({ hasText: 'Shared lunch' });
  await expect(bill).toContainText('Unresolved');
  await expect(bill).toContainText('RM10.01 cash outflow');

  await page.goto('/?month=2026-07');
  await expect(page.getByText('Total cash outflow').locator('..')).toContainText('RM10.01');
  await expect(page.getByText('Personal spending', { exact: true }).locator('..'))
    .toContainText('RM0.00');
  await expect(page.getByRole('status')).toContainText('1 unresolved shared bill');

  await page.goto('/shared-bills');
  const unresolvedBill = page.getByRole('listitem').filter({ hasText: 'Shared lunch' });
  await unresolvedBill.getByLabel('Friend').selectOption({ label: 'Alex' });
  await unresolvedBill.getByLabel('Item description').fill('Shared meal');
  await unresolvedBill.getByRole('button', { name: 'Resolve equal split' }).click();

  const resolvedBill = page.getByRole('listitem').filter({ hasText: 'Shared lunch' });
  await expect(resolvedBill).toContainText('Resolved');
  await expect(resolvedBill).toContainText('Your portion RM5.01');
  await expect(resolvedBill).toContainText('Alex owes RM5.00');

  await page.goto('/?month=2026-07');
  await expect(page.getByText('Total cash outflow').locator('..')).toContainText('RM10.01');
  await expect(page.getByText('Personal spending', { exact: true }).locator('..'))
    .toContainText('RM5.01');
  await expect(page.getByText('Friends owe').locator('..')).toContainText('RM5.00');
  await expect(page.getByRole('status')).toHaveCount(0);
});

async function signIn(page: Page, request: APIRequestContext) {
  const email = `shared-bill-${Date.now()}-${randomUUID()}@example.test`;
  await page.goto('/auth/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send sign-in link' }).click();
  const confirmationUrl = await waitForConfirmationUrl(request, email);
  await page.evaluate((url) => window.location.assign(url), confirmationUrl);
  await expect(page).toHaveURL(`${APP_ORIGIN}/`);
}

async function waitForConfirmationUrl(request: APIRequestContext, email: string) {
  const deadline = Date.now() + 15_000;
  const search = new URL('/api/v1/search', MAILPIT_URL);
  search.searchParams.set('query', `to:${email}`);
  while (Date.now() < deadline) {
    const searchResponse = await request.get(search.toString());
    if (searchResponse.ok()) {
      const mailbox = await searchResponse.json() as {
        messages: Array<{ ID: string }>;
      };
      const messageId = mailbox.messages[0]?.ID;
      if (messageId) {
        const response = await request.get(
          new URL(`/api/v1/message/${encodeURIComponent(messageId)}`, MAILPIT_URL).toString(),
        );
        const message = await response.json() as { HTML: string; Text: string };
        const url = findConfirmationUrl(message.HTML, message.Text);
        if (url) return url;
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
        (url.origin === SUPABASE_ORIGIN && url.pathname === '/auth/v1/verify')
        || (url.origin === APP_ORIGIN && url.pathname === '/auth/confirm')
      ) return url.toString();
    } catch {
      // Ignore non-URL href values.
    }
  }
  return null;
}
