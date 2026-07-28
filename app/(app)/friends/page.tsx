import { redirect } from 'next/navigation';

import { FriendsView } from '../../../src/features/friends/friends-view';
import { getFriendsOverview } from '../../../src/features/friends/queries';
import { createFriendRepository } from '../../../src/features/friends/supabase-repository';
import { getCurrentUserId } from '../../../src/lib/auth/current-user';
import { createClient } from '../../../src/lib/supabase/server';

export default async function FriendsPage() {
  const client = await createClient();
  const userId = await getCurrentUserId(() => client.auth.getClaims());
  if (!userId) redirect('/auth/sign-in');
  const friends = await getFriendsOverview(createFriendRepository(client), userId);
  return <FriendsView friends={friends} />;
}
