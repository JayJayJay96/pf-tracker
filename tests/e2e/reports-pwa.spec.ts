import { expect, test } from '@playwright/test';

import { signIn } from './support/auth';


test('restores an owner draft, reports by transaction date, and exports privately', async ({
  page,
  request,
}) => {
  await signIn(page, request, 'reports-pwa');
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
