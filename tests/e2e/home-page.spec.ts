import { expect, test } from '@playwright/test';

test('shows the personal finance tracker home page', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Personal Finance Tracker' })).toBeVisible();
});
