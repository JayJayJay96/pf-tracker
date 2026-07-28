import { toCsv } from '../../../../src/features/reports/csv';
import { loadRequestExport, flattenExportRow } from '../../../../src/features/reports/export-data';
import { createExportHandler } from '../../../../src/features/reports/export';
import { createClient } from '../../../../src/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const client = await createClient();
  return createExportHandler({
    getClaims: () => client.auth.getClaims(),
    load: (userId) => loadRequestExport(client, userId),
    filename: 'payment-requests.csv',
    contentType: 'text/csv; charset=utf-8',
    serialize: (data) => toCsv(
      ['id', 'friends', 'total_sen', 'request_date', 'status', 'paid_on', 'cancelled_on', 'forgiven_on', 'note', 'description_snapshot', 'transaction_date_snapshot', 'amount_sen_snapshot'],
      data.map(flattenExportRow),
    ),
  })();
}
