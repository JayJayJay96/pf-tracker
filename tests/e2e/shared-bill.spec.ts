import { expect, test } from '@playwright/test';

import { signIn } from './support/auth';


test('deletes a shared bill recorded by mistake', async ({ page, request }) => {
  await signIn(page, request, 'bill-delete');
  await page.goto('/shared-bills');

  const billForm = page.getByRole('region', { name: 'Record shared bill' }).locator('form');
  await billForm.getByLabel('Amount').fill('25.00');
  await billForm.getByLabel('Description').fill('Wrong bill');
  await billForm.getByLabel('Transaction date').fill('2026-07-09');
  await billForm.getByRole('button', { name: 'Save unresolved bill' }).click();
  await expect(page.getByText('Shared bill saved.')).toBeVisible();

  const bill = page.getByRole('listitem').filter({ hasText: 'Wrong bill' });
  await expect(bill).toBeVisible();

  // Two steps on purpose: the first press only arms the confirmation.
  await bill.getByRole('button', { name: 'Delete Wrong bill' }).click();
  await bill.getByRole('button', { name: 'Yes, delete permanently' }).click();

  await expect(page.getByRole('listitem').filter({ hasText: 'Wrong bill' })).toHaveCount(0);

  // The bill was a cash outflow, so removing it has to release the money too.
  await page.goto('/?month=2026-07');
  await expect(page.getByRole('region', { name: 'Month totals' })).toContainText('RM0.00');
});

test('moves a shared bill from unresolved cash outflow to exact portions', async ({
  page,
  request,
}) => {
  await signIn(page, request, 'shared-bill');
  await page.goto('/expenses');
  const categoryForm = page.getByRole('region', { name: 'Expense categories' }).locator('form');
  await categoryForm.getByLabel('New category name').fill('Food');
  await categoryForm.getByRole('button', { name: 'Add category' }).click();
  const expenseForm = page.getByRole('region', { name: 'Add personal expense' }).locator('form');
  await expenseForm.getByLabel('Amount').fill('4.25');
  await expenseForm.getByLabel('Description').fill('Personal snack');
  await expenseForm.getByText('Add merchant or notes').click();
  await expenseForm.getByLabel('Merchant').fill('Corner Market');
  await expenseForm.getByLabel('Transaction date').fill('2026-07-04');
  await expenseForm.getByLabel('Category').selectOption({ label: 'Food' });
  await expenseForm.getByLabel('Payment method').selectOption('cash');
  await expenseForm.getByRole('button', { name: 'Save expense' }).click();

  await page.goto('/shared-bills');

  const friendForm = page.getByRole('region', { name: 'Friends' }).locator('form');
  await friendForm.getByLabel('Friend name').fill('Alex');
  await friendForm.getByRole('button', { name: 'Add friend' }).click();
  await friendForm.getByLabel('Friend name').fill('Bee');
  await friendForm.getByRole('button', { name: 'Add friend' }).click();

  const billForm = page.getByRole('region', { name: 'Record shared bill' }).locator('form');
  await billForm.getByLabel('Amount').fill('18.00');
  await billForm.getByLabel('Description').fill('Shared lunch');
  await billForm.getByLabel('Transaction date').fill('2026-07-03');
  await billForm.getByLabel('Payment method').selectOption('tng');
  await billForm.getByRole('button', { name: 'Save unresolved bill' }).click();

  const bill = page.getByRole('listitem').filter({ hasText: 'Shared lunch' });
  await expect(bill).toContainText('Unresolved');
  await expect(bill).toContainText('RM18.00 cash outflow');

  await page.goto('/?month=2026-07');
  // Renamed from "Total cash outflow" when the dashboard was redesigned.
  await expect(page.getByText('Total cash out').locator('..')).toContainText('RM22.25');
  await expect(page.getByRole('region', { name: 'Month totals' })).toContainText('RM4.25');
  // The status banner became a link in the dashboard's "Needs attention" row.
  await expect(page.getByRole('link', { name: '1 shared bill to resolve' })).toBeVisible();

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

  const review = unresolvedBill.getByRole('region', { name: 'Allocation review' });
  await expect(review).toContainText('You: RM6.95');
  await expect(review).toContainText('Alex: RM7.24');
  await expect(review).toContainText('Bee: RM3.81');
  await unresolvedBill.getByLabel('Confirm reviewed allocation').check();
  await unresolvedBill.getByRole('button', { name: 'Resolve shared bill' }).click();

  const resolvedBill = page.getByRole('listitem').filter({ hasText: 'Shared lunch' });
  await expect(resolvedBill).toContainText('Resolved');
  await expect(resolvedBill).toContainText('your portion RM6.95');
  await expect(resolvedBill).toContainText('Alex owes RM7.24');
  await expect(resolvedBill).toContainText('Bee owes RM3.81');

  await page.goto('/?month=2026-07');
  await expect(page.getByText('Total cash out').locator('..')).toContainText('RM22.25');
  const totals = page.getByRole('region', { name: 'Month totals' });
  await expect(totals).toContainText('RM11.20');
  await expect(totals).toContainText('RM11.05');
  // Nothing left to resolve, so the attention row disappears entirely.
  await expect(page.getByRole('link', { name: /to resolve$/ })).toHaveCount(0);

  await page.goto('/transactions');
  const history = page.getByRole('region', { name: 'Unified history' });
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
