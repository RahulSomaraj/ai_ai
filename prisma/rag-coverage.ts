/**
 * Shows what RAG content is in the database: documents, chunks and embedded
 * chunks per class (and per subject with --by-subject).
 *
 * Usage:
 *   npm run rag:coverage
 *   npm run rag:coverage -- --by-subject
 *   npm run rag:coverage -- --by-subject --class 9
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const argv = process.argv.slice(2);
  const bySubject = argv.includes('--by-subject');
  const classArg = argv.indexOf('--class');
  const classLevel = classArg >= 0 ? Number(argv[classArg + 1]) : null;

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `
    SELECT d.class_level AS class,
           ${bySubject ? 'd.subject,' : ''}
           d.source_type,
           COUNT(DISTINCT d.id)::int AS docs,
           COUNT(c.id)::int AS chunks,
           COUNT(ce.chunk_id)::int AS embedded
    FROM documents d
    LEFT JOIN chunks c ON c.document_id = d.id
    LEFT JOIN chunk_embeddings ce ON ce.chunk_id = c.id
    WHERE ($1::int IS NULL OR d.class_level = $1::int)
    GROUP BY d.class_level, ${bySubject ? 'd.subject, ' : ''}d.source_type
    ORDER BY d.class_level, ${bySubject ? 'd.subject, ' : ''}d.source_type
    `,
    classLevel,
  );
  console.table(rows);

  const total = rows.reduce(
    (t, r) => ({ docs: t.docs + r.docs, chunks: t.chunks + r.chunks, embedded: t.embedded + r.embedded }),
    { docs: 0, chunks: 0, embedded: 0 },
  );
  console.log(`Total: ${total.docs} documents · ${total.chunks} chunks · ${total.embedded} embedded`);
  if (total.embedded < total.chunks) {
    console.log(`⚠ ${total.chunks - total.embedded} chunks have no embedding yet (not searchable).`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
