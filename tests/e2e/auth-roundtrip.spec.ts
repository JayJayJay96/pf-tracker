import { expect, test } from '@playwright/test';

import { createTestUser, signIn } from './support/auth';

/**
 * Covers the sign-in the app actually ships.
 *
 * This spec previously exercised a passwordless round trip: request a link, poll
 * Mailpit, follow the confirmation URL. That flow was replaced by email and
 * password, so the test was asserting against a feature that no longer exists.
 */

test('signs an owner in with a password and sets a session cookie', async ({
  context,
  page,
  request,
}) => {
  await signIn(page, request, 'auth-roundtrip');

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  const cookies = await context.cookies();
  expect(
    cookies.some((cookie) => (
      cookie.domain === 'localhost'
      && /^sb-.+-auth-token(?:\.\d+)?$/.test(cookie.name)
      && cookie.value.length > 0
    )),
  ).toBe(true);

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/auth\/sign-in$/);
});

test('rejects a wrong password without revealing whether the account exists', async ({
  page,
  request,
}) => {
  const user = await createTestUser(request, 'auth-wrong-password');

  await page.goto('/auth/sign-in');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill('definitely-not-the-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect.');
  await expect(page).toHaveURL(/\/auth\/sign-in/);
});

test('sends an unauthenticated visitor to sign-in', async ({ page }) => {
  for (const route of ['/', '/expenses', '/plan', '/transactions']) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  }
});

test('keeps the session across a reload', async ({ page, request }) => {
  await signIn(page, request, 'auth-persist');

  await page.goto('/expenses');
  await page.reload();

  // Still inside the app rather than bounced back to sign-in.
  await expect(page).toHaveURL(/\/expenses$/);
});
