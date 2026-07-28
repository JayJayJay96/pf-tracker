import { notFound, redirect } from 'next/navigation';

import { PaymentRequestView } from '../../../../../../src/features/friends/friends-view';
import { getFriendLedger } from '../../../../../../src/features/friends/queries';
import { createFriendRepository } from '../../../../../../src/features/friends/supabase-repository';
import { getCurrentUserId } from '../../../../../../src/lib/auth/current-user';
import { createClient } from '../../../../../../src/lib/supabase/server';
import { transitionPaymentRequestAction } from '../../../actions';

type RequestPageProps = {
  params: Promise<{ friendId: string; requestId: string }>;
};

function todayInMalaysia(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export default async function RequestPage({ params }: RequestPageProps) {
  const { friendId, requestId } = await params;
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
  const request = data.requests.find(({ id }) => id === requestId);
  if (!request) notFound();
  return (
    <PaymentRequestView
      friend={data.friend}
      request={request}
      defaultOccurredOn={todayInMalaysia()}
      transitionAction={transitionPaymentRequestAction}
    />
  );
}
