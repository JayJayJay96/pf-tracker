import { expect, test, type Page } from '@playwright/test';

import { signIn } from './support/auth';


test('snapshots two bills, leaves a later bill unrequested, and settles without income', async ({
  page,
  request,
}) => {
  await signIn(page, request, 'payment-request');
  await page.goto('/shared-bills');

  const friendForm = page.getByRole('region', { name: 'Friends' }).locator('form');
  await friendForm.getByLabel('Friend name').fill('Alex');
  await friendForm.getByRole('button', { name: 'Add friend' }).click();

  await createAndResolveBill(page, 'Dinner', '20.00', '2026-07-10');
  await createAndResolveBill(page, 'Movie', '10.00', '2026-07-14');

  await page.goto('/friends');
  await expect(page.getByRole('listitem').filter({ hasText: 'Alex' }))
    .toContainText('RM15.00 outstanding');
  await page.getByRole('link', { name: 'Alex' }).click();

  const requestForm = page
    .getByRole('region', { name: 'Create lump-sum request' })
    .locator('form');
  await requestForm.getByLabel(/Dinner/).check();
  await requestForm.getByLabel(/Movie/).check();
  await requestForm.getByLabel('Request date').fill('2026-07-18');
  await requestForm.getByLabel('Note').fill('July expenses');
  await requestForm.getByRole('button', {
    name: 'Create payment request',
  }).click();

  await expect(page).toHaveURL(/\/friends\/[^/]+\/requests\/[^/]+$/);
  const requestUrl = page.url();
  const summary = page.getByLabel('Copyable payment summary');
  await expect(summary).toHaveValue(/10 Jul 2026 — Dinner: RM10.00/);
  await expect(summary).toHaveValue(/14 Jul 2026 — Movie: RM5.00/);
  await expect(summary).toHaveValue(/Total: RM15.00/);

  await page.goto('/shared-bills');
  await createAndResolveBill(page, 'Coffee', '8.00', '2026-07-16');

  await page.goto(requestUrl);
  await expect(summary).toHaveValue(/Total: RM15.00/);
  await expect(summary).not.toHaveValue(/Coffee/);

  await page.goto('/friends');
  await expect(page.getByRole('listitem').filter({ hasText: 'Alex' }))
    .toContainText('RM19.00 outstanding');
  await page.goto(requestUrl);

  const paidForm = page.getByRole('button', { name: 'Mark paid in full' })
    .locator('..');
  await paidForm.getByLabel('Paid date').fill('2026-07-22');
  await paidForm.getByLabel(/Confirm full payment/).check();
  await paidForm.getByRole('button', { name: 'Mark paid in full' }).click();
  await expect(page.getByText(/— paid/)).toBeVisible();

  await page.goto('/friends');
  const alex = page.getByRole('listitem').filter({ hasText: 'Alex' });
  await expect(alex).toContainText('RM4.00 outstanding');
  await expect(alex).toContainText('RM15.00 paid');

  await page.goto('/?month=2026-07');
  const totals = page.getByRole('region', { name: 'Month totals' });
  await expect(totals).toContainText('RM0.00');
  await expect(totals).toContainText('RM19.00');
  await expect(totals).toContainText('RM4.00');
});

async function createAndResolveBill(
  page: Page,
  description: string,
  amount: string,
  transactionDate: string,
) {
  if (!page.url().endsWith('/shared-bills')) await page.goto('/shared-bills');
  const billForm = page.getByRole('region', { name: 'Record shared bill' }).locator('form');
  await billForm.getByLabel('Amount').fill(amount);
  await billForm.getByLabel('Description').fill(description);
  await billForm.getByLabel('Transaction date').fill(transactionDate);
  await billForm.getByLabel('Payment method').selectOption('tng');
  await billForm.getByRole('button', { name: 'Save unresolved bill' }).click();

  const bill = page.getByRole('listitem').filter({ hasText: description });
  await bill.getByLabel('Include Alex').check();
  await bill.getByLabel('Item 1 description').fill(description);
  await bill.getByLabel('Item 1 assign Alex').check();
  await bill.getByLabel('Confirm reviewed allocation').check();
  await bill.getByRole('button', { name: 'Resolve shared bill' }).click();
  await expect(bill).toContainText('Resolved');
}
