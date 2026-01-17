import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { RAGService } from './rag.service';
import { RAGQueryDto, RAGConfigDto } from './dto/rag.dto';
import { RAGResponse } from './interfaces/rag.interface';

@ApiTags('RAG')
@Controller('rag')
export class RAGController {
  constructor(private readonly ragService: RAGService) {}

  @Post('query')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Process a RAG query with syllabus-controlled response',
    description:
      'This endpoint validates the query against the syllabus, retrieves relevant content, and generates a response that respects syllabus boundaries.',
  })
  @ApiResponse({
    status: 200,
    description: 'Query processed successfully',
    type: Object,
  })
  @ApiResponse({
    status: 403,
    description:
      'Query is outside syllabus scope (if rejectOutOfScope is enabled)',
  })
  async processQuery(@Body() ragQuery: RAGQueryDto): Promise<RAGResponse> {
    try {
      return await this.ragService.processQuery(ragQuery);
    } catch (error) {
      if (error instanceof BadRequestException || error.status === 403) {
        throw error;
      }
      throw new BadRequestException({
        message: 'Failed to process query',
        error: error.message,
      });
    }
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate if a query is within syllabus scope',
    description:
      'Check if a query can be answered based on the syllabus without processing the full RAG pipeline.',
  })
  async validateQuery(
    @Body()
    body: {
      query: string;
      board: string;
      grade: string;
      subject: string;
    },
  ) {
    return this.ragService.validateAndFilter(
      body.query,
      body.board,
      body.grade,
      body.subject,
    );
  }
}
