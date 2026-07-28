'use server';

import { revalidatePath } from 'next/cache';

import {
  createFriend,
  createUnresolvedBill,
  resolveConfiguredBill,
  type ConfiguredResolutionInput,
} from '../../../src/features/bills/actions';
import { createSharedBillRepository } from '../../../src/features/bills/supabase-repository';
import { requireCurrentUserId } from '../../../src/lib/auth/current-user';
import { createClient } from '../../../src/lib/supabase/server';

function value(formData: FormData, name: string): string {
  const selected = formData.get(name);
  return typeof selected === 'string' ? selected : '';
}

async function context() {
  const client = await createClient();
  const userId = await requireCurrentUserId(() => client.auth.getClaims());
  return { userId, repository: createSharedBillRepository(client) };
}

function revalidateSharedBills(): void {
  revalidatePath('/shared-bills');
  revalidatePath('/');
}

export async function createFriendAction(formData: FormData): Promise<void> {
  const { repository, userId } = await context();
  await createFriend(repository, userId, value(formData, 'name'));
  revalidatePath('/shared-bills');
}

export async function createBillAction(formData: FormData): Promise<void> {
  const { repository, userId } = await context();
  await createUnresolvedBill(repository, userId, {
    amount: value(formData, 'amount'),
    description: value(formData, 'description'),
    transactionDate: value(formData, 'transactionDate'),
    paymentMethod: value(formData, 'paymentMethod'),
  });
  revalidateSharedBills();
}

export async function resolveBillAction(formData: FormData): Promise<void> {
  const { repository, userId } = await context();
  let configuration: ConfiguredResolutionInput;
  try {
    configuration = JSON.parse(
      value(formData, 'configuration'),
    ) as ConfiguredResolutionInput;
  } catch {
    throw new Error('Invalid shared bill resolution');
  }
  await resolveConfiguredBill(repository, userId, configuration);
  revalidateSharedBills();
}
