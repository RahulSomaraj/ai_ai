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
import { CreateSyllabusDto, QueryMappingDto } from './dto/syllabus.dto';
import { Syllabus, QueryMapping } from './interfaces/syllabus.interface';

@ApiTags('Syllabus')
@Controller('syllabus')
export class SyllabusController {
  constructor(private readonly syllabusService: SyllabusService) {}

  @Post()
  @ApiOperation({ summary: 'Create or update a syllabus' })
  @ApiResponse({ status: 201, description: 'Syllabus created successfully' })
  async createSyllabus(@Body() createSyllabusDto: CreateSyllabusDto): Promise<Syllabus> {
    return this.syllabusService.createSyllabus(createSyllabusDto);
  }

  @Get(':board/:grade/:subject')
  @ApiOperation({ summary: 'Get syllabus by board, grade, and subject' })
  @ApiResponse({ status: 200, description: 'Syllabus retrieved successfully' })
  async getSyllabus(
    @Param('board') board: string,
    @Param('grade') grade: string,
    @Param('subject') subject: string,
  ): Promise<Syllabus> {
    return this.syllabusService.getSyllabus(board, grade, subject);
  }

  @Get(':board/:grade/:subject/topics')
  @ApiOperation({ summary: 'Get all topics for a syllabus' })
  async getAllTopics(
    @Param('board') board: string,
    @Param('grade') grade: string,
    @Param('subject') subject: string,
  ) {
    return this.syllabusService.getAllTopics(board, grade, subject);
  }

  @Get(':board/:grade/:subject/topics/:topicId')
  @ApiOperation({ summary: 'Get a specific topic by ID' })
  async getTopicById(
    @Param('board') board: string,
    @Param('grade') grade: string,
    @Param('subject') subject: string,
    @Param('topicId') topicId: string,
  ) {
    return this.syllabusService.getTopicById(board, grade, subject, topicId);
  }

  @Get(':board/:grade/:subject/learning-outcomes')
  @ApiOperation({ summary: 'Get all learning outcomes for a syllabus' })
  async getAllLearningOutcomes(
    @Param('board') board: string,
    @Param('grade') grade: string,
    @Param('subject') subject: string,
  ) {
    return this.syllabusService.getAllLearningOutcomes(board, grade, subject);
  }

  @Post(':board/:grade/:subject/query/map')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Map a user query to syllabus topics and learning outcomes' })
  @ApiResponse({ status: 200, description: 'Query mapped successfully' })
  async mapQuery(
    @Param('board') board: string,
    @Param('grade') grade: string,
    @Param('subject') subject: string,
    @Body() body: { query: string },
  ): Promise<QueryMapping> {
    return this.syllabusService.mapQueryToSyllabus(body.query, board, grade, subject);
  }

  @Post(':board/:grade/:subject/query/validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate if a query is within syllabus scope' })
  async validateQuery(
    @Param('board') board: string,
    @Param('grade') grade: string,
    @Param('subject') subject: string,
    @Body() body: { query: string },
  ) {
    return this.syllabusService.validateQueryScope(body.query, board, grade, subject);
  }
}
