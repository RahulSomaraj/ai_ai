import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { buildChunks, normalizeText } from '../src/rag/chunking';
import { embedChunksForDocument } from '../src/rag/embeddings.openai';

const prisma = new PrismaClient();

type TopicSeed = {
  id: string;
  subject: 'Physics' | 'Chemistry';
  classLevel: 12;
  title: string;
  chapter: string;
  sourcePath: string;
  sourceText: string;
};

const SCIENCE_12_TOPICS: TopicSeed[] = [
  {
    id: 'seed-rag-phy12-01-electrostatics',
    subject: 'Physics',
    classLevel: 12,
    title: 'Class 12 Physics - Electric Charges and Fields',
    chapter: 'Electric Charges and Fields',
    sourcePath: 'seed/physics12/01-electric-charges-and-fields.txt',
    sourceText: `
Electrostatics studies charges at rest and the forces between them. Like charges repel and unlike charges attract. Coulomb's law gives the magnitude of force between two point charges as directly proportional to the product of their charges and inversely proportional to the square of distance between them. The force acts along the line joining the charges.

Electric field is the force per unit positive test charge. Field lines start from positive charges and end on negative charges, and the tangent at any point gives field direction. For multiple charges, fields add vectorially using superposition. This principle helps solve multi-charge geometry problems.

Gauss's law connects electric flux through a closed surface with net enclosed charge. It is especially useful for high-symmetry systems like spherical shells, infinitely long wires, and infinite planes. Exam questions often test not only formulas but also when symmetry arguments are valid.
`.trim(),
  },
  {
    id: 'seed-rag-phy12-02-gauss-law-applications',
    subject: 'Physics',
    classLevel: 12,
    title: 'Class 12 Physics - Gauss Law Applications',
    chapter: 'Electric Charges and Fields',
    sourcePath: 'seed/physics12/02-gauss-law-applications.txt',
    sourceText: `
Gauss law is most effective when charge distribution has high symmetry. For a spherical shell, field outside behaves as if total charge is concentrated at the center, while field inside an ideal shell is zero. For a uniformly charged sphere, field inside varies linearly with distance from center.

For an infinitely long line charge, a cylindrical Gaussian surface helps derive the radial electric field dependence. For an infinite plane sheet of charge, field remains uniform and independent of distance on either side. Superposition combines fields from multiple sheets or layered distributions.

Students should identify symmetry first, choose Gaussian surface second, and then evaluate flux with clear area-vector direction. Mistakes usually occur when the enclosed charge is computed incorrectly or when surfaces without symmetry are forced into Gauss-law shortcuts.
`.trim(),
  },
  {
    id: 'seed-rag-phy12-03-electrostatic-potential-capacitance',
    subject: 'Physics',
    classLevel: 12,
    title: 'Class 12 Physics - Electrostatic Potential and Capacitance',
    chapter: 'Electrostatic Potential and Capacitance',
    sourcePath: 'seed/physics12/03-electrostatic-potential-capacitance.txt',
    sourceText: `
Electrostatic potential at a point is work done per unit positive charge in bringing it from infinity to that point. Potential is a scalar and adds algebraically, which often simplifies calculations compared with vector field addition. Potential difference drives charge movement in circuits later.

Equipotential surfaces are always perpendicular to electric field lines. No work is done when a test charge moves along an equipotential path. Relation between electric field and potential gradient explains why stronger fields correspond to faster potential change over distance.

Capacitance measures charge storage per unit potential difference. Parallel plate capacitor formulas are foundational and are modified by dielectric insertion, plate separation change, and area variation. Energy stored in a capacitor can be expressed in multiple equivalent forms that are frequently tested numerically.
`.trim(),
  },
  {
    id: 'seed-rag-phy12-04-dielectrics-and-capacitor-combinations',
    subject: 'Physics',
    classLevel: 12,
    title: 'Class 12 Physics - Dielectrics and Capacitor Combinations',
    chapter: 'Electrostatic Potential and Capacitance',
    sourcePath: 'seed/physics12/04-dielectrics-and-combinations.txt',
    sourceText: `
Dielectrics reduce effective electric field inside a capacitor and increase capacitance by polarization effects. Relative permittivity compares capacitance with and without dielectric material. Understanding bound charges and polarization direction helps in conceptual board questions.

Capacitors in series have the same charge and split voltage, leading to lower equivalent capacitance than the smallest element. Capacitors in parallel share voltage and add charges, giving a larger equivalent capacitance than any individual capacitor. Mixed networks are solved stepwise by reducing simpler blocks.

When connected to a battery, charge can change while voltage remains fixed. In isolated configurations, charge remains fixed while voltage changes with geometry or dielectric insertion. These condition-based distinctions are central to many assertion-reason and case-study style questions.
`.trim(),
  },
  {
    id: 'seed-rag-phy12-05-current-electricity',
    subject: 'Physics',
    classLevel: 12,
    title: 'Class 12 Physics - Current Electricity',
    chapter: 'Current Electricity',
    sourcePath: 'seed/physics12/05-current-electricity.txt',
    sourceText: `
Current is the rate of flow of charge through a cross-section. In conductors, free electrons drift with a small average drift velocity under an electric field. Ohm's law states that current is proportional to potential difference across a conductor for constant physical conditions.

Resistance depends on material, length, and area. Resistivity is an intrinsic property that changes with temperature. Cells and batteries are modeled with emf and internal resistance, leading to terminal voltage drop when current flows. This is a common board-level numerical theme.

Kirchhoff's current and voltage rules are used to solve complex circuits. Bridge circuits, potentiometer applications, and meter bridge setups frequently appear in practical or case-based questions. Strong diagram labeling and sign convention reduce algebra mistakes significantly.
`.trim(),
  },
  {
    id: 'seed-rag-phy12-06-ray-optics',
    subject: 'Physics',
    classLevel: 12,
    title: 'Class 12 Physics - Ray Optics and Optical Instruments',
    chapter: 'Ray Optics and Optical Instruments',
    sourcePath: 'seed/physics12/06-ray-optics.txt',
    sourceText: `
Ray optics explains light behavior through reflection and refraction models. Snell's law relates angles and refractive indices across media. Total internal reflection happens when light moves from denser to rarer medium with incidence angle greater than critical angle.

Spherical mirrors and thin lenses are solved with sign conventions and formula-based image relations. Magnification and focal length interpretations are crucial for conceptual questions. Lens-maker relation and power of lens are often linked with practical vision correction.

Optical instruments such as microscope and telescope are analyzed using angular magnification. Human eye defects like myopia, hypermetropia, and presbyopia are corrected with suitable lenses. Board answers score better when ray diagrams are neat and assumptions are explicit.
`.trim(),
  },
  {
    id: 'seed-rag-phy12-07-spherical-mirrors',
    subject: 'Physics',
    classLevel: 12,
    title: 'Class 12 Physics - Spherical Mirrors and Sign Convention',
    chapter: 'Ray Optics and Optical Instruments',
    sourcePath: 'seed/physics12/07-spherical-mirrors.txt',
    sourceText: `
Spherical mirrors are of two types: concave and convex. Image formation is analyzed with principal axis, focus, center of curvature, and pole. The mirror formula and magnification relation are applied with Cartesian sign convention where distances measured in the direction of incident light are treated with a consistent sign rule.

Ray diagrams provide quick conceptual checks for image nature, size, and orientation. Concave mirrors can form real inverted images or virtual magnified images depending on object position. Convex mirrors always form virtual, erect, and diminished images, which is why they are used as rear-view mirrors.

Typical numerical mistakes include mixing focal length signs and incorrect substitution for object distance. Strong solutions write sign convention first, then substitute values with units, and finally verify whether the computed image type matches ray-diagram expectation.
`.trim(),
  },
  {
    id: 'seed-rag-phy12-08-refraction-through-lenses',
    subject: 'Physics',
    classLevel: 12,
    title: 'Class 12 Physics - Refraction Through Lenses',
    chapter: 'Ray Optics and Optical Instruments',
    sourcePath: 'seed/physics12/08-refraction-through-lenses.txt',
    sourceText: `
Lenses refract light to converge or diverge rays based on shape and refractive index. Convex lenses are converging while concave lenses are diverging in air. Thin lens formula, magnification relation, and lens power are used together in board-style numericals.

Lens-maker formula links focal length with refractive index and surface curvatures. Combination of thin lenses in contact has additive power, and equivalent focal length follows directly from total power. This is a common area for multi-step numerical questions.

Sign convention and direction of light are essential for correct answers. Students should check image location, size, and whether result is physically valid for the given object position. Diagram support often improves marks in subjective answers.
`.trim(),
  },
  {
    id: 'seed-rag-phy12-09-optical-instruments',
    subject: 'Physics',
    classLevel: 12,
    title: 'Class 12 Physics - Optical Instruments',
    chapter: 'Ray Optics and Optical Instruments',
    sourcePath: 'seed/physics12/09-optical-instruments.txt',
    sourceText: `
Optical instruments extend the resolving and magnifying capability of the human eye. A simple microscope uses a convex lens to produce a magnified virtual image at near point or infinity. Angular magnification expressions differ depending on final image position.

Compound microscope and astronomical telescope involve objective and eyepiece combinations. Their magnifying power depends on focal lengths and tube length in standard approximations. Conceptual questions often ask why large focal-length objective is preferred in telescopes and short focal-length eyepiece gives better magnification.

Final board responses should include labeled diagrams, assumptions, and the condition used for magnifying power formula. Students should also mention practical limits such as aberrations and finite resolving power of optical systems.
`.trim(),
  },
  {
    id: 'seed-rag-phy12-10-defects-of-vision',
    subject: 'Physics',
    classLevel: 12,
    title: 'Class 12 Physics - Human Eye and Defects of Vision',
    chapter: 'Ray Optics and Optical Instruments',
    sourcePath: 'seed/physics12/10-defects-of-vision.txt',
    sourceText: `
The human eye forms images on the retina through refraction by cornea and eye lens. Accommodation changes focal length to focus near and far objects. Normal near point and far point values are important reference points in textbook numericals.

Myopia, hypermetropia, and presbyopia are corrected by appropriate lenses. Myopia is corrected with concave lenses, hypermetropia with convex lenses, and presbyopia may require bifocal or progressive correction depending on combined defects. Power calculation follows the lens formula with suitable sign convention.

Ray diagrams are essential for explaining each defect and correction mechanism. Many students lose marks by memorizing only lens type without the optical reason. High-scoring answers state defective image position first, then show how corrective lens shifts image onto retina.
`.trim(),
  },
  {
    id: 'seed-rag-che12-01-solid-state',
    subject: 'Chemistry',
    classLevel: 12,
    title: 'Class 12 Chemistry - The Solid State',
    chapter: 'The Solid State',
    sourcePath: 'seed/chemistry12/01-solid-state.txt',
    sourceText: `
Solid state chemistry classifies solids as crystalline or amorphous. Crystalline solids have long-range order and sharp melting points, while amorphous solids lack periodic arrangement and soften over a range of temperatures. Unit cell parameters define the repeating structure.

Packing efficiency, coordination number, and voids are central ideas in numerical questions. Simple cubic, body-centered cubic, and face-centered cubic structures are compared through atom count per unit cell and nearest-neighbor geometry. Density calculations connect microscopic arrangement with measurable bulk properties.

Point defects such as Schottky and Frenkel defects affect electrical and density behavior. Doping changes conductivity in semiconductors, which links this chapter with electronic materials. Good exam answers combine structure diagrams with concise statements of property changes.
`.trim(),
  },
  {
    id: 'seed-rag-che12-02-chemical-kinetics',
    subject: 'Chemistry',
    classLevel: 12,
    title: 'Class 12 Chemistry - Chemical Kinetics',
    chapter: 'Chemical Kinetics',
    sourcePath: 'seed/chemistry12/02-chemical-kinetics.txt',
    sourceText: `
Chemical kinetics studies reaction rates and factors affecting them. Rate depends on concentration, temperature, catalyst, and surface area in heterogeneous systems. The rate law expresses how rate changes with concentration terms raised to reaction orders.

Order and molecularity are different concepts. Order comes from experimental rate law; molecularity applies to elementary steps only. Integrated rate equations for zero and first order reactions are routinely used to compute concentration-time relations and half-life.

Arrhenius equation explains temperature dependence of rate constant through activation energy. A catalyst lowers activation energy path without changing overall equilibrium. Board-style numericals often require graph interpretation, unit consistency, and identification of reaction order from data.
`.trim(),
  },
  {
    id: 'seed-rag-che12-03-coordination-compounds',
    subject: 'Chemistry',
    classLevel: 12,
    title: 'Class 12 Chemistry - Coordination Compounds',
    chapter: 'Coordination Compounds',
    sourcePath: 'seed/chemistry12/03-coordination-compounds.txt',
    sourceText: `
Coordination compounds contain a central metal atom or ion surrounded by ligands that donate electron pairs. Primary and secondary valencies explain oxidation state and coordination number. Nomenclature rules are systematic and frequently tested in one-mark and short-answer formats.

Isomerism in coordination compounds includes structural isomerism and stereoisomerism. Geometrical and optical isomerism depend on ligand arrangement and complex geometry. Students should practice writing formulas and identifying possible isomers for common square planar and octahedral cases.

Werner's theory and crystal field concepts explain magnetic behavior and color trends in complexes. Applications include analytical chemistry, metallurgy, and biological systems like hemoglobin. Strong exam responses link theory with one real-life complex example.
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
        subject: topic.subject,
        classLevel: topic.classLevel,
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
  const results: Array<{ subject: string; chapter: string; chunks: number }> = [];

  for (const topic of SCIENCE_12_TOPICS) {
    const { chunkCount } = await upsertTopic(topic);
    results.push({ subject: topic.subject, chapter: topic.chapter, chunks: chunkCount });
  }

  const apiKey = process.env.OPENAI_API_KEY ?? '';
  const embedModel = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small';
  if (apiKey) {
    for (const topic of SCIENCE_12_TOPICS) {
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
      'OPENAI_API_KEY not set - seeded documents/chunks only. Set key and rerun to create embeddings.',
    );
  }

  console.log('Class 12 Physics/Chemistry RAG topic seed completed.');
  console.table(results);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
