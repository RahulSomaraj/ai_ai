/**
 * Seeds sample RAG documents + chunks for Class 11 Physics (NCERT-style topic notes).
 * Idempotent: re-run replaces chunks for the same seed document ids.
 *
 * Usage: npx ts-node prisma/seed-rag-physics11.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { buildChunks, normalizeText } from '../src/rag/chunking';
import { embedChunksForDocument } from '../src/rag/embeddings.openai';

const prisma = new PrismaClient();

const SUBJECT = 'Physics';
const CLASS_LEVEL = 11;

type TopicSeed = {
  id: string;
  title: string;
  chapter: string;
  sourcePath: string;
  /** Study-note style text (not verbatim NCERT); must chunk to ≥1 chunk after normalize. */
  sourceText: string;
};

const PHYSICS_11_TOPICS: TopicSeed[] = [
  {
    id: 'seed-rag-phy11-01-units',
    title: 'Class 11 Physics — Units and Measurement',
    chapter: 'Units and Measurement',
    sourcePath: 'seed/physics11/01-units-and-measurement.txt',
    sourceText: `
The International System of Units (SI) defines seven base quantities: length (metre), mass (kilogram), time (second), electric current (ampere), thermodynamic temperature (kelvin), amount of substance (mole), and luminous intensity (candela). Derived units are expressed as products or ratios of base units; for example, force is the newton (kg·m·s⁻²).

A physical quantity has a dimension: the powers to which base quantities must be raised. Dimensional analysis checks whether an equation is consistent: quantities added or equated must have the same dimensions. Dimensionless quantities can be pure numbers or ratios of quantities with the same dimensions.

Measurement always involves uncertainty. Random errors fluctuate about a mean and can be reduced by repeated observations. Systematic errors shift results in one direction and require calibration or method changes. Precision describes repeatability; accuracy describes closeness to the true value. Significant figures communicate precision: the least precise measurement limits the precision of a computed result.

When combining measurements, absolute uncertainty propagates according to the operation. For addition or subtraction, absolute uncertainties add in quadrature in many lab rules; for multiplication or division, relative (fractional) uncertainties combine. Always state units and uncertainty with measured values in lab reports.
`.trim(),
  },
  {
    id: 'seed-rag-phy11-02-kinematics',
    title: 'Class 11 Physics — Motion in a Straight Line',
    chapter: 'Motion in a Straight Line',
    sourcePath: 'seed/physics11/02-kinematics.txt',
    sourceText: `
Kinematics describes motion without asking about causes. For motion along a line, position x(t), velocity v = dx/dt, and acceleration a = dv/dt are the core quantities. Average velocity is displacement divided by elapsed time; instantaneous velocity is the slope of the position–time graph at a point.

For uniform acceleration, the standard relations connect v, u, a, t, and s: v = u + at, s = ut + ½at², and v² = u² + 2as. Graphical interpretation helps: on a v–t graph, displacement is the signed area under the curve; on an x–t graph, slope gives velocity.

Free fall near Earth’s surface is a common model with a ≈ g downward when upward is taken positive. Sign conventions must stay consistent through a problem. Relative motion uses vector addition of velocities in one dimension by careful sign choice.

Problems often mix stages: accelerated motion followed by constant velocity, or two objects meeting. Drawing diagrams, choosing an origin, and writing equations for each phase reduces mistakes. Always verify dimensions and limiting cases (e.g., a → 0 should recover uniform motion).
`.trim(),
  },
  {
    id: 'seed-rag-phy11-03-vectors',
    title: 'Class 11 Physics — Motion in a Plane',
    chapter: 'Motion in a Plane',
    sourcePath: 'seed/physics11/03-vectors-and-projectile.txt',
    sourceText: `
Vectors have magnitude and direction; scalars have magnitude only. In two dimensions, a vector can be written using unit vectors î and ĵ along perpendicular axes. Addition follows the triangle or parallelogram rule; components add separately: Rₓ = Aₓ + Bₓ and Rᵧ = Aᵧ + Bᵧ.

The scalar product A·B = AB cos θ projects one vector onto another and is useful for work and for testing perpendicularity (dot product zero). The magnitude of a vector from components is √(Aₓ² + Aᵧ²). Direction is given by tan⁻¹(Aᵧ/Aₓ) with quadrant attention.

Projectile motion splits into independent horizontal and vertical motions when air resistance is neglected. Horizontal velocity is constant; vertical motion is uniformly accelerated with a = −g if upward is positive. Range, time of flight, and maximum height formulas follow from these split equations. Uniform circular motion introduces centripetal acceleration toward the centre, with magnitude v²/r even when speed is constant, because velocity direction changes.

Choosing axes to align with acceleration or initial velocity often simplifies algebra. Always check that final answers have correct units and behave sensibly when parameters change.
`.trim(),
  },
  {
    id: 'seed-rag-phy11-04-laws-of-motion',
    title: 'Class 11 Physics — Laws of Motion',
    chapter: 'Laws of Motion',
    sourcePath: 'seed/physics11/04-newton-laws.txt',
    sourceText: `
Newton’s first law states that bodies maintain their state of rest or uniform straight-line motion unless a net external force acts. Inertia is the tendency to resist change in motion; mass measures inertia in linear motion.

Newton’s second law relates net force to rate of change of momentum: F = dp/dt. For constant mass, F = ma. Forces are vectors; net force is the vector sum of all forces on the body. Free-body diagrams isolate one object and show every force acting on it, not forces the object exerts on others.

Newton’s third law says forces occur in pairs: if body A exerts force F on body B, then B exerts −F on A. These forces act on different bodies and never cancel when analysing a single object. Common pairs include contact forces, tension, spring forces, friction, weight, and normal reaction.

Friction can be static or kinetic; static friction adjusts up to a limit proportional to normal force. Rolling and fluid drag add more models at higher level. Applying Newton’s laws to connected bodies, pulleys, and inclines requires consistent coordinate choice and careful accounting of constraint relations between accelerations.
`.trim(),
  },
  {
    id: 'seed-rag-phy11-05-work-energy',
    title: 'Class 11 Physics — Work, Energy and Power',
    chapter: 'Work, Energy and Power',
    sourcePath: 'seed/physics11/05-work-energy-power.txt',
    sourceText: `
Work by a constant force is W = F·s = Fs cos θ, where θ is the angle between force and displacement. Work can be positive, negative, or zero. The work–energy theorem states that the net work on a particle equals the change in its kinetic energy: W_net = ΔK.

Kinetic energy is K = ½mv² for non-relativistic speeds. Potential energy belongs to systems (e.g., Earth–mass near the surface: U = mgh with a chosen zero). Conservative forces allow potential energy to be defined so that work done depends only on endpoints, not path. Mechanical energy E = K + U is conserved if only conservative forces do work.

Power is the rate of doing work: P = dW/dt = F·v for a force acting on a moving object. Average power is total work divided by time interval. Units: watt = joule per second.

Collisions are analysed with momentum conservation when external impulses are negligible. Elastic collisions conserve kinetic energy as well; inelastic collisions do not, but momentum may still be conserved for the system considered. Coefficient of restitution relates relative speeds along the line of impact for simple cases.
`.trim(),
  },
  {
    id: 'seed-rag-phy11-06-gravitation',
    title: 'Class 11 Physics — Gravitation',
    chapter: 'Gravitation',
    sourcePath: 'seed/physics11/06-gravitation.txt',
    sourceText: `
Newton’s law of universal gravitation states that two point masses attract along the line joining them with magnitude F = G m₁ m₂ / r², where G is the gravitational constant. For spherically symmetric bodies, external fields behave as if mass were concentrated at the centre.

Near Earth’s surface, weight mg is the gravitational force when mass m is small compared with Earth. The acceleration due to gravity g decreases slightly with altitude and varies with latitude because of rotation and Earth’s shape; for many problems g is taken as constant near the surface.

Gravitational potential energy for two masses is U = −G m₁ m₂ / r with zero at infinite separation. Escape speed from a spherical body of radius R and mass M is √(2GM/R), the speed needed for total mechanical energy to be non-negative at launch without further propulsion.

Satellite motion in circular orbits balances gravitational attraction with centripetal requirement: v²/r = GM/r² for speed v at radius r. Kepler’s laws describe planetary motion and follow from inverse-square gravitation for the two-body problem under simplifying assumptions. Energy in bound orbits is negative; more negative means tighter, lower orbits for a given primary mass.
`.trim(),
  },
];

