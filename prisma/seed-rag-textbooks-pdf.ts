/**
 * Seeds RAG documents + chunks (+ embeddings) from textbook PDFs in a public
 * Google Drive folder. Two sources are supported:
 *
 *   --source scert (default)  SCERT Kerala, files named STD_09_Physics_English_Medium_Vol1.pdf
 *   --source ncert            NCERT, folders Class_09/Science/Exploration.pdf; only
 *                             English-language editions are kept (Hindi/Urdu/regional
 *                             editions in the same folders are detected and skipped)
 *
 * Pipeline per book volume:
 *   Drive → download (cached in data/content/textbooks/pdf) → per-page text →
 *   clean headers/page numbers → quality gate (skips scanned / garbled /
 *   non-English books) → chapter ranges from the table of contents (LLM, cached
 *   as JSON, verified against the body) → one RagDocument per chapter, chunks
 *   tagged with page numbers → embeddings.
 *
 * Idempotent: each run replaces the documents of the books it processes
 * (ids `<source>-<book key>-chNN`, textbook ids `<source>-<book key>`, so
 * GET /v1/textbooks/:id/chapters finds them). TOC JSON files can be hand-edited.
 *
 * Usage:
 *   npm run prisma:seed:rag-textbooks-pdf -- --class 9 --subject Physics --dry-run
 *   npm run prisma:seed:rag-textbooks-pdf -- --source ncert --class 9,10
 *
 * Flags:
 *   --source <name>   scert (default) | ncert
 *   --folder <id>     Drive folder id (default: the source's folder)
 *   --medium <name>   SCERT only: English (default) | Malayalam | Tamil | Kannada | all
 *   --class <list>    e.g. 9 or 8,9,10 (default: all)
 *   --subject <list>  match on subject name, e.g. Physics,Basic_Science (default: all)
 *   --exclude-subject <list>  skip these subjects
 *   --limit <n>       process at most n books
 *   --dry-run         download + extract + chunk + report, but write nothing to the DB
 *   --skip-embed      write documents/chunks but no embeddings
 *   --no-toc          one document per volume instead of per chapter
 */
import 'dotenv/config';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { embedChunksForDocument } from '../src/rag/embeddings.openai';
import {
  bookKey,
  normalizeSubject,
  parseBookFileName,
  parseNcertFile,
  slugify,
  type CatalogBook,
} from './textbooks/catalog';
import { crawlDriveFolder, downloadDriveFile, type DriveFile } from './textbooks/drive';
import {
  assessQuality,
  chunkPagesWithPageNo,
  cleanPages,
  readPdfPages,
  type PageText,
} from './textbooks/extract';
import { extractTocWithLlm, resolveChapterRanges, type ChapterRange } from './textbooks/toc';

type SourceConfig = {
  folder: string;
  /** Prefix for subject/textbook/document ids. */
  idPrefix: string;
  /** Stored on documents.source_type. */
  sourceType: string;
  /** Human label used in titles and textbooks.source. */
  label: string;
  parse: (file: DriveFile) => CatalogBook | null;
  requireEnglish: boolean;
  /** Subject folders never worth downloading (language subjects). */
  excludeSubjects: string[];
};

const SOURCES: Record<string, SourceConfig> = {
  scert: {
    folder: '1xfqR4je5S1BKUVAeLzLXuJhFb-hDvr2_',
    idPrefix: 'scert',
    sourceType: 'scert_kerala_book',
    label: 'SCERT Kerala',
    parse: parseBookFileName,
    requireEnglish: false,
    excludeSubjects: [],
  },
  ncert: {
    folder: '1hF88plzbKpFtP8rK6kHZ3n6y4wo2g6pc',
    idPrefix: 'ncert',
    sourceType: 'ncert_book',
    label: 'NCERT',
    parse: parseNcertFile,
    requireEnglish: true,
    excludeSubjects: ['Hindi', 'Urdu', 'Sanskrit'],
  },
};

const CACHE_DIR = join(__dirname, '..', 'data', 'content', 'textbooks');
const MIN_DOC_CHARS = 200;

type Args = {
  source: SourceConfig;
  folder: string;
  medium: string;
  classes: number[] | null;
  subjects: string[] | null;
  excludeSubjects: string[];
  limit: number | null;
  dryRun: boolean;
  skipEmbed: boolean;
  useToc: boolean;
};

