'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import {
  createPaymentRequest,
  settlePaymentRequest,
} from '../../../src/features/friends/actions';
import { createFriendRepository } from '../../../src/features/friends/supabase-repository';
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
  return { userId, repository: createFriendRepository(client) };
}

export async function createPaymentRequestAction(
  _previous: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const { repository, userId } = await context();
  const friendId = value(formData, 'friendId');
  // toFormResult rethrows the redirect signal, so the navigation still happens.
  return toFormResult(async () => {
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
  }, 'That payment request could not be created.');
}

export async function transitionPaymentRequestAction(
  _previous: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const { repository, userId } = await context();
  const requestId = value(formData, 'requestId');
  const status = value(formData, 'status');
  if (!['paid', 'cancelled', 'forgiven'].includes(status)) {
    return failed('Choose whether this request was paid, cancelled, or forgiven.');
  }
  const result = await toFormResult(() => settlePaymentRequest(repository, userId, {
    requestId,
    status: status as 'paid' | 'cancelled' | 'forgiven',
    paidAmount: value(formData, 'paidAmount'),
    occurredOn: value(formData, 'occurredOn'),
  }), 'That payment request could not be updated.');

  if (result.status === 'success') {
    revalidatePath('/friends');
    revalidatePath('/friends/[friendId]', 'page');
    revalidatePath('/friends/[friendId]/requests/[requestId]', 'page');
  }
  return result;
}
