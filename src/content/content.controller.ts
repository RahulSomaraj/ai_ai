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
import { ContentService } from './content.service';
import { CreateContentDto, SearchContentDto } from './dto/content.dto';
import { ContentDocument, ContentChunk } from './interfaces/content.interface';

@ApiTags('Content')
@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Post()
  @ApiOperation({ summary: 'Create new content document' })
  @ApiResponse({ status: 201, description: 'Content created successfully' })
  async createContent(@Body() createContentDto: CreateContentDto): Promise<ContentDocument> {
    return this.contentService.createContent(createContentDto);
  }

  @Get(':board/:grade/:subject')
  @ApiOperation({ summary: 'Get all content for a syllabus' })
  async getAllContent(
    @Param('board') board: string,
    @Param('grade') grade: string,
    @Param('subject') subject: string,
  ): Promise<ContentDocument[]> {
    return this.contentService.getAllContent(board, grade, subject);
  }

  @Get(':board/:grade/:subject/topic/:topicId')
  @ApiOperation({ summary: 'Get content by topic ID' })
  async getContentByTopic(
    @Param('board') board: string,
    @Param('grade') grade: string,
    @Param('subject') subject: string,
    @Param('topicId') topicId: string,
  ): Promise<ContentDocument[]> {
    return this.contentService.getContentByTopic(board, grade, subject, topicId);
  }

  @Get(':board/:grade/:subject/unit/:unitId')
  @ApiOperation({ summary: 'Get content by unit ID' })
  async getContentByUnit(
    @Param('board') board: string,
    @Param('grade') grade: string,
    @Param('subject') subject: string,
    @Param('unitId') unitId: string,
  ): Promise<ContentDocument[]> {
    return this.contentService.getContentByUnit(board, grade, subject, unitId);
  }

  @Post(':board/:grade/:subject/search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Search content by query (text-based)' })
  async searchContent(
    @Param('board') board: string,
    @Param('grade') grade: string,
    @Param('subject') subject: string,
    @Body() searchDto: SearchContentDto,
  ): Promise<ContentDocument[]> {
    return this.contentService.searchContent(board, grade, subject, searchDto);
  }

  @Post(':board/:grade/:subject/semantic-search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Semantic search content using vector embeddings',
    description:
      'Uses vector embeddings to find semantically similar content. Returns results with similarity scores.',
  })
  async semanticSearch(
    @Param('board') board: string,
    @Param('grade') grade: string,
    @Param('subject') subject: string,
    @Body()
    body: {
      query: string;
      topic_ids?: string[];
      limit?: number;
      minScore?: number;
    },
  ) {
    return this.contentService.semanticSearch(board, grade, subject, body.query, {
      topic_ids: body.topic_ids,
      limit: body.limit,
      minScore: body.minScore,
    });
  }

  @Post('chunk')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Chunk a content document for vector storage' })
  async chunkContent(
    @Body() document: ContentDocument,
    @Query('chunkSize') chunkSize?: number,
  ): Promise<ContentChunk[]> {
    return this.contentService.chunkContent(document, chunkSize || 500);
  }
}
