import { randomUUID } from 'node:crypto';

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const APP_ORIGIN = 'http://localhost:3000';
const SUPABASE_ORIGIN = 'http://127.0.0.1:54321';
const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';

test('snapshots two bills, leaves a later bill unrequested, and settles without income', async ({
  page,
  request,
}) => {
  await signIn(page, request);
  await page.goto('/shared-bills');

  const friendForm = page.getByRole('heading', { name: 'Friends' })
    .locator('..').locator('form');
  await friendForm.getByLabel('Friend name').fill('Alex');
  await friendForm.getByRole('button', { name: 'Add friend' }).click();

  await createAndResolveBill(page, 'Dinner', 'RM20.00', '2026-07-10');
  await createAndResolveBill(page, 'Movie', 'RM10.00', '2026-07-14');

  await page.goto('/friends');
  await expect(page.getByRole('listitem').filter({ hasText: 'Alex' }))
    .toContainText('RM15.00 outstanding');
  await page.getByRole('link', { name: 'Alex' }).click();

  const requestForm = page.getByRole('heading', {
    name: 'Create lump-sum request',
  }).locator('..').locator('form');
  await requestForm.getByLabel(/Dinner/).check();
  await requestForm.getByLabel(/Movie/).check();
  await requestForm.getByLabel('Request date').fill('2026-07-18');
  await requestForm.getByLabel('Note').fill('July expenses');
  await requestForm.getByRole('button', {
    name: 'Create payment request',
  }).click();

  await expect(page).toHaveURL(/\/friends\/[^/]+\/requests\/[^/]+$/);
  const requestUrl = page.url();
  const summary = page.getByLabel('Copyable payment summary');
  await expect(summary).toHaveValue(/10 Jul 2026 — Dinner: RM10.00/);
  await expect(summary).toHaveValue(/14 Jul 2026 — Movie: RM5.00/);
  await expect(summary).toHaveValue(/Total: RM15.00/);

  await page.goto('/shared-bills');
  await createAndResolveBill(page, 'Coffee', 'RM8.00', '2026-07-16');

  await page.goto(requestUrl);
  await expect(summary).toHaveValue(/Total: RM15.00/);
  await expect(summary).not.toHaveValue(/Coffee/);

  await page.goto('/friends');
  await expect(page.getByRole('listitem').filter({ hasText: 'Alex' }))
    .toContainText('RM19.00 outstanding');
  await page.goto(requestUrl);

  const paidForm = page.getByRole('button', { name: 'Mark paid in full' })
    .locator('..');
  await paidForm.getByLabel('Paid date').fill('2026-07-22');
  await paidForm.getByLabel(/Confirm full payment/).check();
  await paidForm.getByRole('button', { name: 'Mark paid in full' }).click();
  await expect(page.getByText(/— paid/)).toBeVisible();

  await page.goto('/friends');
  const alex = page.getByRole('listitem').filter({ hasText: 'Alex' });
  await expect(alex).toContainText('RM4.00 outstanding');
  await expect(alex).toContainText('RM15.00 paid');

  await page.goto('/?month=2026-07');
  await expect(page.getByText('Confirmed income').locator('..')).toContainText('RM0.00');
  await expect(page.getByText('Personal spending', { exact: true }).locator('..'))
    .toContainText('RM19.00');
  await expect(page.getByText('Friends owe').locator('..')).toContainText('RM4.00');
});

async function createAndResolveBill(
  page: Page,
  description: string,
  amount: string,
  transactionDate: string,
) {
  if (!page.url().endsWith('/shared-bills')) await page.goto('/shared-bills');
  const billForm = page.getByRole('heading', { name: 'Record shared bill' })
    .locator('..').locator('form');
  await billForm.getByLabel('Amount').fill(amount);
  await billForm.getByLabel('Description').fill(description);
  await billForm.getByLabel('Transaction date').fill(transactionDate);
  await billForm.getByLabel('Payment method').selectOption('tng');
  await billForm.getByRole('button', { name: 'Save unresolved bill' }).click();

  const bill = page.getByRole('listitem').filter({ hasText: description });
  await bill.getByLabel('Include Alex').check();
  await bill.getByLabel('Item 1 description').fill(description);
  await bill.getByLabel('Item 1 assign Alex').check();
  await bill.getByLabel('Confirm reviewed allocation').check();
  await bill.getByRole('button', { name: 'Resolve shared bill' }).click();
  await expect(bill).toContainText('Resolved');
}

async function signIn(page: Page, request: APIRequestContext) {
  const email = `payment-request-${Date.now()}-${randomUUID()}@example.test`;
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
