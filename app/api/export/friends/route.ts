import { toCsv } from '../../../../src/features/reports/csv';
import { loadFriendExport } from '../../../../src/features/reports/export-data';
import { createExportHandler } from '../../../../src/features/reports/export';
import { createClient } from '../../../../src/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const client = await createClient();
  return createExportHandler({
    getClaims: () => client.auth.getClaims(),
    load: (userId) => loadFriendExport(client, userId),
    filename: 'friend-balances.csv',
    contentType: 'text/csv; charset=utf-8',
    serialize: (data) => toCsv(
      ['id', 'name', 'nickname', 'phone', 'active', 'unrequested_sen', 'requested_sen', 'outstanding_sen', 'collected_sen', 'forgiven_sen'],
      data,
    ),
  })();
}
