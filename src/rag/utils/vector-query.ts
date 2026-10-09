import type { PrismaClient } from '@prisma/client';

/**
 * Runs a pgvector nearest-neighbour query with HNSW iterative scans enabled.
 *
 * Without it, the HNSW index only returns the `hnsw.ef_search` (default 40)
 * nearest rows across the WHOLE table and the WHERE filters (class, subject,
 * topic) are applied afterwards — so a class-scoped search often comes back
 * empty once many classes share the table. `iterative_scan` (pgvector >= 0.8)
 * keeps scanning until enough rows pass the filters. SET LOCAL scopes the
 * setting to this transaction, so pooled connections are unaffected.
 */
export async function queryVectorRows<T>(
  prisma: Pick<PrismaClient, '$transaction'>,
  sql: string,
  ...params: unknown[]
): Promise<T[]> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL hnsw.iterative_scan = strict_order`);
    return tx.$queryRawUnsafe<T[]>(sql, ...params);
  });
}
