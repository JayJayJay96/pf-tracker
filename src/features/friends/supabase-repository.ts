import type { SupabaseClient } from '@supabase/supabase-js';

import type { FriendWriteRepository } from './actions';
import type { FriendReadRepository } from './queries';

export type FriendRepository = FriendReadRepository & FriendWriteRepository;

export function createFriendRepository(client: SupabaseClient): FriendRepository {
  return {
    async listFriends(userId) {
      const { data, error } = await client
        .from('friends')
        .select('id,name,nickname,phone,notes,active')
        .eq('user_id', userId)
        .order('name');
      return { data, error };
    },
    async listPortions(userId) {
      const { data, error } = await client
        .from('bill_participants')
        .select(
          'id,friend_id,amount_sen,transactions!inner(description,transaction_date,shared_status),friend_portion_settlements!inner(id,status,payment_request_id,settled_on)',
        )
        .eq('user_id', userId)
        .eq('participant_kind', 'friend')
        .eq('transactions.shared_status', 'resolved')
        .order('transaction_date', {
          referencedTable: 'transactions',
          ascending: false,
        });
      return { data, error };
    },
    async listRequests(userId) {
      const { data, error } = await client
        .from('payment_requests')
        .select(
          'id,friend_id,total_sen,request_date,status,note,paid_on,cancelled_on,forgiven_on',
        )
        .eq('user_id', userId)
        .order('request_date', { ascending: false })
        .order('created_at', { ascending: false });
      return { data, error };
    },
    async listRequestItems(userId) {
      const { data, error } = await client
        .from('payment_request_items')
        .select(
          'id,payment_request_id,bill_participant_id,description_snapshot,transaction_date_snapshot,amount_sen_snapshot',
        )
        .eq('user_id', userId)
        .order('transaction_date_snapshot');
      return { data, error };
    },
    async createRequest(command) {
      const { data, error } = await client.rpc('create_payment_request', {
        p_friend_id: command.friendId,
        p_portion_ids: command.portionIds,
        p_request_date: command.requestDate,
        p_note: command.note,
      });
      return { data: typeof data === 'string' ? data : null, error };
    },
    async transitionRequest(command) {
      const { error } = await client.rpc('transition_payment_request', {
        p_request_id: command.requestId,
        p_status: command.status,
        p_paid_amount_sen: command.paidAmountSen,
        p_occurred_on: command.occurredOn,
      });
      return { error };
    },
  };
}
