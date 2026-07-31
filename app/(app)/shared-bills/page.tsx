import { redirect } from 'next/navigation';

import { getSharedBills } from '../../../src/features/bills/queries';
import { SharedBillView } from '../../../src/features/bills/shared-bill-view';
import { createSharedBillRepository } from '../../../src/features/bills/supabase-repository';
import { getCurrentUserId } from '../../../src/lib/auth/current-user';
import { createClient } from '../../../src/lib/supabase/server';

import {
  createBillAction,
  createFriendAction,
  deleteBillAction,
  resolveBillAction,
} from './actions';

export const metadata = {
  title: 'Shared Bills',
};

function todayInMalaysia(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export default async function SharedBillsPage() {
  const client = await createClient();
  const userId = await getCurrentUserId(() => client.auth.getClaims());
  if (!userId) redirect('/auth/sign-in');
  const overview = await getSharedBills(createSharedBillRepository(client), userId);
  return (
    <SharedBillView
      friends={overview.friends}
      bills={overview.bills}
      defaultTransactionDate={todayInMalaysia()}
      userId={userId}
      actions={{
        createFriend: createFriendAction,
        createBill: createBillAction,
        resolveBill: resolveBillAction,
        deleteBill: deleteBillAction,
      }}
    />
  );
}
