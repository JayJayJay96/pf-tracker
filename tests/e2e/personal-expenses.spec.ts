import { expect, test } from '@playwright/test';

import { signIn } from './support/auth';


test('records and reports a searchable backdated personal expense', async ({
  page,
  request,
}) => {
  await signIn(page, request, 'personal-expense');
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
