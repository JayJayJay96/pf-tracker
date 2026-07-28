import type { SupabaseClient } from '@supabase/supabase-js';

type Row = Record<string, unknown>;

function rows(
  result: { data: unknown[] | null; error: { message: string } | null },
): Row[] {
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error('Invalid export data');
  return result.data.map((value) => {
    if (!value || typeof value !== 'object') throw new Error('Invalid export data');
    return value as Row;
  });
}

export async function loadTransactionExport(
  client: SupabaseClient,
  userId: string,
): Promise<Row[]> {
  return rows(await client
    .from('transactions')
    .select(
      'id,description,merchant,amount_sen,transaction_date,recorded_at,payment_method,transaction_type,shared_status,notes,categories(name)',
    )
    .eq('user_id', userId)
    .order('transaction_date', { ascending: false }));
}

export async function loadFriendExport(
  client: SupabaseClient,
  userId: string,
): Promise<Row[]> {
  const [friendResult, portionResult] = await Promise.all([
    client.from('friends')
      .select('id,name,nickname,phone,active')
      .eq('user_id', userId)
      .order('name'),
    client.from('bill_participants')
      .select('friend_id,amount_sen,friend_portion_settlements!inner(status)')
      .eq('user_id', userId)
      .eq('participant_kind', 'friend'),
  ]);
  const portions = rows(portionResult);
  return rows(friendResult).map((friend) => {
    const friendPortions = portions.filter(({ friend_id: friendId }) => friendId === friend.id);
    const amount = (statuses: string[]) => friendPortions.reduce((total, portion) => {
      const relation = Array.isArray(portion.friend_portion_settlements)
        ? portion.friend_portion_settlements[0]
        : portion.friend_portion_settlements;
      const status = relation && typeof relation === 'object'
        ? (relation as Row).status
        : null;
      return statuses.includes(String(status))
        ? total + Number(portion.amount_sen)
        : total;
    }, 0);
    return {
      ...friend,
      unrequested_sen: amount(['unrequested']),
      requested_sen: amount(['requested']),
      outstanding_sen: amount(['unrequested', 'requested']),
      collected_sen: amount(['paid']),
      forgiven_sen: amount(['forgiven']),
    };
  });
}

export async function loadRequestExport(
  client: SupabaseClient,
  userId: string,
): Promise<Row[]> {
  const [requestResult, itemResult] = await Promise.all([
    client.from('payment_requests')
      .select(
        'id,friend_id,total_sen,request_date,status,note,paid_on,cancelled_on,forgiven_on,friends(name)',
      )
      .eq('user_id', userId)
      .order('request_date', { ascending: false }),
    client.from('payment_request_items')
      .select(
        'payment_request_id,description_snapshot,transaction_date_snapshot,amount_sen_snapshot',
      )
      .eq('user_id', userId)
      .order('transaction_date_snapshot'),
  ]);
  const items = rows(itemResult);
  return rows(requestResult).flatMap((request) => {
    const requestItems = items.filter(({ payment_request_id: requestId }) => (
      requestId === request.id
    ));
    return requestItems.length > 0
      ? requestItems.map((item) => ({ ...request, ...item }))
      : [{ ...request }];
  });
}

const backupTables = [
  'profiles',
  'categories',
  'financial_plan_templates',
  'financial_plan_entries',
  'transactions',
  'friends',
  'bill_items',
  'bill_participants',
  'item_assignments',
  'bill_adjustments',
  'friend_portion_settlements',
  'payment_requests',
  'payment_request_items',
] as const;

export async function loadBackupExport(
  client: SupabaseClient,
  userId: string,
): Promise<Record<string, Row[]>> {
  const result = await Promise.all(backupTables.map(async (table) => [
    table,
    rows(await client.from(table).select('*').eq('user_id', userId)),
  ] as const));
  return Object.fromEntries(result);
}

export function flattenExportRow(row: Row): Row {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => {
    if (value === null || typeof value !== 'object') return [key, value];
    if (Array.isArray(value)) return [key, JSON.stringify(value)];
    const entries = Object.entries(value as Row);
    return entries.length === 1 ? [key, entries[0][1]] : [key, JSON.stringify(value)];
  }));
}
