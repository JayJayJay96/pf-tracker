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
  await friendForm.getByLabel('Friend name').fill('Bee');
  await friendForm.getByRole('button', { name: 'Add friend' }).click();

  const billForm = page.getByRole('heading', { name: 'Record shared bill' })
    .locator('..').locator('form');
  await billForm.getByLabel('Amount').fill('RM18.00');
  await billForm.getByLabel('Description').fill('Shared lunch');
  await billForm.getByLabel('Transaction date').fill('2026-07-03');
  await billForm.getByLabel('Payment method').selectOption('tng');
  await billForm.getByRole('button', { name: 'Save unresolved bill' }).click();

  const bill = page.getByRole('listitem').filter({ hasText: 'Shared lunch' });
  await expect(bill).toContainText('Unresolved');
  await expect(bill).toContainText('RM18.00 cash outflow');

  await page.goto('/?month=2026-07');
  await expect(page.getByText('Total cash outflow').locator('..')).toContainText('RM18.00');
  await expect(page.getByText('Personal spending', { exact: true }).locator('..'))
    .toContainText('RM0.00');
  await expect(page.getByRole('status')).toContainText('1 unresolved shared bill');

  await page.goto('/shared-bills');
  const unresolvedBill = page.getByRole('listitem').filter({ hasText: 'Shared lunch' });
  await unresolvedBill.getByLabel('Include Alex').check();
  await unresolvedBill.getByLabel('Include Bee').check();
  await unresolvedBill.getByLabel('Item 1 description').fill('Pizza');
  await unresolvedBill.getByLabel('Item 1 amount').fill('RM10.01');
  await unresolvedBill.getByLabel('Item 1 discount').fill('RM0.01');
  await unresolvedBill.getByLabel('Item 1 assign Alex').check();
  await unresolvedBill.getByLabel('Item 1 assign Bee').check();

  await unresolvedBill.getByRole('button', { name: 'Add item' }).click();
  await unresolvedBill.getByLabel('Item 2 description').fill('Dessert');
  await unresolvedBill.getByLabel('Item 2 amount').fill('RM6.00');
  await unresolvedBill.getByLabel('Item 2 assign Alex').check();

  for (let index = 0; index < 5; index += 1) {
    await unresolvedBill.getByRole('button', { name: 'Add adjustment' }).click();
  }
  await unresolvedBill.getByLabel('Adjustment 1 amount').fill('RM1.00');

  await unresolvedBill.getByLabel('Adjustment 2 amount').fill('RM0.25');
  await unresolvedBill.getByLabel('Adjustment 2 distribution').selectOption('manual');
  await unresolvedBill.getByLabel('Adjustment 2 You manual amount').fill('RM0.25');

  await unresolvedBill.getByLabel('Adjustment 3 type').selectOption('service');
  await unresolvedBill.getByLabel('Adjustment 3 amount').fill('RM1.60');

  await unresolvedBill.getByLabel('Adjustment 4 type').selectOption('tax');
  await unresolvedBill.getByLabel('Adjustment 4 amount').fill('RM1.66');

  await unresolvedBill.getByLabel('Adjustment 5 type').selectOption('rounding');
  await unresolvedBill.getByLabel('Adjustment 5 amount').fill('-RM0.01');
  await unresolvedBill.getByLabel('Adjustment 5 distribution').selectOption('user');

  const review = unresolvedBill.getByRole('heading', { name: 'Allocation review' })
    .locator('..');
  await expect(review).toContainText('You: RM6.95');
  await expect(review).toContainText('Alex: RM7.24');
  await expect(review).toContainText('Bee: RM3.81');
  await unresolvedBill.getByLabel('Confirm reviewed allocation').check();
  await unresolvedBill.getByRole('button', { name: 'Resolve shared bill' }).click();

  const resolvedBill = page.getByRole('listitem').filter({ hasText: 'Shared lunch' });
  await expect(resolvedBill).toContainText('Resolved');
  await expect(resolvedBill).toContainText('Your portion RM6.95');
  await expect(resolvedBill).toContainText('Alex owes RM7.24');
  await expect(resolvedBill).toContainText('Bee owes RM3.81');

  await page.goto('/?month=2026-07');
  await expect(page.getByText('Total cash outflow').locator('..')).toContainText('RM18.00');
  await expect(page.getByText('Personal spending', { exact: true }).locator('..'))
    .toContainText('RM6.95');
  await expect(page.getByText('Friends owe').locator('..')).toContainText('RM11.05');
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
