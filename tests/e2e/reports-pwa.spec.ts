import { randomUUID } from 'node:crypto';

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const APP_ORIGIN = 'http://localhost:3000';
const SUPABASE_ORIGIN = 'http://127.0.0.1:54321';
const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';

test('restores an owner draft, reports by transaction date, and exports privately', async ({
  page,
  request,
}) => {
  await signIn(page, request);
  await page.goto('/expenses');

  const categoryForm = page.getByRole('heading', { name: 'Expense categories' })
    .locator('..').locator('form');
  await categoryForm.getByLabel('New category name').fill('Food');
  await categoryForm.getByRole('button', { name: 'Add category' }).click();

  let expenseForm = page.getByRole('heading', { name: 'Add personal expense' })
    .locator('..').locator('form');
  await expenseForm.getByLabel('Amount').fill('12.50');
  await expenseForm.getByLabel('Description').fill('Backdated draft lunch');
  await expenseForm.getByLabel('Transaction date').fill('2026-06-30');
  await expenseForm.getByLabel('Category').selectOption({ label: 'Food' });
  await page.reload();

  expenseForm = page.getByRole('heading', { name: 'Add personal expense' })
    .locator('..').locator('form');
  await expect(expenseForm.getByLabel('Amount')).toHaveValue('12.50');
  await expect(expenseForm.getByLabel('Description')).toHaveValue('Backdated draft lunch');
  await expenseForm.getByRole('button', { name: 'Save expense' }).click();
  await expect(page.getByText('Backdated draft lunch', { exact: true }).first()).toBeVisible();
  await page.reload();
  expenseForm = page.getByRole('heading', { name: 'Add personal expense' })
    .locator('..').locator('form');
  await expect(expenseForm.getByLabel('Amount')).toHaveValue('');

  await page.goto('/reports?range=month&month=2026-06');
  await expect(page.getByRole('heading', { name: 'June 2026 report' })).toBeVisible();
  const summary = page.getByRole('heading', { name: 'Financial summary' }).locator('..');
  await expect(summary.getByText('Personal spending').locator('..')).toContainText('RM12.50');
  await expect(summary.getByText('Total amount paid').locator('..')).toContainText('RM12.50');
  await expect(page.getByText('Backdated draft lunch')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Compared with May 2026' }))
    .toBeVisible();

  const exportResponse = await page.request.get('/api/export/transactions');
  expect(exportResponse.ok()).toBe(true);
  expect(exportResponse.headers()['cache-control']).toBe('private, no-store');
  expect(await exportResponse.text()).toContain('Backdated draft lunch');

  const registrations = await page.evaluate(async () => (
    'serviceWorker' in navigator
      ? (await navigator.serviceWorker.getRegistrations()).length
      : 0
  ));
  expect(registrations).toBe(0);
});

test('serves install metadata and icons without authentication', async ({ request }) => {
  const manifest = await request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBe(true);
  expect(manifest.headers()['x-content-type-options']).toBe('nosniff');
  expect(manifest.headers()['x-frame-options']).toBe('DENY');
  expect(await manifest.json()).toMatchObject({
    name: 'Personal Finance Tracker',
    display: 'standalone',
  });
  await expect((await request.get('/icon-192x192.png')).ok()).toBe(true);
  await expect((await request.get('/icon-512x512.png')).ok()).toBe(true);
});

async function signIn(page: Page, request: APIRequestContext) {
  const email = `reports-${Date.now()}-${randomUUID()}@example.test`;
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
