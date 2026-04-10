import { Body, Controller, Get, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { AskRagDto } from './dto/ask-rag.dto';
import { IngestRagDto } from './dto/ingest-rag.dto';
import { IngestRagPdfDto } from './dto/ingest-rag-pdf.dto';
import { RagService } from './rag.service';

@ApiTags('RAG')
@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get RAG module status' })
  @ApiResponse({ status: 200, description: 'RAG module status returned' })
  getStatus() {
    return this.ragService.getStatus();
  }

  @Post('ingest')
  @ApiOperation({ summary: 'Ingest NCERT content for RAG' })
  @ApiResponse({ status: 201, description: 'Ingestion request accepted' })
  ingest(@Body() payload: IngestRagDto) {
    return this.ragService.ingest(payload);
  }

  @Post('ingest/pdf')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description:
      'Multipart upload: choose a PDF under `file`, then either pick the example below or paste the same values as the curl sample. ' +
      'Equivalent curl: `curl -sS -X POST "http://localhost:3000/v1/rag/ingest/pdf" -F "file=@/path/to/file.pdf" -F "subjectId=seed-11-physics" ...`',
    schema: {
      type: 'object',
      required: ['file', 'subjectId', 'subject', 'classLevel', 'chapter', 'title'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'PDF bytes (max 20 MB). In curl: -F "file=@E:/path/to/your.pdf"',
        },
        subjectId: {
          type: 'string',
          example: 'seed-11-physics',
          description: 'Subject id from seed (see GET /v1/textbooks?subjectId=…)',
        },
        textbookId: {
          type: 'string',
          example: 'seed-11-physics-tb1',
          description:
            'Optional. Seeded textbook id (e.g. Part 1). Omit or leave empty if unknown.',
        },
        subject: {
          type: 'string',
          example: 'Physics',
          description: 'Subject name; must match the subject row for classLevel',
        },
        classLevel: {
          type: 'integer',
          example: 11,
          description: 'Class 1–12; must match subject.class',
        },
        chapter: {
          type: 'string',
          example: 'Units and Measurement',
        },
        exercise: {
          type: 'string',
          example: '2.1',
          description: 'Optional exercise label',
        },
        title: {
          type: 'string',
          example: 'Class 11 Physics Ch1 PDF',
        },
        sourceType: {
          type: 'string',
          example: 'ncert_book',
        },
        sourcePath: {
          type: 'string',
          example: 'ncert-phy-11-1.pdf',
          description: 'Logical filename or path label stored with the document',
        },
      },
    },
    examples: {
      class11PhysicsCh1Seeded: {
        summary: 'Class 11 Physics Ch1 (seed IDs)',
        description:
          'Matches seeded data: subject `seed-11-physics`, textbook Part 1 `seed-11-physics-tb1`. You must still attach `file` manually in Swagger.',
        value: {
          subjectId: 'seed-11-physics',
          textbookId: 'seed-11-physics-tb1',
          subject: 'Physics',
          classLevel: 11,
          chapter: 'Units and Measurement',
          title: 'Class 11 Physics Ch1 PDF',
          sourceType: 'ncert_book',
          sourcePath: 'ncert-phy-11-1.pdf',
        },
      },
    },
  })
  @ApiOperation({ summary: 'Upload and ingest NCERT PDF for RAG' })
  @ApiResponse({ status: 201, description: 'PDF ingestion request accepted' })
  ingestPdf(
    @UploadedFile() file: Express.Multer.File,
    @Body() payload: IngestRagPdfDto,
  ) {
    return this.ragService.ingestPdf(file, payload);
  }

  @Post('ask')
  @ApiOperation({ summary: 'Ask an NCERT doubt question via RAG' })
  @ApiResponse({ status: 200, description: 'RAG answer returned' })
  ask(@Body() payload: AskRagDto) {
    return this.ragService.ask(payload);
  }
}
