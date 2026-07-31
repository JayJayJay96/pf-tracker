'use server';

import { revalidatePath } from 'next/cache';

import {
  createFriend,
  createUnresolvedBill,
  deleteSharedBill,
  resolveConfiguredBill,
  type ConfiguredResolutionInput,
} from '../../../src/features/bills/actions';
import { createSharedBillRepository } from '../../../src/features/bills/supabase-repository';
import {
  failed,
  type FormResult,
  toFormResult,
} from '../../../src/features/forms/result';
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

/** Reports the outcome in the form instead of throwing into the error boundary. */
async function submit(
  run: () => Promise<void>,
  revalidate: () => void,
  fallbackMessage: string,
): Promise<FormResult> {
  const result = await toFormResult(run, fallbackMessage);
  if (result.status === 'success') {
    revalidate();
  }
  return result;
}

export async function createFriendAction(
  _previous: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const { repository, userId } = await context();
  return submit(
    () => createFriend(repository, userId, value(formData, 'name')),
    () => revalidatePath('/shared-bills'),
    'That friend could not be added.',
  );
}

export async function createBillAction(
  _previous: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const { repository, userId } = await context();
  return submit(
    () => createUnresolvedBill(repository, userId, {
      amount: value(formData, 'amount'),
      description: value(formData, 'description'),
      transactionDate: value(formData, 'transactionDate'),
      paymentMethod: value(formData, 'paymentMethod'),
    }),
    revalidateSharedBills,
    'That shared bill could not be saved.',
  );
}

export async function deleteBillAction(
  _previous: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const { repository, userId } = await context();
  return submit(
    () => deleteSharedBill(repository, userId, value(formData, 'billId')),
    revalidateSharedBills,
    'That shared bill could not be deleted.',
  );
}

export async function resolveBillAction(
  _previous: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const { repository, userId } = await context();
  let configuration: ConfiguredResolutionInput;
  try {
    configuration = JSON.parse(
      value(formData, 'configuration'),
    ) as ConfiguredResolutionInput;
  } catch {
    return failed('That allocation could not be read. Review the split and try again.');
  }
  return submit(
    () => resolveConfiguredBill(repository, userId, configuration),
    revalidateSharedBills,
    'That allocation could not be saved.',
  );
}
