import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PDFParse } from 'pdf-parse';
import { PrismaService } from '../prisma/prisma.service';
import { AskRagDto } from './dto/ask-rag.dto';
import { IngestRagPdfDto } from './dto/ingest-rag-pdf.dto';
import { IngestRagDto } from './dto/ingest-rag.dto';
import {
  embedChunksForDocument,
  fetchEmbeddings,
  vectorToPgLiteral,
} from './embeddings.openai';
import { normalizeOptionalTextbookId } from './utils/optional-textbook-id';
import { buildChunks, normalizeText } from './chunking';

type RetrievedChunk = {
  chunk_id: string;
  content: string;
  doc_id: string;
  title: string;
  subject: string;
  chapter: string;
  similarity: number;
};

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
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

  async ask(payload: AskRagDto) {
    const rag = this.configService.get('rag');
    const apiKey = rag?.openAiApiKey ?? '';
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'OPENAI_API_KEY is not set; RAG answers require embeddings and chat.',
      );
    }

    const scope = await this.resolveAskScope(payload);

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

    const rawPool = await this.prisma.$queryRawUnsafe<RetrievedChunk[]>(
      `
      SELECT
        c.id AS chunk_id,
        c.content,
        d.id AS doc_id,
        d.title,
        d.subject,
        d.chapter,
        (1 - (ce.embedding <=> $1::vector(1536)))::float8 AS similarity
      FROM chunks c
      INNER JOIN chunk_embeddings ce ON ce.chunk_id = c.id
      INNER JOIN documents d ON d.id = c.document_id
      WHERE d.class_level = $3
        AND (
          $2::text IS NULL OR TRIM($2::text) = '' OR
          d.subject ILIKE $2::text
        )
        AND (
          $4::text IS NULL OR TRIM($4::text) = '' OR
          d.chapter ILIKE '%' || $4::text || '%'
        )
      ORDER BY ce.embedding <=> $1::vector(1536)
      LIMIT $5
      `,
      qLiteral,
      scope.subjectNameFilter,
      scope.classLevel,
      chapterFilter,
      Math.min(32, Math.max(topK * 4, topK)),
    );

    const pool = rawPool.map((r) => ({
      ...r,
      similarity: Number(r.similarity),
    }));

    if (!pool.length) {
      return {
        status: 'no_context',
        answer:
          'No indexed textbook passages found for the requested class scope (or embeddings are missing). Ingest content or run embedding backfill for existing documents.',
        citations: [],
        confidence: 0,
        fallback: true,
        message:
          'No chunk_embeddings in scope. Ingest with OPENAI_API_KEY set, or index existing chunks.',
        received: {
          subjectId: scope.subjectId,
          textbookId: scope.textbookId,
          subject: scope.subjectNameFilter,
          classLevel: scope.classLevel,
          chapter: payload.chapter ?? null,
          topK,
        },
      };
    }

    let chosen = pool.filter((r) => r.similarity >= minSimilarity).slice(0, topK);
    let relaxedSimilarity = false;
    if (!chosen.length) {
      chosen = pool.slice(0, Math.min(topK, 3));
      relaxedSimilarity = true;
    }

    const contextBlocks = chosen
      .map(
        (r, i) =>
          `[${i + 1}] ${r.title} — ${r.chapter} (similarity ${r.similarity.toFixed(3)})\n${r.content}`,
      )
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
        subject: r.subject,
        title: r.title,
        chapter: r.chapter,
        chunkId: r.chunk_id,
        similarity: r.similarity,
      })),
      confidence: Math.min(1, Math.max(0, avgSim)),
      fallback: relaxedSimilarity,
      message: relaxedSimilarity
        ? `No passage met RAG_MIN_SIMILARITY (${minSimilarity}); used top ${chosen.length} nearest chunks.`
        : undefined,
      received: {
        subjectId: scope.subjectId,
        textbookId: scope.textbookId,
        subject: scope.subjectNameFilter,
        classLevel: scope.classLevel,
        chapter: payload.chapter ?? null,
        topK,
      },
    };
  }
}
