import { notFound, redirect } from 'next/navigation';

import { FriendLedgerView } from '../../../../src/features/friends/friends-view';
import { getFriendLedger } from '../../../../src/features/friends/queries';
import { createFriendRepository } from '../../../../src/features/friends/supabase-repository';
import { getCurrentUserId } from '../../../../src/lib/auth/current-user';
import { createClient } from '../../../../src/lib/supabase/server';
import { createPaymentRequestAction } from '../actions';

type FriendPageProps = {
  params: Promise<{ friendId: string }>;
};

function todayInMalaysia(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export default async function FriendPage({ params }: FriendPageProps) {
  const { friendId } = await params;
  const client = await createClient();
  const userId = await getCurrentUserId(() => client.auth.getClaims());
  if (!userId) redirect('/auth/sign-in');
  let data;
  try {
    data = await getFriendLedger(
      createFriendRepository(client),
      userId,
      friendId,
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Friend not found') notFound();
    throw error;
  }
  return (
    <FriendLedgerView
      {...data}
      defaultRequestDate={todayInMalaysia()}
      createRequestAction={createPaymentRequestAction}
    />
  );
}
