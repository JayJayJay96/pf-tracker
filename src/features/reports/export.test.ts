import { describe, expect, it, vi } from 'vitest';

import { createExportHandler } from './export';

describe('createExportHandler', () => {
  it('rejects missing verified claims without loading data', async () => {
    const load = vi.fn();
    const handler = createExportHandler({
      getClaims: async () => ({ data: { claims: {} }, error: null }),
      load,
      filename: 'transactions.csv',
      contentType: 'text/csv; charset=utf-8',
      serialize: () => 'unused',
    });

    const response = await handler();

    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(load).not.toHaveBeenCalled();
  });

  it('loads only the verified owner and returns a non-cacheable download', async () => {
    const load = vi.fn(async () => [{ description: 'Lunch' }]);
    const handler = createExportHandler({
      getClaims: async () => ({
        data: { claims: { sub: 'owner-a' } },
        error: null,
      }),
      load,
      filename: 'transactions.csv',
      contentType: 'text/csv; charset=utf-8',
      serialize: () => 'description\r\nLunch\r\n',
    });

    const response = await handler();

    expect(load).toHaveBeenCalledWith('owner-a');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('content-disposition'))
      .toBe('attachment; filename="transactions.csv"');
    expect(await response.text()).toBe('description\r\nLunch\r\n');
  });
});
