import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PDFParse } from 'pdf-parse';
import { PrismaService } from '../prisma/prisma.service';
import { SyllabusDbService } from '../syllabus/syllabus-db.service';
import { AskRagDto } from './dto/ask-rag.dto';
import { IngestRagPdfDto } from './dto/ingest-rag-pdf.dto';
import { IngestRagDto } from './dto/ingest-rag.dto';
import { EmbedTopicsDto, MapTopicsDto } from './dto/map-topics.dto';
import {
  embedChunksForDocument,
  fetchEmbeddings,
  vectorToPgLiteral,
} from './embeddings.openai';
import {
  embedTopicsForSubject,
  mapChunksToTopics,
  topicCoverage,
} from './topic-mapping';
import { normalizeOptionalTextbookId } from './utils/optional-textbook-id';
import { queryVectorRows } from './utils/vector-query';
import { buildChunks, normalizeText } from './chunking';

type RetrievedChunk = {
  chunk_id: string;
  content: string;
  doc_id: string;
  title: string;
  subject: string;
  class_level: number;
  chapter: string;
  topic_code: string | null;
  topic_name: string | null;
  similarity: number;
};

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly syllabusDb: SyllabusDbService,
  ) {}

  private assertPdfMagicBytes(buffer: Buffer): void {
    // First 5 bytes of every valid PDF are always "%PDF-"
    const magic = buffer.slice(0, 5).toString('ascii');
    if (magic !== '%PDF-') {
      throw new BadRequestException(
        'Invalid file. Only PDF files are supported.',
      );
    }
  }

  getStatus() {
    const ragConfig = this.configService.get('rag');

    return {
      module: 'rag',
      ready: Boolean(ragConfig?.openAiApiKey),
      topK: ragConfig?.topK ?? 5,
      minSimilarity: ragConfig?.minSimilarity ?? 0.42,
      topicMinSimilarity: ragConfig?.topicMinSimilarity ?? 0.3,
    };
  }

  async ingest(payload: IngestRagDto) {
    const { subjectRecord, textbookRecord } = await this.validateAcademicScope(
      payload.subjectId,
      payload.textbookId,
      payload.classLevel,
    );

    return this.persistIngest({
      title: payload.title,
      subject: subjectRecord.name,
      classLevel: subjectRecord.class,
      chapter: payload.chapter || textbookRecord?.title || payload.title,
      exercise: payload.exercise,
      sourceType: payload.sourceType,
      sourcePath: payload.sourcePath,
      sourceText: payload.sourceText,
    });
  }

  async ingestPdf(file: Express.Multer.File, payload: IngestRagPdfDto) {
    if (!file) {
      throw new BadRequestException('PDF file is required.');
    }

    this.assertPdfMagicBytes(file.buffer);

    const { subjectRecord, textbookRecord } = await this.validateAcademicScope(
      payload.subjectId,
      payload.textbookId,
      payload.classLevel,
    );

    const parser = new PDFParse({ data: file.buffer });
    let sourceText: string;
    try {
      const result = await parser.getText();
      sourceText = normalizeText(result.text || '');
    } finally {
      await parser.destroy();
    }

    return this.persistIngest({
      title: payload.title,
      subject: subjectRecord.name,
      classLevel: subjectRecord.class,
      chapter: payload.chapter || textbookRecord?.title || payload.title,
      exercise: payload.exercise,
      sourceType: payload.sourceType,
      sourcePath: payload.sourcePath ?? file.originalname,
      sourceText,
    });
  }

  private async validateAcademicScope(
    subjectId: string,
    textbookId: string | undefined,
    classLevel: number,
  ) {
    const resolvedTextbookId = normalizeOptionalTextbookId(textbookId);

    const subjectRecord = await this.prisma.subject.findUnique({
      where: { id: subjectId },
    });

    if (!subjectRecord) {
      throw new BadRequestException(`Subject with ID ${subjectId} not found.`);
    }

    if (subjectRecord.class !== classLevel) {
      throw new BadRequestException(
        `Class level mismatch. Subject belongs to class ${subjectRecord.class}, but received ${classLevel}.`,
      );
    }

    let textbookRecord: { id: string; subjectId: string; title: string } | null =
      null;

    if (resolvedTextbookId) {
      textbookRecord = await this.prisma.textbook.findUnique({
        where: { id: resolvedTextbookId },
        select: {
          id: true,
          subjectId: true,
          title: true,
        },
      });

      if (!textbookRecord) {
        throw new BadRequestException(
          `Textbook with ID ${resolvedTextbookId} not found.`,
        );
      }

      if (textbookRecord.subjectId !== subjectId) {
        throw new BadRequestException(
          `Textbook ${resolvedTextbookId} does not belong to subject ${subjectId}.`,
        );
      }
    }

    return { subjectRecord, textbookRecord };
  }

  private async resolveAskScope(payload: AskRagDto): Promise<{
    subjectNameFilter: string | null;
    subjectId: string | null;
    textbookId: string | null;
    classLevel: number;
  }> {
    const subjectId = payload.subjectId?.trim() || null;
    const subjectName = payload.subject?.trim() || null;
    const textbookId = normalizeOptionalTextbookId(payload.textbookId) ?? null;

    if (subjectId) {
      const { subjectRecord } = await this.validateAcademicScope(
        subjectId,
        textbookId ?? undefined,
        payload.classLevel,
      );
      return {
        subjectNameFilter: subjectRecord.name,
        subjectId: subjectRecord.id,
        textbookId,
        classLevel: subjectRecord.class,
      };
    }

    if (textbookId) {
      throw new BadRequestException(
        'textbookId requires subjectId for validation. Omit textbookId in class-only mode.',
      );
    }

    if (subjectName) {
      return {
        subjectNameFilter: subjectName,
        subjectId: null,
        textbookId: null,
        classLevel: payload.classLevel,
      };
    }

    return {
      subjectNameFilter: null,
      subjectId: null,
      textbookId: null,
      classLevel: payload.classLevel,
    };
  }

  private async persistIngest(payload: {
    title: string;
    subject: string;
    classLevel: number;
    chapter: string;
    exercise?: string;
    sourceType?: string;
    sourcePath?: string;
    sourceText: string;
  }) {
    const cleanText = normalizeText(payload.sourceText);

    if (!cleanText || cleanText.length < 200) {
      throw new BadRequestException(
        'sourceText is too short. Provide at least 200 characters.',
      );
    }

    if (cleanText.length > 2_000_000) {
      throw new BadRequestException(
        'sourceText is too large for a single ingest request.',
      );
    }

    const builtChunks = buildChunks(cleanText);
    if (!builtChunks.length) {
      throw new BadRequestException(
        'Could not generate chunks from sourceText.',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const doc = await tx.ragDocument.create({
        data: {
          title: payload.title,
          subject: payload.subject,
          classLevel: payload.classLevel,
          chapter: payload.chapter,
          exercise: payload.exercise ?? null,
          sourceType: payload.sourceType ?? 'ncert_book',
          sourcePath: payload.sourcePath ?? null,
        },
      });

      await tx.ragChunk.createMany({
        data: builtChunks.map((chunk) => ({
          documentId: doc.id,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          tokenCount: chunk.tokenCount,
          pageNo: chunk.pageNo ?? null,
          section: chunk.section ?? null,
        })),
      });

      return {
        docId: doc.id,
        chunksInserted: builtChunks.length,
      };
    });

    const rag = this.configService.get('rag');
    const apiKey = rag?.openAiApiKey ?? '';
    const embedModel = rag?.embeddingModel ?? 'text-embedding-3-small';
    let embeddingsIndexed = 0;
    if (apiKey) {
      try {
        embeddingsIndexed = await embedChunksForDocument(
          this.prisma,
          apiKey,
          embedModel,
          result.docId,
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Embedding indexing failed for document ${result.docId}: ${msg}`,
        );
      }
    }

    return {
      status: 'completed',
      ...result,
      embeddingsIndexed,
    };
  }

  // ============================================
  // Syllabus topic embedding + mapping (existing data)
  // ============================================

  private async requireSubject(subjectId: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
    });
    if (!subject) {
      throw new BadRequestException(`Subject with ID ${subjectId} not found.`);
    }
    return subject;
  }

  private requireApiKey(): string {
    const rag = this.configService.get('rag');
    const apiKey = rag?.openAiApiKey ?? '';
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'OPENAI_API_KEY is not set; embeddings are required for topic operations.',
      );
    }
    return apiKey;
  }

  /** Embed (or refresh) all syllabus topics for a subject. */
  async embedTopics(payload: EmbedTopicsDto) {
    const subject = await this.requireSubject(payload.subjectId);
    const apiKey = this.requireApiKey();
    const rag = this.configService.get('rag');
    const embedModel = rag?.embeddingModel ?? 'text-embedding-3-small';

    const topicsEmbedded = await embedTopicsForSubject(
      this.prisma,
      apiKey,
      embedModel,
      subject.id,
    );

    if (topicsEmbedded === 0) {
      throw new BadRequestException(
        `No syllabus topics found for subject ${subject.name} (class ${subject.class}). Import a syllabus first via POST /syllabus/import.`,
      );
    }

    return {
      status: 'embedded',
      subjectId: subject.id,
      subject: subject.name,
      classLevel: subject.class,
      topicsEmbedded,
      model: embedModel,
    };
  }

  /** Assign existing chunks to their nearest syllabus topic (reuses chunk embeddings). */
  async mapTopics(payload: MapTopicsDto) {
    const subject = await this.requireSubject(payload.subjectId);
    const rag = this.configService.get('rag');
    const minSimilarity =
      payload.minSimilarity ?? rag?.topicMinSimilarity ?? 0.3;
    const onlyUntagged = payload.onlyUntagged ?? false;

    const updated = await mapChunksToTopics(this.prisma, {
      subjectId: subject.id,
      subjectName: subject.name,
      classLevel: subject.class,
      minSimilarity,
      onlyUntagged,
    });

    const coverage = await topicCoverage(this.prisma, {
      subjectId: subject.id,
      subjectName: subject.name,
      classLevel: subject.class,
    });

    return {
      status: 'mapped',
      subjectId: subject.id,
      subject: subject.name,
      classLevel: subject.class,
      minSimilarity,
      onlyUntagged,
      chunksAssigned: updated,
      coverage,
    };
  }

  /** Report topic coverage: chunks per topic + untagged count. */
  async getTopicCoverage(subjectId: string) {
    const subject = await this.requireSubject(subjectId);
    const coverage = await topicCoverage(this.prisma, {
      subjectId: subject.id,
      subjectName: subject.name,
      classLevel: subject.class,
    });
    return {
      subjectId: subject.id,
      subject: subject.name,
      classLevel: subject.class,
      ...coverage,
    };
  }

  // ============================================
  // Ask (syllabus-aware retrieval)
  // ============================================

  async ask(payload: AskRagDto) {
    const rag = this.configService.get('rag');
    const apiKey = rag?.openAiApiKey ?? '';
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'OPENAI_API_KEY is not set; RAG answers require embeddings and chat.',
      );
    }

    const scope = await this.resolveAskScope(payload);
    const subjectNameFilter =
      payload.crossSubject === true ? null : scope.subjectNameFilter;

    // Resolve optional syllabus topic/unit scope to concrete chunk topic_ids.
    const topicIds = await this.syllabusDb.resolveTopicIds({
      subjectId: scope.subjectId,
      subjectName: scope.subjectNameFilter,
      classLevel: scope.classLevel,
      topicCode: payload.topicCode ?? null,
      unitCode: payload.unitCode ?? null,
    });
    const topicScoped = Array.isArray(topicIds) && topicIds.length > 0;

    const embedModel = rag?.embeddingModel ?? 'text-embedding-3-small';
    const chatModel = rag?.chatModel ?? 'gpt-4o-mini';
    const topK = payload.topK ?? rag?.topK ?? 5;
    const minSimilarity = rag?.minSimilarity ?? 0.42;

    const [qVec] = await fetchEmbeddings(apiKey, embedModel, [
      payload.question.trim(),
    ]);
    const qLiteral = vectorToPgLiteral(qVec);

    const chapterFilter =
      payload.chapter?.trim() ? payload.chapter.trim() : null;
    const poolLimit = Math.min(32, Math.max(topK * 4, topK));
    const sourceTypeFilter = payload.sourceType?.trim() || null;

    const classScopedPool = await queryVectorRows<RetrievedChunk>(
      this.prisma,
      `
      SELECT
        c.id AS chunk_id,
        c.content,
        d.id AS doc_id,
        d.title,
        d.subject,
        d.class_level,
        d.chapter,
        t.code AS topic_code,
        t.name AS topic_name,
        (1 - (ce.embedding <=> $1::vector(1536)))::float8 AS similarity
      FROM chunks c
      INNER JOIN chunk_embeddings ce ON ce.chunk_id = c.id
      INNER JOIN documents d ON d.id = c.document_id
      LEFT JOIN topics t ON t.id = c.topic_id
      WHERE d.class_level = $3
        AND (
          $2::text IS NULL OR TRIM($2::text) = '' OR
          d.subject ILIKE $2::text
        )
        AND (
          $4::text IS NULL OR TRIM($4::text) = '' OR
          d.chapter ILIKE '%' || $4::text || '%'
        )
        AND (
          $6::text[] IS NULL OR c.topic_id = ANY($6::text[])
        )
        AND ($7::text IS NULL OR d.source_type = $7::text)
      ORDER BY ce.embedding <=> $1::vector(1536)
      LIMIT $5
      `,
      qLiteral,
      subjectNameFilter,
      scope.classLevel,
      chapterFilter,
      poolLimit,
      topicScoped ? topicIds : null,
      sourceTypeFilter,
    );

    const classPool = classScopedPool.map((r) => ({
      ...r,
      similarity: Number(r.similarity),
    }));

    let pool = classPool;
    let globalClassFallback = false;

    if (!pool.length) {
      const globalPoolRaw = await queryVectorRows<RetrievedChunk>(
        this.prisma,
        `
        SELECT
          c.id AS chunk_id,
          c.content,
          d.id AS doc_id,
          d.title,
          d.subject,
          d.class_level,
          d.chapter,
          t.code AS topic_code,
          t.name AS topic_name,
          (1 - (ce.embedding <=> $1::vector(1536)))::float8 AS similarity
        FROM chunks c
        INNER JOIN chunk_embeddings ce ON ce.chunk_id = c.id
        INNER JOIN documents d ON d.id = c.document_id
        LEFT JOIN topics t ON t.id = c.topic_id
        WHERE (
          $2::text IS NULL OR TRIM($2::text) = '' OR
          d.subject ILIKE $2::text
        )
          AND (
            $3::text IS NULL OR TRIM($3::text) = '' OR
            d.chapter ILIKE '%' || $3::text || '%'
          )
          AND (
            $5::text[] IS NULL OR c.topic_id = ANY($5::text[])
          )
          AND ($6::text IS NULL OR d.source_type = $6::text)
        ORDER BY ce.embedding <=> $1::vector(1536)
        LIMIT $4
        `,
        qLiteral,
        subjectNameFilter,
        chapterFilter,
        poolLimit,
        topicScoped ? topicIds : null,
        sourceTypeFilter,
      );

      pool = globalPoolRaw.map((r) => ({
        ...r,
        similarity: Number(r.similarity),
      }));
      globalClassFallback = pool.length > 0;
    }

    const received = {
      subjectId: scope.subjectId,
      textbookId: scope.textbookId,
      subject: subjectNameFilter,
      crossSubject: payload.crossSubject === true,
      classLevel: scope.classLevel,
      chapter: payload.chapter ?? null,
      topicCode: payload.topicCode ?? null,
      unitCode: payload.unitCode ?? null,
      topicScoped,
      topK,
      usedGlobalClassFallback: globalClassFallback,
    };

    if (!pool.length) {
      if (payload.rejectOutOfScope === true) {
        throw new ForbiddenException({
          status: 'out_of_scope',
          message: topicScoped
            ? 'No passages found within the requested syllabus topic scope.'
            : 'No indexed passages found for the requested scope.',
          received,
        });
      }
      return {
        status: 'no_context',
        answer:
          'No indexed textbook passages found for the requested scope (or embeddings are missing). Ingest content or run embedding backfill for existing documents.',
        citations: [],
        confidence: 0,
        fallback: true,
        message:
          'No chunk_embeddings found in class scope or global fallback scope.',
        received,
      };
    }

    let chosen = pool.filter((r) => r.similarity >= minSimilarity).slice(0, topK);
    let relaxedSimilarity = false;
    if (!chosen.length) {
      if (payload.rejectOutOfScope === true) {
        throw new ForbiddenException({
          status: 'out_of_scope',
          message: `No passage met the minimum similarity (${minSimilarity}); question appears out of syllabus scope.`,
          received,
        });
      }
      chosen = pool.slice(0, Math.min(topK, 3));
      relaxedSimilarity = true;
    }

    const contextBlocks = chosen
      .map((r, i) => {
        const topicTag = r.topic_code ? ` [${r.topic_code} · ${r.topic_name}]` : '';
        return `[${i + 1}] ${r.title} — ${r.chapter}${topicTag} (similarity ${r.similarity.toFixed(3)})\n${r.content}`;
      })
      .join('\n\n---\n\n');

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: chatModel,
      temperature: 0.25,
      messages: [
        {
          role: 'system',
          content:
            'You are a concise NCERT-aligned tutor. Answer only from the CONTEXT. If context is insufficient, say so in one sentence.',
        },
        {
          role: 'user',
          content: `CONTEXT:\n${contextBlocks}\n\nQUESTION:\n${payload.question.trim()}`,
        },
      ],
    });

    const answer =
      completion.choices[0]?.message?.content?.trim() ||
      'Could not generate an answer.';

    const avgSim =
      chosen.reduce((s, r) => s + r.similarity, 0) / chosen.length;

    return {
      status: 'answered',
      answer,
      citations: chosen.map((r) => ({
        documentId: r.doc_id,
        classLevel: r.class_level,
        subject: r.subject,
        title: r.title,
        chapter: r.chapter,
        topicCode: r.topic_code,
        topicName: r.topic_name,
        chunkId: r.chunk_id,
        similarity: r.similarity,
      })),
      confidence: Math.min(1, Math.max(0, avgSim)),
      fallback: relaxedSimilarity,
      message: relaxedSimilarity
        ? `No passage met RAG_MIN_SIMILARITY (${minSimilarity}); used top ${chosen.length} nearest chunks.`
        : globalClassFallback
          ? `No class-${scope.classLevel} chunks found; used nearest chunks from available classes.`
          : undefined,
      received,
    };
  }
}
