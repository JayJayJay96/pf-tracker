import { randomUUID } from 'node:crypto';

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const APP_ORIGIN = 'http://localhost:3000';
const SUPABASE_ORIGIN = 'http://127.0.0.1:54321';
const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';

test('records and reports a searchable backdated personal expense', async ({
  page,
  request,
}) => {
  await signIn(page, request);
  await page.goto('/expenses');

  const categoryForm = page.getByRole('heading', { name: 'Expense categories' })
    .locator('..')
    .locator('form');
  await categoryForm.getByLabel('New category name').fill('Food');
  await categoryForm.getByRole('button', { name: 'Add category' }).click();

  const expenseForm = page.getByRole('heading', { name: 'Add personal expense' })
    .locator('..')
    .locator('form');
  await expenseForm.getByLabel('Amount').fill('12.50');
  await expenseForm.getByLabel('Description').fill('Backdated lunch');
  await expenseForm.getByLabel('Merchant').fill('Kopitiam');
  await expenseForm.getByLabel('Transaction date').fill('2026-06-30');
  await expenseForm.getByLabel('Category').selectOption({ label: 'Food' });
  await expenseForm.getByLabel('Payment method').selectOption('tng');
  await expenseForm.getByLabel('Notes').fill('Forgotten yesterday');
  await expenseForm.getByRole('button', { name: 'Save expense' }).click();

  const history = page.getByRole('heading', { name: 'Transaction history' }).locator('..');
  await expect(history.getByText('Backdated lunch', { exact: true }).first()).toBeVisible();
  await expect(history).toContainText('Recorded');

  await page.getByLabel('Search description or merchant').fill('Kopitiam');
  await page.getByRole('button', { name: 'Filter history' }).click();
  await expect(history.getByText('Backdated lunch', { exact: true }).first()).toBeVisible();

  await page.goto('/?month=2026-06');
  await expect(page.getByRole('heading', { name: 'June 2026' })).toBeVisible();
  await expect(page.getByText('Personal spending').locator('..')).toContainText('RM12.50');
  await expect(
    page.getByRole('heading', { name: 'Remaining spendable' }).locator('..'),
  ).toContainText('-RM12.50');

  await page.getByLabel('Period').fill('2026-07');
  await page.getByRole('button', { name: 'View period' }).click();
  await expect(page.getByText('Personal spending').locator('..')).toContainText('RM0.00');
});

async function signIn(page: Page, request: APIRequestContext) {
  const email = `personal-expense-${Date.now()}-${randomUUID()}@example.test`;

  await page.goto('/auth/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send sign-in link' }).click();
  await expect(page.getByRole('status')).toHaveText('Check your email for a sign-in link.');

  const confirmationUrl = await waitForConfirmationUrl(request, email);
  await page.evaluate((url) => {
    window.location.assign(url);
  }, confirmationUrl);
  await expect(page).toHaveURL(`${APP_ORIGIN}/`);
}

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
          if (confirmationUrl) return confirmationUrl;
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
        (url.origin === SUPABASE_ORIGIN && url.pathname === '/auth/v1/verify')
        || (url.origin === APP_ORIGIN && url.pathname === '/auth/confirm')
      ) return url.toString();
    } catch {
      // Ignore non-URL href values.
    }
  }
  return null;
}

type MailpitSearchResponse = { messages: Array<{ ID: string }> };
type MailpitMessage = { HTML: string; Text: string };
