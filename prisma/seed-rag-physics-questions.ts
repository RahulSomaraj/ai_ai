import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { buildChunks, normalizeText } from '../src/rag/chunking';
import { embedChunksForDocument } from '../src/rag/embeddings.openai';

const prisma = new PrismaClient();

type ChapterSeed = {
  classLevel: 11 | 12;
  chapterNo: number;
  chapter: string;
  keyPoints: string[];
};

const PHYSICS_CHAPTERS: ChapterSeed[] = [
  { classLevel: 11, chapterNo: 1, chapter: 'Physical World', keyPoints: ['scope of physics', 'fundamental forces', 'models and approximations', 'scientific method', 'ethics in science'] },
  { classLevel: 11, chapterNo: 2, chapter: 'Units and Measurement', keyPoints: ['SI base units', 'dimensional analysis', 'significant figures', 'error propagation', 'precision vs accuracy'] },
  { classLevel: 11, chapterNo: 3, chapter: 'Motion in a Straight Line', keyPoints: ['position-time graph', 'velocity and acceleration', 'equations of motion', 'free fall', 'relative velocity'] },
  { classLevel: 11, chapterNo: 4, chapter: 'Motion in a Plane', keyPoints: ['vector resolution', 'projectile motion', 'uniform circular motion', 'components method', 'kinematic graphs'] },
  { classLevel: 11, chapterNo: 5, chapter: 'Laws of Motion', keyPoints: ['Newton laws', 'free body diagram', 'friction', 'pseudo force', 'connected bodies'] },
  { classLevel: 11, chapterNo: 6, chapter: 'Work, Energy and Power', keyPoints: ['work-energy theorem', 'conservative forces', 'potential energy', 'power', 'collisions'] },
  { classLevel: 11, chapterNo: 7, chapter: 'System of Particles and Rotational Motion', keyPoints: ['center of mass', 'torque', 'angular momentum', 'moment of inertia', 'rolling motion'] },
  { classLevel: 11, chapterNo: 8, chapter: 'Gravitation', keyPoints: ['universal law', 'g variation', 'escape speed', 'satellite motion', 'gravitational potential'] },
  { classLevel: 11, chapterNo: 9, chapter: 'Mechanical Properties of Solids', keyPoints: ['stress and strain', 'Young modulus', 'elastic limit', 'Poisson ratio', 'energy stored in wire'] },
  { classLevel: 11, chapterNo: 10, chapter: 'Mechanical Properties of Fluids', keyPoints: ['pressure in fluids', 'Pascal law', 'Archimedes principle', 'Bernoulli equation', 'surface tension and viscosity'] },
  { classLevel: 11, chapterNo: 11, chapter: 'Thermal Properties of Matter', keyPoints: ['temperature scales', 'thermal expansion', 'specific heat', 'calorimetry', 'heat transfer'] },
  { classLevel: 11, chapterNo: 12, chapter: 'Thermodynamics', keyPoints: ['internal energy', 'first law', 'isothermal and adiabatic', 'heat engines', 'second law'] },
  { classLevel: 11, chapterNo: 13, chapter: 'Kinetic Theory', keyPoints: ['ideal gas model', 'rms speed', 'equipartition theorem', 'mean free path', 'specific heats relation'] },
  { classLevel: 11, chapterNo: 14, chapter: 'Oscillations', keyPoints: ['SHM equation', 'phase and amplitude', 'energy in SHM', 'spring-mass system', 'simple pendulum'] },
  { classLevel: 11, chapterNo: 15, chapter: 'Waves', keyPoints: ['wave equation', 'superposition', 'standing waves', 'beats', 'Doppler effect'] },
  { classLevel: 12, chapterNo: 1, chapter: 'Electric Charges and Fields', keyPoints: ['Coulomb law', 'electric field lines', 'Gauss law', 'dipole field', 'continuous charge distribution'] },
  { classLevel: 12, chapterNo: 2, chapter: 'Electrostatic Potential and Capacitance', keyPoints: ['potential and potential energy', 'equipotential surfaces', 'capacitors', 'dielectrics', 'energy stored in capacitor'] },
  { classLevel: 12, chapterNo: 3, chapter: 'Current Electricity', keyPoints: ['drift velocity', 'Ohm law', 'Kirchhoff rules', 'Wheatstone bridge', 'meter bridge and potentiometer basics'] },
  { classLevel: 12, chapterNo: 4, chapter: 'Moving Charges and Magnetism', keyPoints: ['Lorentz force', 'Biot-Savart law', 'Ampere law', 'force on current loop', 'cyclotron principle'] },
  { classLevel: 12, chapterNo: 5, chapter: 'Magnetism and Matter', keyPoints: ['bar magnet model', 'earth magnetism', 'magnetic materials', 'hysteresis', 'applications'] },
  { classLevel: 12, chapterNo: 6, chapter: 'Electromagnetic Induction', keyPoints: ['Faraday law', 'Lenz law', 'self and mutual inductance', 'eddy currents', 'AC generator principle'] },
  { classLevel: 12, chapterNo: 7, chapter: 'Alternating Current', keyPoints: ['AC voltage and current', 'RLC circuits', 'reactance and impedance', 'power factor', 'transformer'] },
  { classLevel: 12, chapterNo: 8, chapter: 'Electromagnetic Waves', keyPoints: ['displacement current', 'spectrum', 'properties of em waves', 'sources', 'uses'] },
  { classLevel: 12, chapterNo: 9, chapter: 'Ray Optics and Optical Instruments', keyPoints: ['refraction and total internal reflection', 'lens maker formula', 'optical instruments', 'combination of lenses', 'defects of vision'] },
  { classLevel: 12, chapterNo: 10, chapter: 'Wave Optics', keyPoints: ['Huygens principle', 'interference', 'Young double slit', 'diffraction', 'polarisation'] },
  { classLevel: 12, chapterNo: 11, chapter: 'Dual Nature of Radiation and Matter', keyPoints: ['photoelectric effect', 'de Broglie wavelength', 'matter waves', 'Einstein equation', 'Davisson-Germer'] },
  { classLevel: 12, chapterNo: 12, chapter: 'Atoms', keyPoints: ['Rutherford model', 'Bohr postulates', 'spectral lines', 'energy levels', 'limitations of Bohr model'] },
  { classLevel: 12, chapterNo: 13, chapter: 'Nuclei', keyPoints: ['nuclear composition', 'binding energy', 'radioactivity', 'decay law', 'fission and fusion'] },
  { classLevel: 12, chapterNo: 14, chapter: 'Semiconductor Electronics', keyPoints: ['intrinsic and extrinsic semiconductors', 'pn junction', 'diode applications', 'transistor basics', 'logic gates'] },
];

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function buildQuestionBankText(seed: ChapterSeed): string {
  const [k1, k2, k3, k4, k5] = seed.keyPoints;
  return normalizeText(`
Question bank for Class ${seed.classLevel} Physics, Chapter ${seed.chapterNo}: ${seed.chapter}.

Q1) What is the core idea of "${seed.chapter}" and why is it important in Class ${seed.classLevel} Physics?
A1) This chapter builds conceptual foundations used repeatedly in board-style numericals and derivations. A student should learn definitions, assumptions, and standard representations before attempting mixed problems.

Q2) Explain the role of ${k1} in one paragraph with an example.
A2) ${k1} is central to problem setup. The typical method is to identify known quantities, choose a sign convention, and map the statement into equations. A quick dimensional check is useful after algebra.

Q3) How does ${k2} connect with formulas used in this chapter?
A3) ${k2} usually determines which equation is valid and what approximations are allowed. In subjective answers, state the condition first, then derive or substitute carefully.

Q4) Write a short exam-style answer on ${k3}.
A4) The expected answer includes definition, governing relation, unit or graph when relevant, and one practical implication. Keep it structured in 4 to 6 lines.

Q5) What common mistakes happen while solving questions on ${k4}?
A5) Students often mix sign conventions, skip unit conversion, or apply equations outside validity conditions. Correct approach: write assumptions, isolate the target variable, and verify limiting cases.

Q6) How do we apply ${k5} to numericals?
A6) Start from a clean diagram, list symbols with units, use consistent SI values, and keep intermediate steps readable. Final answer should include unit and a quick reasonableness check.

Q7) Give a one-minute revision plan for this chapter.
A7) Revise definitions, 5 key formulas, graph/diagram interpretation, and two representative solved examples (one conceptual, one numerical). Then attempt one timed question.

Q8) What should be written in long-answer questions to maximize marks?
A8) Mention principle, derive relation with steps, state assumptions, and conclude with application or edge case. Avoid formula dumping without explanation.
`);
}

