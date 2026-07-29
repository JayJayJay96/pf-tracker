import { randomUUID } from 'node:crypto';

import { expect, type APIRequestContext, type Page } from '@playwright/test';

/**
 * Test sign-in.
 *
 * Every spec previously drove the magic-link flow: fill an email, press "Send
 * sign-in link", then poll Mailpit for the confirmation URL. The app moved to
 * email and password, so all six of those helpers stopped working. Rather than
 * six copies, tests now provision a confirmed user through the admin API and sign
 * in the way a person does.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

/** Hosts on which creating throwaway accounts and financial rows is acceptable. */
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

function assertLocalSupabase(): void {
  const { hostname } = new URL(SUPABASE_URL);
  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error(
      `Refusing to run end-to-end tests against ${hostname}. These tests create `
      + 'users and financial records, so they must run against a local Supabase '
      + '(npx supabase start). Point NEXT_PUBLIC_SUPABASE_URL at 127.0.0.1 first.',
    );
  }
  if (SERVICE_ROLE_KEY === '') {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required to provision end-to-end test users. '
      + 'Take the local value from `npx supabase status`.',
    );
  }
}

export type TestUser = { email: string; password: string };

/** Creates a pre-confirmed account, so no inbox round trip is needed. */
export async function createTestUser(
  request: APIRequestContext,
  prefix: string,
): Promise<TestUser> {
  assertLocalSupabase();
  const user: TestUser = {
    email: `${prefix}-${randomUUID()}@example.test`,
    password: `pw-${randomUUID()}`,
  };

  const response = await request.post(`${SUPABASE_URL}/auth/v1/admin/users`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    data: { ...user, email_confirm: true },
  });

  if (!response.ok()) {
    throw new Error(
      `Could not create a test user (${response.status()}): ${await response.text()}`,
    );
  }
  return user;
}

/** Signs a fresh owner in and leaves the browser on the dashboard. */
export async function signIn(
  page: Page,
  request: APIRequestContext,
  prefix: string,
): Promise<TestUser> {
  const user = await createTestUser(request, prefix);

  await page.goto('/auth/sign-in');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/$/);
  return user;
}