async function upsertTopic(topic: TopicSeed): Promise<{ chunkCount: number }> {
  const clean = normalizeText(topic.sourceText);
  if (clean.length < 200) {
    throw new Error(`Topic ${topic.id}: sourceText too short after normalize.`);
  }

  const built = buildChunks(clean);
  if (!built.length) {
    throw new Error(`Topic ${topic.id}: no chunks produced.`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.ragChunk.deleteMany({ where: { documentId: topic.id } });
    await tx.ragDocument.deleteMany({ where: { id: topic.id } });

    await tx.ragDocument.create({
      data: {
        id: topic.id,
        title: topic.title,
        subject: SUBJECT,
        classLevel: CLASS_LEVEL,
        chapter: topic.chapter,
        exercise: null,
        sourceType: 'seed_topic',
        sourcePath: topic.sourcePath,
      },
    });

    await tx.ragChunk.createMany({
      data: built.map((c) => ({
        documentId: topic.id,
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
  const results: { id: string; chapter: string; chunks: number }[] = [];

  for (const topic of PHYSICS_11_TOPICS) {
    const { chunkCount } = await upsertTopic(topic);
    results.push({ id: topic.id, chapter: topic.chapter, chunks: chunkCount });
  }

  const apiKey = process.env.OPENAI_API_KEY ?? '';
  const embedModel = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small';
  if (apiKey) {
    for (const topic of PHYSICS_11_TOPICS) {
      const n = await embedChunksForDocument(
        prisma,
        apiKey,
        embedModel,
        topic.id,
      );
      console.log(`Indexed embeddings: ${n} chunks for ${topic.id}`);
    }
  } else {
    console.warn(
      'OPENAI_API_KEY not set — skipped chunk_embeddings. Set the key and run: npm run prisma:seed:rag-physics11',
    );
  }

  console.log('Physics 11 RAG topic seed completed.');
  console.table(results);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
