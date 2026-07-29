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
  await page.goto('/expenses');
  const categoryForm = page.getByRole('heading', { name: 'Expense categories' })
    .locator('..').locator('form');
  await categoryForm.getByLabel('New category name').fill('Food');
  await categoryForm.getByRole('button', { name: 'Add category' }).click();
  const expenseForm = page.getByRole('heading', { name: 'Add personal expense' })
    .locator('..').locator('form');
  await expenseForm.getByLabel('Amount').fill('4.25');
  await expenseForm.getByLabel('Description').fill('Personal snack');
  await expenseForm.getByLabel('Merchant').fill('Corner Market');
  await expenseForm.getByLabel('Transaction date').fill('2026-07-04');
  await expenseForm.getByLabel('Category').selectOption({ label: 'Food' });
  await expenseForm.getByLabel('Payment method').selectOption('cash');
  await expenseForm.getByRole('button', { name: 'Save expense' }).click();

  await page.goto('/shared-bills');

  const friendForm = page.getByRole('heading', { name: 'Friends' })
    .locator('..').locator('form');
  await friendForm.getByLabel('Friend name').fill('Alex');
  await friendForm.getByRole('button', { name: 'Add friend' }).click();
  await friendForm.getByLabel('Friend name').fill('Bee');
  await friendForm.getByRole('button', { name: 'Add friend' }).click();

  const billForm = page.getByRole('heading', { name: 'Record shared bill' })
    .locator('..').locator('form');
  await billForm.getByLabel('Amount').fill('18.00');
  await billForm.getByLabel('Description').fill('Shared lunch');
  await billForm.getByLabel('Transaction date').fill('2026-07-03');
  await billForm.getByLabel('Payment method').selectOption('tng');
  await billForm.getByRole('button', { name: 'Save unresolved bill' }).click();

  const bill = page.getByRole('listitem').filter({ hasText: 'Shared lunch' });
  await expect(bill).toContainText('Unresolved');
  await expect(bill).toContainText('RM18.00 cash outflow');

  await page.goto('/?month=2026-07');
  await expect(page.getByText('Total cash outflow').locator('..')).toContainText('RM22.25');
  await expect(page.getByText('Personal spending', { exact: true }).locator('..'))
    .toContainText('RM4.25');
  await expect(page.getByRole('status')).toContainText('1 unresolved shared bill');

  await page.goto('/shared-bills');
  const unresolvedBill = page.getByRole('listitem').filter({ hasText: 'Shared lunch' });
  await unresolvedBill.getByLabel('Include Alex').check();
  await unresolvedBill.getByLabel('Include Bee').check();
  await unresolvedBill.getByLabel('Item 1 description').fill('Pizza');
  await unresolvedBill.getByLabel('Item 1 amount').fill('10.01');
  await unresolvedBill.getByLabel('Item 1 discount').fill('0.01');
  await unresolvedBill.getByLabel('Item 1 assign Alex').check();
  await unresolvedBill.getByLabel('Item 1 assign Bee').check();

  await unresolvedBill.getByRole('button', { name: 'Add item' }).click();
  await unresolvedBill.getByLabel('Item 2 description').fill('Dessert');
  await unresolvedBill.getByLabel('Item 2 amount').fill('6.00');
  await unresolvedBill.getByLabel('Item 2 assign Alex').check();

  for (let index = 0; index < 5; index += 1) {
    await unresolvedBill.getByRole('button', { name: 'Add adjustment' }).click();
  }
  await unresolvedBill.getByLabel('Adjustment 1 amount').fill('1.00');

  await unresolvedBill.getByLabel('Adjustment 2 amount').fill('0.25');
  await unresolvedBill.getByLabel('Adjustment 2 distribution').selectOption('manual');
  await unresolvedBill.getByLabel('Adjustment 2 You manual amount').fill('0.25');

  await unresolvedBill.getByLabel('Adjustment 3 type').selectOption('service');
  await unresolvedBill.getByLabel('Adjustment 3 amount').fill('1.60');

  await unresolvedBill.getByLabel('Adjustment 4 type').selectOption('tax');
  await unresolvedBill.getByLabel('Adjustment 4 amount').fill('1.66');

  await unresolvedBill.getByLabel('Adjustment 5 type').selectOption('rounding');
  await unresolvedBill.getByLabel('Adjustment 5 amount').fill('-0.01');
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
  await expect(page.getByText('Total cash outflow').locator('..')).toContainText('RM22.25');
  await expect(page.getByText('Personal spending', { exact: true }).locator('..'))
    .toContainText('RM11.20');
  await expect(page.getByText('Friends owe').locator('..')).toContainText('RM11.05');
  await expect(page.getByRole('status')).toHaveCount(0);

  await page.goto('/transactions');
  const history = page.getByRole('heading', { name: 'Unified history' }).locator('..');
  await expect(history.getByText('Personal snack')).toBeVisible();
  await expect(history.getByText('Shared lunch')).toBeVisible();

  await page.getByLabel('Transaction type').selectOption('personal');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(history.getByText('Personal snack')).toBeVisible();
  await expect(history.getByText('Shared lunch')).toHaveCount(0);

  await page.getByLabel('Transaction type').selectOption('shared');
  await page.getByLabel('Shared state').selectOption('resolved');
  await page.locator('select[name="friendId"]').selectOption({ label: 'Alex' });
  await page.getByLabel('Payment-request status').selectOption('unrequested');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(history.getByText('Shared lunch')).toBeVisible();
  await expect(history.getByText('Personal snack')).toHaveCount(0);
  await history.getByText('Shared lunch').click();
  await expect(history).toContainText('Resolved shared allocations are locked');
  await expect(history.getByRole('link', { name: 'View locked shared bill' }))
    .toHaveAttribute('href', /\/shared-bills#transaction-/);

  await page.goto('/?month=2026-08');
  await expect(page.getByRole('heading', { name: 'August 2026' })).toBeVisible();
  await expect(page.getByText('Friends owe').locator('..')).toContainText('RM11.05');
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
