'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import {
  createPaymentRequest,
  settlePaymentRequest,
} from '../../../src/features/friends/actions';
import { createFriendRepository } from '../../../src/features/friends/supabase-repository';
import { requireCurrentUserId } from '../../../src/lib/auth/current-user';
import { createClient } from '../../../src/lib/supabase/server';

function value(formData: FormData, name: string): string {
  const selected = formData.get(name);
  return typeof selected === 'string' ? selected : '';
}

async function context() {
  const client = await createClient();
  const userId = await requireCurrentUserId(() => client.auth.getClaims());
  return { userId, repository: createFriendRepository(client) };
}

export async function createPaymentRequestAction(formData: FormData): Promise<void> {
  const { repository, userId } = await context();
  const friendId = value(formData, 'friendId');
  const requestId = await createPaymentRequest(repository, userId, {
    friendId,
    portionIds: formData.getAll('portionIds').filter(
      (portionId): portionId is string => typeof portionId === 'string',
    ),
    requestDate: value(formData, 'requestDate'),
    note: value(formData, 'note'),
  });
  revalidatePath('/friends');
  revalidatePath(`/friends/${friendId}`);
  redirect(`/friends/${friendId}/requests/${requestId}`);
}

export async function transitionPaymentRequestAction(
  formData: FormData,
): Promise<void> {
  const { repository, userId } = await context();
  const requestId = value(formData, 'requestId');
  const status = value(formData, 'status');
  if (!['paid', 'cancelled', 'forgiven'].includes(status)) {
    throw new Error('Invalid payment request');
  }
  await settlePaymentRequest(repository, userId, {
    requestId,
    status: status as 'paid' | 'cancelled' | 'forgiven',
    paidAmount: value(formData, 'paidAmount'),
    occurredOn: value(formData, 'occurredOn'),
  });
  revalidatePath('/friends');
  revalidatePath('/friends/[friendId]', 'page');
  revalidatePath('/friends/[friendId]/requests/[requestId]', 'page');
}
