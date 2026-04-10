import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type SeedTextbook = {
  title: string;
  order: number;
  code?: string;
};

type SeedSubject = {
  name: string;
  class: number;
  textbooks: SeedTextbook[];
};

const seedSubjects: SeedSubject[] = [
  {
    name: 'Physics',
    class: 11,
    textbooks: [
      { title: 'Physics Part 1', order: 1, code: 'PHY11-P1' },
      { title: 'Physics Part 2', order: 2, code: 'PHY11-P2' },
    ],
  },
  {
    name: 'Chemistry',
    class: 11,
    textbooks: [
      { title: 'Chemistry Part 1', order: 1, code: 'CHE11-P1' },
      { title: 'Chemistry Part 2', order: 2, code: 'CHE11-P2' },
    ],
  },
  {
    name: 'Mathematics',
    class: 11,
    textbooks: [
      { title: 'Mathematics', order: 1, code: 'MAT11' },
    ],
  },
  {
    name: 'Biology',
    class: 11,
    textbooks: [
      { title: 'Biology', order: 1, code: 'BIO11' },
    ],
  },
  {
    name: 'Physics',
    class: 12,
    textbooks: [
      { title: 'Physics Part 1', order: 1, code: 'PHY12-P1' },
      { title: 'Physics Part 2', order: 2, code: 'PHY12-P2' },
    ],
  },
  {
    name: 'Chemistry',
    class: 12,
    textbooks: [
      { title: 'Chemistry Part 1', order: 1, code: 'CHE12-P1' },
      { title: 'Chemistry Part 2', order: 2, code: 'CHE12-P2' },
    ],
  },
  {
    name: 'Mathematics',
    class: 12,
    textbooks: [
      { title: 'Mathematics Part 1', order: 1, code: 'MAT12-P1' },
      { title: 'Mathematics Part 2', order: 2, code: 'MAT12-P2' },
    ],
  },
  {
    name: 'Biology',
    class: 12,
    textbooks: [
      { title: 'Biology', order: 1, code: 'BIO12' },
    ],
  },
];

async function upsertSubjectAndTextbooks(subjectSeed: SeedSubject) {
  const subject = await prisma.subject.upsert({
    where: {
      id: `seed-${subjectSeed.class}-${subjectSeed.name.toLowerCase()}`,
    },
    update: {
      name: subjectSeed.name,
      class: subjectSeed.class,
    },
    create: {
      id: `seed-${subjectSeed.class}-${subjectSeed.name.toLowerCase()}`,
      name: subjectSeed.name,
      class: subjectSeed.class,
    },
  });

  for (const textbook of subjectSeed.textbooks) {
    const textbookId = `seed-${subjectSeed.class}-${subjectSeed.name.toLowerCase()}-tb${textbook.order}`;

    await prisma.textbook.upsert({
      where: {
        subjectId_order: {
          subjectId: subject.id,
          order: textbook.order,
        },
      },
      create: {
        id: textbookId,
        subjectId: subject.id,
        title: textbook.title,
        order: textbook.order,
        code: textbook.code,
        source: 'NCERT',
      },
      update: {
        title: textbook.title,
        code: textbook.code,
        source: 'NCERT',
      },
    });
  }
}

async function main() {
  for (const subject of seedSubjects) {
    await upsertSubjectAndTextbooks(subject);
  }

  const totals = await prisma.subject.groupBy({
    by: ['class'],
    _count: { _all: true },
    where: { class: { in: [11, 12] } },
    orderBy: { class: 'asc' },
  });

  const sampleBooks = await prisma.textbook.findMany({
    where: { subjectId: 'seed-11-physics' },
    select: { id: true, title: true, order: true },
    orderBy: { order: 'asc' },
  });

  console.log('Seed completed for class 11 and 12.');
  console.log('Subject totals by class:', totals);
  console.log(
    'Example textbookId values (Class 11 Physics — use in RAG / curl):',
    sampleBooks,
  );
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