function parseArgs(argv: string[]): Args {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const list = (v?: string) =>
    v ? v.split(',').map((s) => s.trim()).filter(Boolean) : null;
  const sourceName = (get('--source') ?? 'scert').toLowerCase();
  const source = SOURCES[sourceName];
  if (!source) {
    throw new Error(`Unknown --source "${sourceName}" (use: ${Object.keys(SOURCES).join(', ')})`);
  }
  return {
    source,
    folder: get('--folder') ?? source.folder,
    medium: (get('--medium') ?? 'English').toLowerCase(),
    classes: list(get('--class'))?.map(Number) ?? null,
    subjects: list(get('--subject'))?.map((s) => s.toLowerCase()) ?? null,
    excludeSubjects: [...source.excludeSubjects, ...(list(get('--exclude-subject')) ?? [])],
    limit: get('--limit') ? Number(get('--limit')) : null,
    dryRun: argv.includes('--dry-run'),
    skipEmbed: argv.includes('--skip-embed'),
    useToc: !argv.includes('--no-toc'),
  };
}

const prisma = new PrismaClient();

/** Subject name as stored; non-English mediums are kept apart from English content. */
function subjectNameFor(book: CatalogBook): string {
  return book.medium === 'English' ? book.subject : `${book.subject} (${book.medium} Medium)`;
}

/** Book title without the source/class prefix, e.g. "Physics Part-I" or "Physics Vol 1". */
function bookTitleFor(book: CatalogBook): string {
  return book.bookTitle ?? `${book.subject} Vol ${book.volume}`;
}

function pdfCachePath(book: CatalogBook): string {
  // NCERT file names repeat across classes (Mridang.pdf in Class_01 and Class_02).
  const name = book.board === 'ncert' ? `ncert-${bookKey(book)}.pdf` : book.fileName;
  return join(CACHE_DIR, 'pdf', name);
}