async function upsertChapterQuestionDoc(seed: ChapterSeed): Promise<number> {
  const docId = `seed-rag-phy${seed.classLevel}-q-${String(seed.chapterNo).padStart(2, '0')}-${slugify(seed.chapter)}`;
  const sourceText = buildQuestionBankText(seed);
  const chunks = buildChunks(sourceText);

  await prisma.$transaction(async (tx) => {
    await tx.ragChunk.deleteMany({ where: { documentId: docId } });
    await tx.ragDocument.deleteMany({ where: { id: docId } });

    await tx.ragDocument.create({
      data: {
        id: docId,
        title: `Class ${seed.classLevel} Physics Q&A - ${seed.chapter}`,
        subject: 'Physics',
        classLevel: seed.classLevel,
        chapter: seed.chapter,
        sourceType: 'seed_questions',
        sourcePath: `seed/questions/physics${seed.classLevel}/${String(seed.chapterNo).padStart(2, '0')}-${slugify(seed.chapter)}.txt`,
      },
    });

    await tx.ragChunk.createMany({
      data: chunks.map((c) => ({
        documentId: docId,
        chunkIndex: c.chunkIndex,
        content: c.content,
        tokenCount: c.tokenCount,
        pageNo: null,
        section: 'question_bank',
      })),
    });
  });

  const apiKey = process.env.OPENAI_API_KEY ?? '';
  const embedModel = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small';
  if (apiKey) {
    await embedChunksForDocument(prisma, apiKey, embedModel, docId);
  }

  return chunks.length;
}

async function main() {
  const results: Array<{ classLevel: number; chapter: string; chunks: number }> = [];

  for (const seed of PHYSICS_CHAPTERS) {
    const chunks = await upsertChapterQuestionDoc(seed);
    results.push({ classLevel: seed.classLevel, chapter: seed.chapter, chunks });
  }

  if (!process.env.OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY not set. Seeded documents/chunks only; embeddings were skipped.');
  }

  console.log('Physics question-bank seed completed for all Class 11 and 12 chapters.');
  console.table(results);
}

main()
  .catch((error) => {
    console.error('Physics question-bank seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
