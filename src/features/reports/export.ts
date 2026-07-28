type ClaimsResult = {
  data: { claims?: { sub?: unknown } } | null;
  error: unknown;
};

type ExportHandlerOptions<T> = {
  getClaims: () => Promise<ClaimsResult>;
  load: (userId: string) => Promise<T>;
  serialize: (data: T) => string;
  filename: string;
  contentType: string;
};

export function createExportHandler<T>({
  getClaims,
  load,
  serialize,
  filename,
  contentType,
}: ExportHandlerOptions<T>): () => Promise<Response> {
  return async () => {
    const { data, error } = await getClaims();
    const userId = data?.claims?.sub;
    if (error || typeof userId !== 'string' || userId.trim() === '') {
      return new Response('Authentication required', {
        status: 401,
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }
    try {
      const body = serialize(await load(userId));
      return new Response(body, {
        headers: {
          'Cache-Control': 'private, no-store',
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${filename}"`,
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch {
      return new Response('Export failed', {
        status: 500,
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }
  };
}