async function loadCatalog(args: Args): Promise<CatalogBook[]> {
  const manifestPath = join(CACHE_DIR, `manifest-${args.folder}.json`);
  let books: CatalogBook[];
  if (existsSync(manifestPath)) {
    books = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } else {
    console.log('Listing Drive folder (first run only)…');
    const files = await crawlDriveFolder(args.folder);
    books = files
      .filter((f) => f.name.toLowerCase().endsWith('.pdf'))
      .map(args.source.parse)
      .filter((b): b is CatalogBook => b !== null);
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(manifestPath, JSON.stringify(books, null, 2));
    console.log(`Catalog: ${books.length} PDFs (cached at ${manifestPath})`);
  }

  // Apply subject aliases to cached manifests too, then drop duplicate volumes
  // (e.g. Botany + Zoology → one Biology book).
  const seen = new Set<string>();
  books = books
    .map((b) => ({ ...b, subject: normalizeSubject(b.subject) }))
    .filter((b) => {
      const key = bookKey(b);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return books
    .filter((b) => args.medium === 'all' || b.medium.toLowerCase() === args.medium)
    .filter((b) => !args.classes || args.classes.includes(b.classLevel))
    .filter(
      (b) =>
        !args.subjects ||
        args.subjects.some((s) => slugify(b.subject) === slugify(s)),
    )
    .filter((b) => !args.excludeSubjects.some((s) => slugify(b.subject) === slugify(s)))
    .sort(
      (a, b) =>
        a.classLevel - b.classLevel ||
        a.subject.localeCompare(b.subject) ||
        bookTitleFor(a).localeCompare(bookTitleFor(b)) ||
        a.volume - b.volume,
    )
    .slice(0, args.limit ?? undefined);
}

async function chapterRangesFor(
  book: CatalogBook,
  rawPages: PageText[],
  args: Args,
): Promise<ChapterRange[] | null> {
  if (!args.useToc) return null;
  const tocName = book.board === 'ncert' ? `ncert-${bookKey(book)}` : bookKey(book);
  const tocPath = join(CACHE_DIR, 'toc', `${tocName}.json`);
  let toc;
  if (existsSync(tocPath)) {
    toc = JSON.parse(readFileSync(tocPath, 'utf8'));
  } else {
    const apiKey = process.env.OPENAI_API_KEY ?? '';
    if (!apiKey) return null;
    toc = await extractTocWithLlm(rawPages, {
      apiKey,
      model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
      bookLabel: `${args.source.label} Class ${book.classLevel} ${book.subject}: ${bookTitleFor(book)}`,
    });
    mkdirSync(join(CACHE_DIR, 'toc'), { recursive: true });
    writeFileSync(tocPath, JSON.stringify(toc, null, 2));
  }
  return resolveChapterRanges(rawPages, toc);
}

async function ensureSubjectAndTextbook(book: CatalogBook, args: Args) {
  const { idPrefix, label } = args.source;
  const name = subjectNameFor(book);
  // Reuse an existing subject (e.g. "Physics" class 11) so a (name, class) pair
  // maps to one Subject row across sources.
  let subject = await prisma.subject.findFirst({
    where: { name: { equals: name, mode: 'insensitive' }, class: book.classLevel },
  });
  if (!subject) {
    subject = await prisma.subject.create({
      data: { id: `${idPrefix}-${book.classLevel}-${slugify(name)}`, name, class: book.classLevel },
    });
  }

  const textbookId = `${idPrefix}-${bookKey(book)}`;
  const existing = await prisma.textbook.findUnique({ where: { id: textbookId } });
  if (!existing) {
    const last = await prisma.textbook.findFirst({
      where: { subjectId: subject.id },
      orderBy: { order: 'desc' },
    });
    await prisma.textbook.create({
      data: {
        id: textbookId,
        subjectId: subject.id,
        title: bookTitleFor(book),
        code: `${idPrefix.toUpperCase()}-${bookKey(book).toUpperCase()}`,
        order: (last?.order ?? 0) + 1,
        source: label,
      },
    });
  }
  return { subject, textbookId };
}

async function deleteBookDocuments(
  docPrefix: string,
  tx: Pick<PrismaClient, 'ragDocument' | 'ragChunk'> = prisma,
) {
  const stale = await tx.ragDocument.findMany({
    where: { id: { startsWith: docPrefix } },
    select: { id: true },
  });
  const staleIds = stale.map((d) => d.id);
  await tx.ragChunk.deleteMany({ where: { documentId: { in: staleIds } } });
  await tx.ragDocument.deleteMany({ where: { id: { in: staleIds } } });
}

type BookResult = {
  book: string;
  status: string;
  pages: number;
  docs: number;
  chunks: number;
  embedded: number;
};

async function processBook(book: CatalogBook, args: Args): Promise<BookResult> {
  const { idPrefix, label: sourceLabel, sourceType, requireEnglish } = args.source;
  const key = bookKey(book);
  const docPrefix = `${idPrefix}-${key}-`;
  const bookTitle = bookTitleFor(book);
  const label =
    book.board === 'ncert'
      ? `Class ${book.classLevel} ${book.subject}: ${bookTitle}`
      : `Class ${book.classLevel} ${book.subject} (${book.medium}) Vol ${book.volume}`;
  const result: BookResult = { book: label, status: '', pages: 0, docs: 0, chunks: 0, embedded: 0 };

  const pdfPath = pdfCachePath(book);
  await downloadDriveFile(book.driveId, pdfPath);

  const rawPages = await readPdfPages(readFileSync(pdfPath));
  const pages = cleanPages(rawPages);
  result.pages = pages.length;

  const quality = assessQuality(pages, {
    strictIndic: book.medium !== 'English',
    requireEnglish,
  });
  if (!quality.ok) {
    result.status = `skipped: ${quality.reason}`;
    if (!args.dryRun) {
      // Remove documents a previous run may have stored for this book.
      await deleteBookDocuments(docPrefix);
    }
    return result;
  }

  const chapterRanges = await chapterRangesFor(book, rawPages, args);
  const byChapter = chapterRanges !== null;
  const ranges: ChapterRange[] = chapterRanges ?? [
    { number: 0, title: bookTitle, fromPage: 1, toPage: pages.length },
  ];

  const docs = ranges
    .map((r, i) => {
      const slice = pages.slice(r.fromPage - 1, r.toPage);
      return {
        id: byChapter ? `${docPrefix}ch${String(i + 1).padStart(2, '0')}` : `${docPrefix}full`,
        range: r,
        chunks: slice.reduce((n, p) => n + p.text.length, 0) >= MIN_DOC_CHARS ? chunkPagesWithPageNo(slice) : [],
      };
    })
    .filter((d) => d.chunks.length > 0);

  result.docs = docs.length;
  result.chunks = docs.reduce((n, d) => n + d.chunks.length, 0);
  result.status = byChapter ? `ok (${ranges.length} chapters)` : 'ok (no usable TOC → 1 doc)';

  if (args.dryRun) {
    const outDir = join(CACHE_DIR, 'text', `${idPrefix}-${key}`);
    mkdirSync(outDir, { recursive: true });
    for (const d of docs) {
      writeFileSync(
        join(outDir, `${d.id}.txt`),
        `# ${d.range.title} (PDF pages ${d.range.fromPage}-${d.range.toPage})\n\n` +
          d.chunks.map((c) => `--- chunk ${c.chunkIndex} · page ${c.pageNo ?? '?'} · ~${c.tokenCount} tok\n${c.content}`).join('\n\n'),
      );
    }
    result.status += ' [dry-run]';
    return result;
  }

  const { subject } = await ensureSubjectAndTextbook(book, args);
  const docTitle =
    book.board === 'ncert'
      ? `${sourceLabel} Class ${book.classLevel} ${book.subject} — ${bookTitle}`
      : `${sourceLabel} Class ${book.classLevel} ${book.subject} Vol ${book.volume}`;

  await prisma.$transaction(async (tx) => {
    await deleteBookDocuments(docPrefix, tx);

    for (const d of docs) {
      await tx.ragDocument.create({
        data: {
          id: d.id,
          title: docTitle + (byChapter ? ` — Ch ${d.range.number}: ${d.range.title}` : ''),
          subject: subject.name,
          classLevel: book.classLevel,
          chapter: d.range.title,
          exercise: null,
          sourceType,
          sourcePath: `${book.fileName}#pages=${d.range.fromPage}-${d.range.toPage}`,
        },
      });
      await tx.ragChunk.createMany({
        data: d.chunks.map((c) => ({
          documentId: d.id,
          chunkIndex: c.chunkIndex,
          content: c.content,
          tokenCount: c.tokenCount,
          pageNo: c.pageNo ?? null,
          section: null,
        })),
      });
    }
  }, { timeout: 60_000 });

  const apiKey = process.env.OPENAI_API_KEY ?? '';
  if (apiKey && !args.skipEmbed) {
    const model = process.env.OPENAI_EMBED_MODEL || process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
    for (const d of docs) {
      result.embedded += await embedChunksForDocument(prisma, apiKey, model, d.id);
    }
  }
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const books = await loadCatalog(args);
  if (!books.length) {
    console.log('No books match the given filters.');
    return;
  }
  console.log(
    `${args.dryRun ? '[DRY RUN] ' : ''}Processing ${books.length} ${args.source.label} book(s)` +
      (args.dryRun ? '' : ` into ${new URL(process.env.DATABASE_URL ?? 'postgres://unknown').host}`),
  );
  if (!args.dryRun && !process.env.OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY not set — chunks will be stored without embeddings.');
  }

  const results: BookResult[] = [];
  for (const [i, book] of books.entries()) {
    try {
      const r = await processBook(book, args);
      results.push(r);
      console.log(`[${i + 1}/${books.length}] ${r.book}: ${r.status} · ${r.docs} docs · ${r.chunks} chunks · ${r.embedded} embedded`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ book: book.fileName, status: `error: ${msg}`, pages: 0, docs: 0, chunks: 0, embedded: 0 });
      console.error(`[${i + 1}/${books.length}] ${book.fileName}: ERROR ${msg}`);
    }
  }

  console.log('\nSummary');
  console.table(results);
  const skipped = results.filter((r) => !r.status.startsWith('ok')).length;
  console.log(
    `Books: ${results.length} · ok: ${results.length - skipped} · skipped/errors: ${skipped} · ` +
      `chunks: ${results.reduce((n, r) => n + r.chunks, 0)}`,
  );
  if (!args.dryRun) {
    console.log('Next: run POST /v1/rag/topics/embed + /v1/rag/topics/map for subjects that have a syllabus.');
  }
}

main()
  .catch((e) => {
    console.error('Textbook PDF seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
