import type { PrismaClient } from '@prisma/client';
import { fetchEmbeddings, vectorToPgLiteral } from './embeddings.openai';

/**
 * Topic mapping utilities.
 *
 * These reuse the embeddings that already exist for chunks: we embed each
 * syllabus topic once (its name + learning outcomes), store the vector in
 * `topic_embeddings`, then assign every in-scope chunk to its nearest topic
 * via pgvector cosine distance. No chunk re-processing / re-embedding needed.
 */

export type TopicRow = {
  id: string;
  code: string;
  name: string;
  learningOutcomes: string[];
};

/** Text representation of a topic used for embedding. */
export function topicEmbeddingText(topic: TopicRow): string {
  const outcomes = (topic.learningOutcomes ?? []).join('. ');
  return outcomes ? `${topic.name}. ${outcomes}` : topic.name;
}

/**
 * Embed all topics for a subject and upsert them into `topic_embeddings`.
 * Returns the number of topics embedded.
 */
export async function embedTopicsForSubject(
  prisma: PrismaClient,
  apiKey: string,
  model: string,
  subjectId: string,
): Promise<number> {
  const topics = (await prisma.topic.findMany({
    where: { unit: { subjectId } },
    select: {
      id: true,
      code: true,
      name: true,
      learningOutcomes: true,
    },
  })) as TopicRow[];

  if (!topics.length) {
    return 0;
  }

  const vectors = await fetchEmbeddings(
    apiKey,
    model,
    topics.map((t) => topicEmbeddingText(t)),
  );

  for (let i = 0; i < topics.length; i += 1) {
    const vec = vectorToPgLiteral(vectors[i]);
    await prisma.$executeRawUnsafe(
      `INSERT INTO topic_embeddings (topic_id, embedding, model, created_at)
       VALUES ($1, $2::vector(1536), $3, NOW())
       ON CONFLICT (topic_id) DO UPDATE SET
         embedding = EXCLUDED.embedding,
         model = EXCLUDED.model`,
      topics[i].id,
      vec,
      model,
    );
  }

  return topics.length;
}

/**
 * Assign each in-scope chunk to its nearest syllabus topic.
 *
 * Scope = documents whose subject name matches and class_level matches. Only
 * chunks whose nearest-topic similarity clears `minSimilarity` are tagged;
 * everything else is left null (out-of-syllabus / ambiguous).
 *
 * @returns number of chunks (re)assigned.
 */
export async function mapChunksToTopics(
  prisma: PrismaClient,
  params: {
    subjectId: string;
    subjectName: string;
    classLevel: number;
    minSimilarity: number;
    onlyUntagged: boolean;
  },
): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ updated: number }[]>(
    `
    WITH scoped AS (
      SELECT ce.chunk_id, ce.embedding
      FROM chunk_embeddings ce
      JOIN chunks c ON c.id = ce.chunk_id
      JOIN documents d ON d.id = c.document_id
      WHERE d.class_level = $2
        AND d.subject ILIKE $3
        AND ($4::boolean = false OR c.topic_id IS NULL)
    ),
    ranked AS (
      SELECT
        s.chunk_id,
        te.topic_id,
        (1 - (te.embedding <=> s.embedding)) AS sim,
        ROW_NUMBER() OVER (
          PARTITION BY s.chunk_id
          ORDER BY te.embedding <=> s.embedding
        ) AS rn
      FROM scoped s
      CROSS JOIN topic_embeddings te
      JOIN topics t ON t.id = te.topic_id
      JOIN units u ON u.id = t.unit_id
      WHERE u.subject_id = $1
    ),
    upd AS (
      UPDATE chunks c
      SET topic_id = r.topic_id
      FROM ranked r
      WHERE c.id = r.chunk_id
        AND r.rn = 1
        AND r.sim >= $5
      RETURNING c.id
    )
    SELECT COUNT(*)::int AS updated FROM upd
    `,
    params.subjectId,
    params.classLevel,
    params.subjectName,
    params.onlyUntagged,
    params.minSimilarity,
  );

  return Number(rows?.[0]?.updated ?? 0);
}

/** Per-topic chunk counts plus how many in-scope chunks remain untagged. */
export async function topicCoverage(
  prisma: PrismaClient,
  params: { subjectId: string; subjectName: string; classLevel: number },
): Promise<{
  perTopic: {
    topicId: string;
    code: string;
    name: string;
    chunkCount: number;
  }[];
  untagged: number;
}> {
  const perTopicRaw = await prisma.$queryRawUnsafe<
    { topic_id: string; code: string; name: string; chunk_count: number }[]
  >(
    `
    SELECT t.id AS topic_id, t.code, t.name, COUNT(c.id)::int AS chunk_count
    FROM topics t
    JOIN units u ON u.id = t.unit_id
    LEFT JOIN chunks c ON c.topic_id = t.id
    WHERE u.subject_id = $1
    GROUP BY t.id, t.code, t.name
    ORDER BY t.code
    `,
    params.subjectId,
  );

  const untaggedRaw = await prisma.$queryRawUnsafe<{ untagged: number }[]>(
    `
    SELECT COUNT(c.id)::int AS untagged
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
    WHERE d.class_level = $1
      AND d.subject ILIKE $2
      AND c.topic_id IS NULL
    `,
    params.classLevel,
    params.subjectName,
  );

  return {
    perTopic: perTopicRaw.map((r) => ({
      topicId: r.topic_id,
      code: r.code,
      name: r.name,
      chunkCount: Number(r.chunk_count),
    })),
    untagged: Number(untaggedRaw?.[0]?.untagged ?? 0),
  };
}
