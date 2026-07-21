import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SyllabusService } from './syllabus.service';
import { SyllabusDbService } from './syllabus-db.service';
import { CreateSyllabusDto } from './dto/syllabus.dto';
import {
  Syllabus,
  QueryMapping,
  CurrentTopic,
} from './interfaces/syllabus.interface';

@ApiTags('Syllabus')
@Controller('syllabus')
export class SyllabusController {
  constructor(
    private readonly syllabusService: SyllabusService,
    private readonly syllabusDbService: SyllabusDbService,
  ) {}

  // ============================================
  // Postgres-backed syllabus (drives RAG scope)
  // ============================================

  @Post('import')
  @ApiOperation({
    summary: 'Import a syllabus into Postgres (units + topics)',
    description:
      'Upserts the Subject (by name + class from grade) and its units/topics. ' +
      'Idempotent by syllabus codes (unit_id / topic_id). This is the store that ' +
      'RAG retrieval uses for topic-scoped answers. After importing, run ' +
      'POST /rag/topics/embed then POST /rag/topics/map to tag existing chunks.',
  })
  @ApiResponse({ status: 201, description: 'Syllabus imported into Postgres' })
  async importSyllabus(@Body() dto: CreateSyllabusDto) {
    return this.syllabusDbService.importSyllabus(dto);
  }

  @Get('db/:subjectId/structure')
  @ApiOperation({ summary: 'Get units + topics for a subject (from Postgres)' })
  @ApiResponse({ status: 200, description: 'Syllabus structure returned' })
  async getDbStructure(@Param('subjectId') subjectId: string) {
    return this.syllabusDbService.getStructure(subjectId);
  }

  @Get('db/:subjectId/topics')
  @ApiOperation({ summary: 'Flat list of topics for a subject (from Postgres)' })
  @ApiResponse({ status: 200, description: 'Topics returned' })
  async getDbTopics(@Param('subjectId') subjectId: string) {
    return this.syllabusDbService.getTopics(subjectId);
  }

  // ============================================
  // Legacy file-based syllabus (kept for compatibility)
  // ============================================

  @Post()
  @ApiOperation({
    summary: '[Legacy] Create or update a file-based syllabus (JSON on disk)',
  })
  @ApiResponse({ status: 201, description: 'Syllabus created successfully' })
  async createSyllabus(
    @Body() createSyllabusDto: CreateSyllabusDto,
  ): Promise<Syllabus> {
    return this.syllabusService.createSyllabus(createSyllabusDto);
  }

  @Get(':board/current-topics')
  @ApiOperation({
    summary: '[Legacy] Get current topics across all classes for a board',
  })
  async getCurrentTopics(
    @Param('board') board: string,
    @Query('subject') subject?: string,
  ): Promise<CurrentTopic[]> {
    return this.syllabusService.getCurrentTopics(board, subject);
  }

  @Get(':board/:grade/:subject')
  @ApiOperation({ summary: '[Legacy] Get syllabus by board, grade, and subject' })
  @ApiResponse({ status: 200, description: 'Syllabus retrieved successfully' })
  async getSyllabus(
    @Param('board') board: string,
    @Param('grade') grade: string,
    @Param('subject') subject: string,
  ): Promise<Syllabus> {
    return this.syllabusService.getSyllabus(board, grade, subject);
  }

  @Get(':board/:grade/:subject/topics')
  @ApiOperation({ summary: '[Legacy] Get all topics for a syllabus' })
  async getAllTopics(
    @Param('board') board: string,
    @Param('grade') grade: string,
    @Param('subject') subject: string,
  ) {
    return this.syllabusService.getAllTopics(board, grade, subject);
  }

  @Get(':board/:grade/:subject/topics/:topicId')
  @ApiOperation({ summary: '[Legacy] Get a specific topic by ID' })
  async getTopicById(
    @Param('board') board: string,
    @Param('grade') grade: string,
    @Param('subject') subject: string,
    @Param('topicId') topicId: string,
  ) {
    return this.syllabusService.getTopicById(board, grade, subject, topicId);
  }

  @Get(':board/:grade/:subject/learning-outcomes')
  @ApiOperation({ summary: '[Legacy] Get all learning outcomes for a syllabus' })
  async getAllLearningOutcomes(
    @Param('board') board: string,
    @Param('grade') grade: string,
    @Param('subject') subject: string,
  ) {
    return this.syllabusService.getAllLearningOutcomes(board, grade, subject);
  }

  @Post(':board/:grade/:subject/query/map')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Legacy] Map a user query to syllabus topics and learning outcomes',
  })
  @ApiResponse({ status: 200, description: 'Query mapped successfully' })
  async mapQuery(
    @Param('board') board: string,
    @Param('grade') grade: string,
    @Param('subject') subject: string,
    @Body() body: { query: string },
  ): Promise<QueryMapping> {
    return this.syllabusService.mapQueryToSyllabus(
      body.query,
      board,
      grade,
      subject,
    );
  }

  @Post(':board/:grade/:subject/query/validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Legacy] Validate if a query is within syllabus scope' })
  async validateQuery(
    @Param('board') board: string,
    @Param('grade') grade: string,
    @Param('subject') subject: string,
    @Body() body: { query: string },
  ) {
    return this.syllabusService.validateQueryScope(
      body.query,
      board,
      grade,
      subject,
    );
  }
}
