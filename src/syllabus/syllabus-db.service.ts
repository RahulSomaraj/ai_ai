import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSyllabusDto } from './dto/syllabus.dto';

/**
 * Postgres-backed syllabus store.
 *
 * The legacy {@link SyllabusService} keeps file-based JSON syllabi for backward
 * compatibility. This service makes the syllabus first-class in the database so
 * it can drive RAG retrieval: units and topics are persisted and scoped to a
 * Subject (subject name + class), and RagChunks can then be tagged with a
 * `topicId` for syllabus-controlled answering.
 */
@Injectable()
export class SyllabusDbService {
  private readonly logger = new Logger(SyllabusDbService.name);

  constructor(private readonly prisma: PrismaService) {}

  private parseGradeToClass(grade: string): number {
    const parsed = parseInt(String(grade).trim(), 10);
    if (Number.isNaN(parsed) || parsed < 1 || parsed > 12) {
      throw new BadRequestException(
        `Invalid grade "${grade}". Expected a class number between 1 and 12.`,
      );
    }
    return parsed;
  }

  /**
   * Find or create the Subject row that a syllabus attaches to.
   * Matches on (name, class) case-insensitively to avoid duplicates.
   */
  private async resolveSubject(name: string, classLevel: number) {
    const trimmed = name.trim();
    const existing = await this.prisma.subject.findFirst({
      where: {
        class: classLevel,
        name: { equals: trimmed, mode: 'insensitive' },
      },
    });
    if (existing) {
      return existing;
    }
    const created = await this.prisma.subject.create({
      data: { name: trimmed, class: classLevel },
    });
    this.logger.log(
      `Created subject "${created.name}" (class ${created.class}) for syllabus import.`,
    );
    return created;
  }

  /**
   * Import (upsert) a syllabus into Postgres. Units and topics are matched by
   * their syllabus codes (unit_id / topic_id) within the subject, so re-importing
   * an updated syllabus is idempotent and updates names/outcomes in place.
   *
   * NOTE: changing a topic's name or learning outcomes does NOT re-embed it.
   * Re-run POST /rag/topics/embed and /rag/topics/map afterwards to refresh
   * topic vectors and chunk assignments.
   */
  async importSyllabus(dto: CreateSyllabusDto) {
    const classLevel = this.parseGradeToClass(dto.grade);
    const subject = await this.resolveSubject(dto.subject, classLevel);

    let unitsUpserted = 0;
    let topicsUpserted = 0;

    for (const [unitIndex, unit] of (dto.units ?? []).entries()) {
      const unitRow = await this.prisma.unit.upsert({
        where: {
          subjectId_code: { subjectId: subject.id, code: unit.unit_id },
        },
        create: {
          subjectId: subject.id,
          code: unit.unit_id,
          name: unit.unit_name,
          order: unitIndex,
        },
        update: {
          name: unit.unit_name,
          order: unitIndex,
        },
      });
      unitsUpserted += 1;

      for (const [topicIndex, topic] of (unit.topics ?? []).entries()) {
        await this.prisma.topic.upsert({
          where: {
            unitId_code: { unitId: unitRow.id, code: topic.topic_id },
          },
          create: {
            unitId: unitRow.id,
            code: topic.topic_id,
            name: topic.topic_name,
            learningOutcomes: topic.learning_outcomes ?? [],
            order: topicIndex,
          },
          update: {
            name: topic.topic_name,
            learningOutcomes: topic.learning_outcomes ?? [],
            order: topicIndex,
          },
        });
        topicsUpserted += 1;
      }
    }

    this.logger.log(
      `Imported syllabus for ${subject.name} (class ${subject.class}): ` +
        `${unitsUpserted} unit(s), ${topicsUpserted} topic(s).`,
    );

    return {
      status: 'imported',
      subjectId: subject.id,
      subject: subject.name,
      classLevel: subject.class,
      board: dto.board,
      version: dto.version,
      unitsUpserted,
      topicsUpserted,
    };
  }

  /** List units + topics for a subject, ordered as imported. */
  async getStructure(subjectId: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
      include: {
        units: {
          orderBy: { order: 'asc' },
          include: {
            topics: { orderBy: { order: 'asc' } },
          },
        },
      },
    });

    if (!subject) {
      throw new NotFoundException(`Subject with ID ${subjectId} not found.`);
    }

    return {
      subjectId: subject.id,
      subject: subject.name,
      classLevel: subject.class,
      units: subject.units.map((u) => ({
        id: u.id,
        code: u.code,
        name: u.name,
        topics: u.topics.map((t) => ({
          id: t.id,
          code: t.code,
          name: t.name,
          learningOutcomes: t.learningOutcomes,
        })),
      })),
    };
  }

  /** Flat list of topics for a subject (handy for pickers / mapping review). */
  async getTopics(subjectId: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
      select: { id: true },
    });
    if (!subject) {
      throw new NotFoundException(`Subject with ID ${subjectId} not found.`);
    }

    return this.prisma.topic.findMany({
      where: { unit: { subjectId } },
      orderBy: [{ unit: { order: 'asc' } }, { order: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        learningOutcomes: true,
        unit: { select: { id: true, code: true, name: true } },
      },
    });
  }

  /**
   * Resolve syllabus unit/topic codes to internal Topic UUIDs within a subject
   * scope. Used by RAG retrieval to translate a client-supplied topicCode/unitCode
   * filter into concrete chunk topic_ids. Returns null when no codes are supplied.
   */
  async resolveTopicIds(params: {
    subjectId?: string | null;
    subjectName?: string | null;
    classLevel: number;
    topicCode?: string | null;
    unitCode?: string | null;
  }): Promise<string[] | null> {
    const { subjectId, subjectName, classLevel, topicCode, unitCode } = params;
    if (!topicCode && !unitCode) {
      return null;
    }

    // Resolve the subject scope first.
    let resolvedSubjectId = subjectId?.trim() || null;
    if (!resolvedSubjectId && subjectName) {
      const subject = await this.prisma.subject.findFirst({
        where: {
          class: classLevel,
          name: { equals: subjectName.trim(), mode: 'insensitive' },
        },
        select: { id: true },
      });
      resolvedSubjectId = subject?.id ?? null;
    }

    if (!resolvedSubjectId) {
      throw new BadRequestException(
        'topicCode/unitCode filtering requires a resolvable subject (send subjectId, or subject + classLevel).',
      );
    }

    const topics = await this.prisma.topic.findMany({
      where: {
        // Merge subject scope and optional unit-code filter under a single `unit`
        // key so one does not overwrite the other.
        unit: {
          subjectId: resolvedSubjectId,
          ...(unitCode ? { code: unitCode.trim() } : {}),
        },
        ...(topicCode ? { code: topicCode.trim() } : {}),
      },
      select: { id: true },
    });

    if (!topics.length) {
      throw new NotFoundException(
        `No syllabus topics matched ${
          topicCode ? `topicCode="${topicCode}"` : ''
        }${topicCode && unitCode ? ' and ' : ''}${
          unitCode ? `unitCode="${unitCode}"` : ''
        } for the requested subject.`,
      );
    }

    return topics.map((t) => t.id);
  }
}
