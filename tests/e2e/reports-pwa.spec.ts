import { expect, test } from '@playwright/test';

import { signIn } from './support/auth';


test('restores an owner draft, reports by transaction date, and exports privately', async ({
  page,
  request,
}) => {
  await signIn(page, request, 'reports-pwa');
  await page.goto('/expenses');

  const categoryForm = page.getByRole('region', { name: 'Expense categories' }).locator('form');
  await categoryForm.getByLabel('New category name').fill('Food');
  await categoryForm.getByRole('button', { name: 'Add category' }).click();

  let expenseForm = page.getByRole('region', { name: 'Add personal expense' }).locator('form');
  await expenseForm.getByLabel('Amount').fill('12.50');
  await expenseForm.getByLabel('Description').fill('Backdated draft lunch');
  await expenseForm.getByLabel('Transaction date').fill('2026-06-30');
  await expenseForm.getByLabel('Category').selectOption({ label: 'Food' });
  await page.reload();

  expenseForm = page.getByRole('region', { name: 'Add personal expense' }).locator('form');
  await expect(expenseForm.getByLabel('Amount')).toHaveValue('12.50');
  await expect(expenseForm.getByLabel('Description')).toHaveValue('Backdated draft lunch');
  await expenseForm.getByRole('button', { name: 'Save expense' }).click();
  await expect(page.getByText('Backdated draft lunch', { exact: true }).first()).toBeVisible();
  await page.reload();
  expenseForm = page.getByRole('region', { name: 'Add personal expense' }).locator('form');
  await expect(expenseForm.getByLabel('Amount')).toHaveValue('');

  await page.goto('/reports?range=month&month=2026-06');
  await expect(page.getByRole('heading', { name: 'June 2026 report' })).toBeVisible();
  const summary = page.getByRole('region', { name: 'Financial summary' });
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

test('asks only for the dates the chosen range actually uses', async ({ page, request }) => {
  await signIn(page, request, 'report-range');
  await page.goto('/reports?range=month&month=2026-07');

  const range = page.getByRole('region', { name: 'Report range' });
  /*
   * Exact labels throughout, because the Range select's accessible name is
   * currently "RangeSpecific monthCustom date range..." - Field nests the control
   * inside its label, so a select's name absorbs every option. That is a real
   * defect, tracked separately; matching exactly keeps this test about the range
   * picker instead of quietly depending on the bug.
   */
  const field = (label: string) => range.getByLabel(label, { exact: true });
  /*
   * By role, not by label: the Range select cannot be found by its visible label
   * at all, because its accessible name is the label plus every option. It is the
   * only select in this form, so the role is unambiguous - and when the defect is
   * fixed, `field('Range')` will work here.
   */
  const rangeSelect = range.getByRole('combobox');

  // A month needs a month. From, To and Year used to sit here too, with nothing
  // to say that the server ignores them.
  await expect(field('Month')).toBeVisible();
  await expect(field('From')).toHaveCount(0);
  await expect(field('To')).toHaveCount(0);
  await expect(field('Year')).toHaveCount(0);

  await rangeSelect.selectOption('custom');
  await expect(field('From')).toBeVisible();
  await expect(field('To')).toBeVisible();
  await expect(field('Month')).toHaveCount(0);

  await rangeSelect.selectOption('year');
  await expect(field('Year')).toBeVisible();
  await expect(field('From')).toHaveCount(0);

  // Year to date needs nothing, so it explains itself instead of showing gaps.
  await rangeSelect.selectOption('ytd');
  await expect(field('Year')).toHaveCount(0);
  await expect(range).toContainText('until today');

  // And the chosen range still reaches the server.
  await rangeSelect.selectOption('month');
  await field('Month').fill('2026-06');
  await range.getByRole('button', { name: 'View report' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('June 2026');
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
