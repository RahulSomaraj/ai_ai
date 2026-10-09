/**
 * Quick retrieval check without starting the API: embeds a question and prints
 * the closest chunks (same cosine search the /rag/ask endpoint uses).
 *
 * Usage:
 *   npm run rag:search -- "What is refractive index?" --class 9
 *   npm run rag:search -- "What is photosynthesis?" --class 7 --subject "Basic Science" --top 5
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { fetchEmbeddings, vectorToPgLiteral } from '../src/rag/embeddings.openai';
import { queryVectorRows } from '../src/rag/utils/vector-query';

const prisma = new PrismaClient();

async function main() {
  const argv = process.argv.slice(2);
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const question = argv.find((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
  if (!question) {
    throw new Error('Usage: npm run rag:search -- "<question>" --class <n> [--subject <name>] [--top <n>]');
  }
  const classLevel = get('--class') ? Number(get('--class')) : null;
  const subject = get('--subject') ?? null;
  const top = Number(get('--top') ?? 3);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
  const model = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small';
  const [vector] = await fetchEmbeddings(apiKey, model, [question]);

  const rows = await queryVectorRows<any>(
    prisma,
    `
    SELECT d.title, d.subject, d.class_level, c.page_no,
           (1 - (ce.embedding <=> $1::vector(1536)))::float8 AS similarity,
           c.content
    FROM chunks c
    JOIN chunk_embeddings ce ON ce.chunk_id = c.id
    JOIN documents d ON d.id = c.document_id
    WHERE ($2::int IS NULL OR d.class_level = $2::int)
      AND ($3::text IS NULL OR d.subject ILIKE $3::text)
    ORDER BY ce.embedding <=> $1::vector(1536)
    LIMIT $4
    `,
    vectorToPgLiteral(vector),
    classLevel,
    subject,
    top,
  );

  if (!rows.length) {
    console.log('No matching chunks.');
    return;
  }
  for (const r of rows) {
    console.log(
      `\n${Number(r.similarity).toFixed(3)}  ${r.title}  (class ${r.class_level}, page ${r.page_no ?? '?'})`,
    );
    console.log('   ' + String(r.content).slice(0, 300).replace(/\s+/g, ' '));
  }
  console.log('\nScores ≥ 0.42 (RAG_MIN_SIMILARITY) are used by /rag/ask to answer.');
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
