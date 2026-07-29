import { expect, test, type Page } from '@playwright/test';

import { signIn } from './support/auth';

/**
 * The owner's own acceptance scenario, in their words: "added 10k worth of income
 * and 2k of commitments, dashboard should show spendable 8k".
 *
 * These drive the real screens rather than the calculation, which unit tests
 * already cover. What they prove is the wiring: that recurring items reach the
 * dashboard at all without anyone pressing Generate, and that spending moves the
 * figure.
 */

/** Locates a form by its submit button, so growing lists cannot make it ambiguous. */
function formWithButton(page: Page, name: string) {
  return page.locator('form', { has: page.getByRole('button', { name, exact: true }) });
}

async function addIncome(page: Page, input: { name: string; amount: string; day: string }) {
  const form = formWithButton(page, 'Add income');
  await form.getByLabel('Name').fill(input.name);
  await form.getByLabel('Amount').fill(input.amount);
  await form.getByLabel('Paid on day').fill(input.day);
  await form.getByLabel('Status').selectOption('confirmed');
  await form.getByRole('button', { name: 'Add income' }).click();
  await expect(page.getByText(input.name, { exact: true }).first()).toBeVisible();
}

async function addCommitment(page: Page, input: {
  name: string;
  amount: string;
  day: string;
  finalMonth?: string;
}) {
  const form = formWithButton(page, 'Add commitment');
  await form.getByLabel('Name').fill(input.name);
  await form.getByLabel('Amount').fill(input.amount);
  await form.getByLabel('Charged on day').fill(input.day);
  await form.getByLabel('Status').selectOption('active');
  if (input.finalMonth) {
    await form.getByLabel('Final payment month (optional)').fill(input.finalMonth);
  }
  await form.getByRole('button', { name: 'Add commitment' }).click();
  await expect(page.getByText(input.name, { exact: true }).first()).toBeVisible();
}

test('ten thousand of income less two thousand of commitments leaves eight', async ({
  page,
  request,
}) => {
  await signIn(page, request, 'owner-journey');

  await page.goto('/plan?month=2026-07');
  await addIncome(page, { name: 'Salary', amount: '10000', day: '25' });
  await addCommitment(page, { name: 'Car loan', amount: '2000', day: '5' });

  // No Generate press: opening the dashboard must be enough.
  await page.goto('/?month=2026-07');

  const hero = page.getByRole('region', { name: 'Remaining spendable' });
  await expect(hero).toContainText('RM8,000.00');
  await expect(hero).toContainText('of RM10,000.00 income');

  // The same figures again as tiles, so the total is not the only reading.
  await expect(page.getByText('Confirmed income').locator('..')).toContainText('RM10,000.00');
  await expect(page.getByText('Commitments').first().locator('..')).toContainText('RM2,000.00');
});

test('recording an expense reduces what is left to spend', async ({ page, request }) => {
  await signIn(page, request, 'owner-spend');

  await page.goto('/plan?month=2026-07');
  await addIncome(page, { name: 'Salary', amount: '10000', day: '25' });

  await page.goto('/expenses');
  const categoryForm = formWithButton(page, 'Add category');
  await categoryForm.getByLabel('New category name').fill('Food');
  await categoryForm.getByRole('button', { name: 'Add category' }).click();
  await expect(page.getByText('Food', { exact: true }).first()).toBeVisible();

  const expenseForm = formWithButton(page, 'Save expense');
  // Typed the way a person types it: no RM prefix, no padded decimals.
  await expenseForm.getByLabel('Amount').fill('12.5');
  await expenseForm.getByLabel('Description').fill('Nasi lemak');
  await expenseForm.getByLabel('Transaction date').fill('2026-07-15');
  await expenseForm.getByLabel('Category').selectOption({ label: 'Food' });
  await expenseForm.getByRole('button', { name: 'Save expense' }).click();
  await expect(page.getByText('Expense saved.')).toBeVisible();

  await page.goto('/?month=2026-07');
  await expect(page.getByRole('region', { name: 'Remaining spendable' }))
    .toContainText('RM9,987.50');
  await expect(page.getByText('Personal spending').locator('..')).toContainText('RM12.50');
});

test('an amount typed without the RM prefix is accepted and normalised', async ({
  page,
  request,
}) => {
  await signIn(page, request, 'owner-money');

  await page.goto('/expenses');
  const categoryForm = formWithButton(page, 'Add category');
  await categoryForm.getByLabel('New category name').fill('Transport');
  await categoryForm.getByRole('button', { name: 'Add category' }).click();

  const expenseForm = formWithButton(page, 'Save expense');
  const amount = expenseForm.getByLabel('Amount');

  await amount.fill('1250');
  await expenseForm.getByLabel('Description').click();
  // Normalised on blur, and never carrying the RM inside the value.
  await expect(amount).toHaveValue('1250.00');

  await amount.fill('twelve');
  await expenseForm.getByLabel('Description').click();
  await expect(expenseForm).toContainText('Enter a number, like 12.50');
  // The page survives a bad amount instead of being replaced by an error screen.
  await expect(expenseForm.getByRole('button', { name: 'Save expense' })).toBeVisible();
  await expect(amount).toHaveValue('twelve');
});

test('overspending is shown as over budget rather than in the same calm white', async ({
  page,
  request,
}) => {
  await signIn(page, request, 'owner-over');

  await page.goto('/plan?month=2026-07');
  await addIncome(page, { name: 'Salary', amount: '1000', day: '25' });
  await addCommitment(page, { name: 'Rent', amount: '2500', day: '1' });

  await page.goto('/?month=2026-07');
  const hero = page.getByRole('region', { name: 'Over budget' });
  await expect(hero).toContainText('-RM1,500.00');
  await expect(hero).toContainText('exceed confirmed income by RM1,500.00');
});

test('a commitment with a final month counts down its remaining payments', async ({
  page,
  request,
}) => {
  await signIn(page, request, 'owner-countdown');

  await page.goto('/plan?month=2026-07');
  await addCommitment(page, {
    name: 'Car loan',
    amount: '1000',
    day: '5',
    finalMonth: '2027-06',
  });

  // July 2026 through June 2027 inclusive.
  await expect(page.getByText('12 payments left')).toBeVisible();

  await page.goto('/plan?month=2026-10');
  await expect(page.getByText('9 payments left')).toBeVisible();

  await page.goto('/plan?month=2027-09');
  await expect(page.getByText('Final payment passed')).toBeVisible();
});

test('recurring items carry into a later month without being regenerated', async ({
  page,
  request,
}) => {
  await signIn(page, request, 'owner-carry');

  await page.goto('/plan?month=2026-07');
  await addIncome(page, { name: 'Salary', amount: '10000', day: '25' });

  // The month after setup previously read RM0.00 until the owner remembered to
  // press Generate.
  await page.goto('/?month=2026-08');
  await expect(page.getByRole('region', { name: 'Remaining spendable' }))
    .toContainText('RM10,000.00');
});
