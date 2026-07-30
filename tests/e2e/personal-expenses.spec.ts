import { expect, test } from '@playwright/test';

import { signIn } from './support/auth';


test('records and reports a searchable backdated personal expense', async ({
  page,
  request,
}) => {
  await signIn(page, request, 'personal-expense');
  await page.goto('/expenses');

  const categoryForm = page.getByRole('region', { name: 'Expense categories' })
    .locator('form');
  await categoryForm.getByLabel('New category name').fill('Food');
  await categoryForm.getByRole('button', { name: 'Add category' }).click();

  const expenseForm = page.getByRole('region', { name: 'Add personal expense' })
    .locator('form');
  await expenseForm.getByLabel('Amount').fill('12.50');
  await expenseForm.getByLabel('Description').fill('Backdated lunch');
  await expenseForm.getByText('Add merchant or notes').click();
  await expenseForm.getByLabel('Merchant').fill('Kopitiam');
  await expenseForm.getByLabel('Transaction date').fill('2026-06-30');
  await expenseForm.getByLabel('Category').selectOption({ label: 'Food' });
  await expenseForm.getByLabel('Payment method').selectOption('tng');
  await expenseForm.getByLabel('Notes').fill('Forgotten yesterday');
  await expenseForm.getByRole('button', { name: 'Save expense' }).click();

  const history = page.getByRole('region', { name: 'Transaction history' });
  await expect(history.getByText('Backdated lunch', { exact: true }).first()).toBeVisible();
  await expect(history).toContainText('Recorded');

  await page.getByLabel('Search description or merchant').fill('Kopitiam');
  await page.getByRole('button', { name: 'Filter history' }).click();
  await expect(history.getByText('Backdated lunch', { exact: true }).first()).toBeVisible();

  await page.goto('/?month=2026-06');
  await expect(page.getByRole('heading', { name: 'June 2026' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Month totals' })).toContainText('RM12.50');
  await expect(page.getByRole('region', { name: 'Over budget' }))
    .toContainText('-RM12.50');

  // The month picker is now a stepper, so months are addressed by URL.
  await page.goto('/?month=2026-07');
  await expect(page.getByRole('region', { name: 'Month totals' })).toContainText('RM0.00');
});
