import { expect, test, type Page } from '@playwright/test';

import { signIn } from './support/auth';

/**
 * Recording what actually happened against a generated month, and confirming a
 * past month keeps its own figures once a later month diverges.
 *
 * The everyday setup-to-dashboard path lives in owner-journey.spec.ts; this spec
 * covers the parts unique to generated entries.
 */

function formWithButton(page: Page, name: string) {
  return page.locator('form', { has: page.getByRole('button', { name, exact: true }) });
}

async function addRecurring(page: Page, input: {
  section: 'Add income' | 'Add commitment' | 'Add allocation';
  name: string;
  amount: string;
  day: string;
  dayLabel: 'Paid on day' | 'Charged on day' | 'Transferred on day';
  status?: string;
  type?: 'savings' | 'investment';
}) {
  const form = formWithButton(page, input.section);
  await form.getByLabel('Name').fill(input.name);
  if (input.type) {
    await form.getByLabel('Type').selectOption(input.type);
  }
  await form.getByLabel('Amount').fill(input.amount);
  await form.getByLabel(input.dayLabel).fill(input.day);
  if (input.status) {
    await form.getByLabel('Status').selectOption(input.status);
  }
  await form.getByRole('button', { name: input.section }).click();
  await expect(page.getByText(input.name, { exact: true }).first()).toBeVisible();
}

function entryRow(page: Page, name: string) {
  return page
    .getByRole('region', { name: /^Generated monthly entries for/ })
    .locator('li')
    .filter({ has: page.getByText(name, { exact: true }) });
}

test('records actuals against generated entries and preserves past months', async ({
  page,
  request,
}) => {
  await signIn(page, request, 'monthly-plan');
  await page.goto('/plan?month=2026-07');

  await addRecurring(page, {
    section: 'Add income',
    name: 'Salary',
    amount: '5000',
    day: '25',
    dayLabel: 'Paid on day',
    status: 'confirmed',
  });
  await addRecurring(page, {
    section: 'Add commitment',
    name: 'Rent',
    amount: '1200',
    day: '1',
    dayLabel: 'Charged on day',
    status: 'active',
  });
  await addRecurring(page, {
    section: 'Add allocation',
    name: 'Emergency fund',
    amount: '500',
    day: '15',
    dayLabel: 'Transferred on day',
    type: 'savings',
  });
  await addRecurring(page, {
    section: 'Add allocation',
    name: 'Index fund',
    amount: '300',
    day: '20',
    dayLabel: 'Transferred on day',
    type: 'investment',
  });

  // Entries are generated on read, so the section is already populated.
  await page.reload();
  await expect(entryRow(page, 'Salary')).toBeVisible();

  const salary = entryRow(page, 'Salary');
  await salary.getByText('Update actual').click();
  await salary.getByLabel('Actual amount').fill('5250');
  await salary.getByRole('button', { name: 'Save entry actual' }).click();
  await expect(entryRow(page, 'Salary')).toContainText('Actual RM5,250.00');

  const rent = entryRow(page, 'Rent');
  await rent.getByText('Update actual').click();
  await rent.getByLabel('Status').selectOption('paid');
  await rent.getByLabel('Actual amount').fill('1150');
  await rent.getByLabel('Paid date').fill('2026-07-02');
  await rent.getByRole('button', { name: 'Save entry actual' }).click();
  await expect(entryRow(page, 'Rent')).toContainText('Actual RM1,150.00');
  // Dates read the way a person writes them now; the stored form stays in the
  // element's datetime attribute.
  await expect(entryRow(page, 'Rent')).toContainText('paid 2 Jul 2026');

  // 5250 actual income less 1150 rent, 500 savings and 300 investment.
  await page.goto('/?month=2026-07');
  await expect(page.getByRole('heading', { name: 'July 2026' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Remaining spendable' }))
    .toContainText('RM3,300.00');

  // Raising the recurring amount must not rewrite a month already recorded.
  await page.goto('/plan?month=2026-07');
  await page.getByText('Edit Salary', { exact: true }).click();
  const editor = page.getByText('Edit Salary', { exact: true }).locator('..');
  await editor.getByLabel('Amount').fill('5500');
  await editor.getByRole('button', { name: 'Save recurring item' }).click();

  await page.goto('/?month=2026-08');
  await expect(page.getByRole('region', { name: 'Remaining spendable' }))
    .toContainText('RM3,500.00');

  await page.goto('/?month=2026-07');
  await expect(page.getByRole('region', { name: 'Remaining spendable' }))
    .toContainText('RM3,300.00');
});

test('steps between months from the dashboard', async ({ page, request }) => {
  await signIn(page, request, 'monthly-plan-stepper');

  await page.goto('/?month=2026-07');
  await expect(page.getByRole('heading', { name: 'July 2026' })).toBeVisible();

  await page.getByRole('link', { name: 'Next month' }).click();
  await expect(page.getByRole('heading', { name: 'August 2026' })).toBeVisible();

  await page.getByRole('link', { name: 'Previous month' }).click();
  await expect(page.getByRole('heading', { name: 'July 2026' })).toBeVisible();
});
