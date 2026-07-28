import type { SupabaseClient } from '@supabase/supabase-js';

import type { SharedBillWriteRepository } from './actions';
import type { SharedBillReadRepository } from './queries';

export type SharedBillRepository =
  & SharedBillWriteRepository
  & SharedBillReadRepository;

export function createSharedBillRepository(
  client: SupabaseClient,
): SharedBillRepository {
  return {
    async listFriends(userId) {
      const { data, error } = await client
        .from('friends')
        .select('id,name')
        .eq('user_id', userId)
        .order('name');
      return { data, error };
    },
    async listBills(userId) {
      const { data, error } = await client
        .from('transactions')
        .select(
          'id,description,amount_sen,transaction_date,payment_method,shared_status,bill_participants(participant_kind,amount_sen,friends(name))',
        )
        .eq('user_id', userId)
        .eq('transaction_type', 'shared_expense')
        .order('transaction_date', { ascending: false });
      return { data, error };
    },
    async insertFriend(friend) {
      const { error } = await client.from('friends').insert(friend);
      return { error };
    },
    async insertTransaction(transaction) {
      const { error } = await client.from('transactions').insert(transaction);
      return { error };
    },
    async getUnresolvedBill(billId, userId) {
      const { data, error } = await client
        .from('transactions')
        .select('id,amount_sen')
        .eq('id', billId)
        .eq('user_id', userId)
        .eq('transaction_type', 'shared_expense')
        .eq('shared_status', 'unresolved')
        .maybeSingle();
      return { data, error };
    },
    async saveEqualResolution(resolution) {
      const { error } = await client.rpc('save_equal_shared_bill_resolution', {
        p_transaction_id: resolution.transaction_id,
        p_friend_id: resolution.friend_id,
        p_item_id: resolution.item_id,
        p_user_participant_id: resolution.user_participant_id,
        p_friend_participant_id: resolution.friend_participant_id,
        p_item_description: resolution.item_description,
        p_user_amount_sen: resolution.user_amount_sen,
        p_friend_amount_sen: resolution.friend_amount_sen,
      });
      return { error };
    },
    async saveResolution(resolution) {
      const { error } = await client.rpc('save_shared_bill_resolution', {
        p_transaction_id: resolution.transactionId,
        p_items: resolution.items,
        p_participants: resolution.participants,
        p_assignments: resolution.assignments,
        p_adjustments: resolution.adjustments,
      });
      return { error };
    },
  };
}
