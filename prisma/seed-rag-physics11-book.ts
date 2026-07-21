/**
 * Seeds RAG documents + chunks for Class 11 Physics Part 1 from the NCERT textbook.
 *
 * Content is the OCR-extracted text of the uploaded NCERT Class 11 Physics Part 1
 * PDF, one document per chapter. Text lives in data/content/physics11/*.txt so the
 * DB payload is auditable and re-runs are deterministic.
 *
 * Idempotent: re-running deletes and recreates the document + chunks for each chapter.
 * If OPENAI_API_KEY is set, chunk embeddings are (re)generated after insert.
 *
 * Usage: npx ts-node prisma/seed-rag-physics11-book.ts
 *   or:  npm run prisma:seed:rag-physics11-book
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { buildChunks, normalizeText } from '../src/rag/chunking';
import { embedChunksForDocument } from '../src/rag/embeddings.openai';

const prisma = new PrismaClient();

const SUBJECT = 'Physics';
const CLASS_LEVEL = 11;
const SOURCE_TYPE = 'ncert_book';
const CONTENT_DIR = join(__dirname, '..', 'data', 'content', 'physics11');

type ChapterSeed = {
  chapterNo: number;
  chapter: string;
  /** File under data/content/physics11 holding the OCR-extracted chapter text. */
  file: string;
};

// Chapters as they appear in the uploaded NCERT Class 11 Physics Part 1 (2020 print,
// 8 chapters including "Physical World").
const PHYSICS_11_PART1: ChapterSeed[] = [
  { chapterNo: 1, chapter: 'Physical World', file: '01-physical-world.txt' },
  { chapterNo: 2, chapter: 'Units and Measurements', file: '02-units-and-measurements.txt' },
  { chapterNo: 3, chapter: 'Motion in a Straight Line', file: '03-motion-in-a-straight-line.txt' },
  { chapterNo: 4, chapter: 'Motion in a Plane', file: '04-motion-in-a-plane.txt' },
  { chapterNo: 5, chapter: 'Laws of Motion', file: '05-laws-of-motion.txt' },
  { chapterNo: 6, chapter: 'Work, Energy and Power', file: '06-work-energy-and-power.txt' },
  {
    chapterNo: 7,
    chapter: 'System of Particles and Rotational Motion',
    file: '07-system-of-particles-and-rotational-motion.txt',
  },
  { chapterNo: 8, chapter: 'Gravitation', file: '08-gravitation.txt' },
];

function docIdFor(seed: ChapterSeed): string {
  return `seed-rag-phy11-book-${String(seed.chapterNo).padStart(2, '0')}`;
}

async function upsertChapter(seed: ChapterSeed): Promise<{ chunkCount: number }> {
  const raw = readFileSync(join(CONTENT_DIR, seed.file), 'utf8');
  const clean = normalizeText(raw);
  if (clean.length < 200) {
    throw new Error(`Chapter ${seed.chapterNo} (${seed.file}): text too short after normalize.`);
  }

  const built = buildChunks(clean);
  if (!built.length) {
    throw new Error(`Chapter ${seed.chapterNo} (${seed.file}): produced no chunks.`);
  }

  const docId = docIdFor(seed);
  await prisma.$transaction(async (tx) => {
    await tx.ragChunk.deleteMany({ where: { documentId: docId } });
    await tx.ragDocument.deleteMany({ where: { id: docId } });

    await tx.ragDocument.create({
      data: {
        id: docId,
        title: `NCERT Class 11 Physics — Ch ${seed.chapterNo}: ${seed.chapter}`,
        subject: SUBJECT,
        classLevel: CLASS_LEVEL,
        chapter: seed.chapter,
        exercise: null,
        sourceType: SOURCE_TYPE,
        sourcePath: `data/content/physics11/${seed.file}`,
      },
    });

    await tx.ragChunk.createMany({
      data: built.map((c) => ({
        documentId: docId,
        chunkIndex: c.chunkIndex,
        content: c.content,
        tokenCount: c.tokenCount,
        pageNo: null,
        section: null,
      })),
    });
  });

  return { chunkCount: built.length };
}

async function main() {
  const results: { chapter: string; chunks: number }[] = [];

  for (const seed of PHYSICS_11_PART1) {
    const { chunkCount } = await upsertChapter(seed);
    results.push({ chapter: `${seed.chapterNo}. ${seed.chapter}`, chunks: chunkCount });
    console.log(`Seeded Ch ${seed.chapterNo} (${seed.chapter}): ${chunkCount} chunks`);
  }

  const apiKey = process.env.OPENAI_API_KEY ?? '';
  const embedModel =
    process.env.OPENAI_EMBED_MODEL || process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
  if (apiKey) {
    for (const seed of PHYSICS_11_PART1) {
      const n = await embedChunksForDocument(prisma, apiKey, embedModel, docIdFor(seed));
      console.log(`Indexed embeddings: ${n} chunks for Ch ${seed.chapterNo}`);
    }
  } else {
    console.warn(
      'OPENAI_API_KEY not set — seeded documents/chunks only; embeddings skipped. ' +
        'Set the key and re-run to index chunk_embeddings.',
    );
  }

  console.log('\nClass 11 Physics Part 1 (NCERT book) RAG seed completed.');
  console.table(results);
}

main()
  .catch((e) => {
    console.error('Physics 11 book seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
