import { toCsv } from '../../../../src/features/reports/csv';
import { loadTransactionExport, flattenExportRow } from '../../../../src/features/reports/export-data';
import { createExportHandler } from '../../../../src/features/reports/export';
import { createClient } from '../../../../src/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const client = await createClient();
  return createExportHandler({
    getClaims: () => client.auth.getClaims(),
    load: (userId) => loadTransactionExport(client, userId),
    filename: 'transactions.csv',
    contentType: 'text/csv; charset=utf-8',
    serialize: (data) => toCsv(
      ['id', 'transaction_date', 'recorded_at', 'description', 'merchant', 'amount_sen', 'payment_method', 'transaction_type', 'shared_status', 'categories', 'notes'],
      data.map(flattenExportRow),
    ),
  })();
}
