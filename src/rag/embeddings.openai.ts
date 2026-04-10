import OpenAI from 'openai';
import type { PrismaClient } from '@prisma/client';

/** Must match `vector(1536)` in Prisma schema / DB. */
export const EMBEDDING_DIMENSION = 1536;

const BATCH = 64;

export async function fetchEmbeddings(
  apiKey: string,
  model: string,
  inputs: string[],
): Promise<number[][]> {
  if (!inputs.length) {
    return [];
  }
  const openai = new OpenAI({ apiKey });
  const out: number[][] = [];
  for (let i = 0; i < inputs.length; i += BATCH) {
    const batch = inputs.slice(i, i + BATCH);
    const res = await openai.embeddings.create({ model, input: batch });
    const sorted = [...res.data].sort((a, b) => a.index - b.index);
    for (const d of sorted) {
      const v = d.embedding as number[];
      if (v.length !== EMBEDDING_DIMENSION) {
        throw new Error(
          `Embedding dimension ${v.length} !== ${EMBEDDING_DIMENSION} (check OPENAI_EMBED_MODEL vs schema)`,
        );
      }
      out.push(v);
    }
  }
  return out;
}

export function vectorToPgLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

export async function upsertChunkEmbeddings(
  prisma: PrismaClient,
  pairs: { chunkId: string; embedding: number[] }[],
  model: string,
): Promise<void> {
  for (const { chunkId, embedding } of pairs) {
    const vec = vectorToPgLiteral(embedding);
    await prisma.$executeRawUnsafe(
      `INSERT INTO chunk_embeddings (chunk_id, embedding, model, created_at)
       VALUES ($1, $2::vector(1536), $3, NOW())
       ON CONFLICT (chunk_id) DO UPDATE SET
         embedding = EXCLUDED.embedding,
         model = EXCLUDED.model`,
      chunkId,
      vec,
      model,
    );
  }
}

/** Embeds each chunk’s `content` and stores rows in `chunk_embeddings`. */
export async function embedChunksForDocument(
  prisma: PrismaClient,
  apiKey: string,
  model: string,
  documentId: string,
): Promise<number> {
  const chunks = await prisma.ragChunk.findMany({
    where: { documentId },
    orderBy: { chunkIndex: 'asc' },
    select: { id: true, content: true },
  });
  if (!chunks.length) {
    return 0;
  }
  const vectors = await fetchEmbeddings(
    apiKey,
    model,
    chunks.map((c) => c.content),
  );
  await upsertChunkEmbeddings(
    prisma,
    chunks.map((c, i) => ({ chunkId: c.id, embedding: vectors[i] })),
    model,
  );
  return chunks.length;
}
