/**
 * Prints subjects/textbooks from the current DATABASE_URL and ready-to-run curl samples.
 * Run from repo root: npx ts-node prisma/print-rag-curls.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE = process.env.API_BASE ?? 'http://localhost:3000/v1';

async function main() {
  const subjects = await prisma.subject.findMany({
    orderBy: [{ class: 'asc' }, { name: 'asc' }],
    include: {
      textbooks: { orderBy: { order: 'asc' } },
    },
  });

  console.log('# Live data from DATABASE_URL\n');
  console.log('| Class | Subject | subjectId | textbook (order) | textbookId |');
  console.log('|-------|---------|-----------|------------------|------------|');
  for (const s of subjects) {
    if (!s.textbooks.length) {
      console.log(
        `| ${s.class} | ${s.name} | \`${s.id}\` | — | — |`,
      );
      continue;
    }
    for (const t of s.textbooks) {
      console.log(
        `| ${s.class} | ${s.name} | \`${s.id}\` | ${t.title} (${t.order}) | \`${t.id}\` |`,
      );
    }
  }

  const longText =
    'Synthetic NCERT-style text for ingest testing. '.repeat(15) +
    'Units, dimensions, and SI prefixes appear in early physics chapters.';

  console.log('\n---\n# GET all textbooks for one subject\n');
  if (subjects[0]) {
    console.log(
      `curl -sS "${BASE}/textbooks?subjectId=${subjects[0].id}"`,
    );
  }

  console.log('\n---\n# PDF ingest (uses first textbook of each subject — replace PDF path)\n');
  for (const s of subjects) {
    const tb = s.textbooks[0];
    if (!tb) continue;
    console.log(`# ${s.name} class ${s.class}`);
    console.log(`curl -sS -X POST "${BASE}/rag/ingest/pdf" \\`);
    console.log(`  -F "file=@E:/path/to/your.pdf" \\`);
    console.log(`  -F "subjectId=${s.id}" \\`);
    console.log(`  -F "textbookId=${tb.id}" \\`);
    console.log(`  -F "subject=${s.name}" \\`);
    console.log(`  -F "classLevel=${s.class}" \\`);
    console.log(`  -F "chapter=Sample chapter" \\`);
    console.log(`  -F "title=${s.name} class ${s.class} sample PDF" \\`);
    console.log(`  -F "sourceType=ncert_book" \\`);
    console.log(`  -F "sourcePath=sample.pdf"`);
    console.log('');
  }

  console.log('---\n# JSON ingest (first textbook per subject; sourceText ≥ 200 chars)\n');
  for (const s of subjects) {
    const tb = s.textbooks[0];
    if (!tb) continue;
    const payload = {
      subjectId: s.id,
      textbookId: tb.id,
      subject: s.name,
      classLevel: s.class,
      chapter: 'Sample chapter',
      title: `${s.name} class ${s.class} sample text`,
      sourceType: 'ncert_book',
      sourcePath: 'sample.txt',
      sourceText: longText,
    };
    console.log(`# ${s.name} class ${s.class}`);
    console.log(
      `curl -sS -X POST "${BASE}/rag/ingest" -H "Content-Type: application/json" -d '${JSON.stringify(payload)}'`,
    );
    console.log('');
  }

  console.log('---\n# ask (first textbook per subject)\n');
  for (const s of subjects) {
    const tb = s.textbooks[0];
    if (!tb) continue;
    const payload = {
      subjectId: s.id,
      textbookId: tb.id,
      subject: s.name,
      classLevel: s.class,
      chapter: 'Sample chapter',
      question: `Sample question for ${s.name}?`,
    };
    console.log(`# ${s.name} class ${s.class}`);
    console.log(
      `curl -sS -X POST "${BASE}/rag/ask" -H "Content-Type: application/json" -d '${JSON.stringify(payload)}'`,
    );
    console.log('');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
