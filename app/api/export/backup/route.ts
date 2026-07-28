import { loadBackupExport } from '../../../../src/features/reports/export-data';
import { createExportHandler } from '../../../../src/features/reports/export';
import { createClient } from '../../../../src/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const client = await createClient();
  return createExportHandler({
    getClaims: () => client.auth.getClaims(),
    load: (userId) => loadBackupExport(client, userId),
    filename: 'personal-finance-backup.json',
    contentType: 'application/json; charset=utf-8',
    serialize: (tables) => JSON.stringify({
      exportedAt: new Date().toISOString(),
      schemaVersion: 1,
      tables,
    }, null, 2),
  })();
}
