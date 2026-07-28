import { randomUUID } from 'node:crypto';

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const APP_ORIGIN = 'http://localhost:3000';
const SUPABASE_ORIGIN = 'http://127.0.0.1:54321';
const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';

test('creates monthly snapshots and preserves a historical spendable view', async ({
  page,
  request,
}) => {
  await signIn(page, request);
  await page.goto('/plan?month=2026-07');

  await addTemplate(page, {
    name: 'Salary',
    type: 'income',
    amount: 'RM5000.00',
    day: '25',
    status: 'confirmed',
  });
  await addTemplate(page, {
    name: 'Rent',
    type: 'commitment',
    amount: 'RM1200.00',
    day: '1',
  });
  await addTemplate(page, {
    name: 'Emergency fund',
    type: 'savings',
    amount: 'RM500.00',
    day: '15',
  });
  await addTemplate(page, {
    name: 'Index fund',
    type: 'investment',
    amount: 'RM300.00',
    day: '20',
  });

  await page.getByRole('button', { name: 'Generate July 2026' }).click();
  await expect(
    page.getByRole('heading', { name: 'Generated snapshots for July 2026' }),
  ).toBeVisible();
  await expect(page.getByText('Salary', { exact: true }).last()).toBeVisible();

  const snapshots = page.getByRole(
    'heading',
    { name: 'Generated snapshots for July 2026' },
  ).locator('..');
  const salarySnapshot = snapshots.locator('li').filter({
    has: page.getByText('Salary', { exact: true }),
  });
  await salarySnapshot.getByText('Update actual').click();
  await salarySnapshot.getByLabel('Actual amount').fill('RM5250.00');
  await salarySnapshot.getByRole('button', { name: 'Save entry actual' }).click();

  const rentSnapshot = snapshots.locator('li').filter({
    has: page.getByText('Rent', { exact: true }),
  });
  await rentSnapshot.getByText('Update actual').click();
  await rentSnapshot.getByLabel('Status').selectOption('paid');
  await rentSnapshot.getByLabel('Actual amount').fill('RM1150.00');
  await rentSnapshot.getByLabel('Paid date').fill('2026-07-02');
  await rentSnapshot.getByRole('button', { name: 'Save entry actual' }).click();
  await expect(rentSnapshot).toContainText('Actual RM1150.00');
  await expect(rentSnapshot).toContainText('paid 2026-07-02');

  await page.goto('/?month=2026-07');
  await expect(page.getByRole('heading', { name: 'July 2026' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Remaining spendable' }).locator('..'),
  ).toContainText('RM3300.00');
  await expect(page.getByText('planned active commitments before they are paid')).toBeVisible();

  await page.goto('/plan?month=2026-07');
  await page.getByText('Edit Salary', { exact: true }).click();
  const salaryEditor = page.getByText('Edit Salary', { exact: true }).locator('..');
  await salaryEditor.getByLabel('Amount').fill('RM5500.00');
  await salaryEditor.getByRole('button', { name: 'Save future template' }).click();

  await page.getByRole('textbox', { name: 'Month' }).fill('2026-08');
  await page.getByRole('button', { name: 'View month' }).click();
  await page.getByRole('button', { name: 'Generate August 2026' }).click();

  await page.goto('/?month=2026-08');
  await expect(
    page.getByRole('heading', { name: 'Remaining spendable' }).locator('..'),
  ).toContainText('RM3500.00');

  await page.getByLabel('Period').fill('2026-07');
  await page.getByRole('button', { name: 'View period' }).click();
  await expect(page.getByRole('heading', { name: 'July 2026' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Remaining spendable' }).locator('..'),
  ).toContainText('RM3300.00');
});

async function addTemplate(
  page: Page,
  input: {
    name: string;
    type: 'income' | 'commitment' | 'savings' | 'investment';
    amount: string;
    day: string;
    status?: 'confirmed' | 'active' | 'planned';
  },
) {
  const form = page.getByRole('heading', { name: 'Add template' }).locator('..').locator('form');
  await form.getByLabel('Name').fill(input.name);
  await form.getByLabel('Type').selectOption(input.type);
  await form.getByLabel('Amount').fill(input.amount);
  await form.getByLabel('Expected or due day').fill(input.day);
  if (input.status) {
    await form.getByLabel('Status').selectOption(input.status);
  }
  await form.getByLabel('Effective start').fill('2026-01-01');
  await form.getByRole('button', { name: 'Add template' }).click();
  await expect(page.getByText(input.name, { exact: true }).first()).toBeVisible();
}

async function signIn(page: Page, request: APIRequestContext) {
  const email = `monthly-plan-${Date.now()}-${randomUUID()}@example.test`;

  await page.goto('/auth/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send sign-in link' }).click();
  await expect(page.getByRole('status')).toHaveText('Check your email for a sign-in link.');

  const confirmationUrl = await waitForConfirmationUrl(request, email);
  await page.evaluate((url) => {
    window.location.assign(url);
  }, confirmationUrl);
  await expect(page).toHaveURL(`${APP_ORIGIN}/`);
}

async function waitForConfirmationUrl(request: APIRequestContext, email: string) {
  const deadline = Date.now() + 15_000;
  const search = new URL('/api/v1/search', MAILPIT_URL);
  search.searchParams.set('query', `to:${email}`);

  while (Date.now() < deadline) {
    const searchResponse = await request.get(search.toString());
    if (searchResponse.ok()) {
      const mailbox = (await searchResponse.json()) as MailpitSearchResponse;
      const messageId = mailbox.messages[0]?.ID;

      if (messageId) {
        const messageResponse = await request.get(
          new URL(`/api/v1/message/${encodeURIComponent(messageId)}`, MAILPIT_URL).toString(),
        );
        if (messageResponse.ok()) {
          const message = (await messageResponse.json()) as MailpitMessage;
          const confirmationUrl = findConfirmationUrl(message.HTML, message.Text);
          if (confirmationUrl) {
            return confirmationUrl;
          }
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error('Timed out waiting for the local Supabase auth email.');
}

function findConfirmationUrl(html: string, text: string) {
  const candidates = [
    ...html.matchAll(/href=["']([^"']+)["']/gi),
    ...text.matchAll(/https?:\/\/[^\s<>"']+/gi),
  ];

  for (const candidate of candidates) {
    const rawUrl = (candidate[1] ?? candidate[0]).replaceAll('&amp;', '&');
    try {
      const url = new URL(rawUrl);
      if (
        (url.origin === SUPABASE_ORIGIN && url.pathname === '/auth/v1/verify')
        || (url.origin === APP_ORIGIN && url.pathname === '/auth/confirm')
      ) {
        return url.toString();
      }
    } catch {
      // Ignore non-URL href values in the captured email.
    }
  }

  return null;
}

type MailpitSearchResponse = {
  messages: Array<{ ID: string }>;
};

type MailpitMessage = {
  HTML: string;
  Text: string;
};
