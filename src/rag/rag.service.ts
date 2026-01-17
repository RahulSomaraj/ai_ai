import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { SyllabusService } from '../syllabus/syllabus.service';
import { ContentService } from '../content/content.service';
import { RAGQuery, RAGResponse, RAGConfig } from './interfaces/rag.interface';
import { RAGQueryDto } from './dto/rag.dto';

@Injectable()
export class RAGService {
  private readonly logger = new Logger(RAGService.name);
  private readonly defaultConfig: RAGConfig = {
    maxSources: 5,
    requireScopeValidation: true,
    rejectOutOfScope: true,
  };

  constructor(
    private readonly syllabusService: SyllabusService,
    private readonly contentService: ContentService,
  ) {}

  async processQuery(
    ragQuery: RAGQueryDto,
    config?: Partial<RAGConfig>,
  ): Promise<RAGResponse> {
    const startTime = Date.now();
    const finalConfig = { ...this.defaultConfig, ...config };

    // Step 1: Validate query scope using syllabus
    const scopeValidation = await this.syllabusService.validateQueryScope(
      ragQuery.query,
      ragQuery.board,
      ragQuery.grade,
      ragQuery.subject,
    );

    // Step 2: Map query to syllabus topics/outcomes
    const queryMapping = await this.syllabusService.mapQueryToSyllabus(
      ragQuery.query,
      ragQuery.board,
      ragQuery.grade,
      ragQuery.subject,
    );

    // Step 3: Gatekeeping - reject if out of scope (if configured)
    if (finalConfig.rejectOutOfScope && !scopeValidation.allowed) {
      throw new ForbiddenException({
        message: 'Query is outside syllabus scope',
        reason: scopeValidation.reason,
        query: ragQuery.query,
      });
    }

    // Step 4: Retrieve relevant content using semantic search (filtered by topic_ids from syllabus mapping)
    const topicIds =
      ragQuery.context?.topic_ids || queryMapping.topic_ids || [];
    
    // Use semantic search for better relevance
    let searchResults: any[];
    try {
      const semanticResults = await this.contentService.semanticSearch(
        ragQuery.board,
        ragQuery.grade,
        ragQuery.subject,
        ragQuery.query,
        {
          topic_ids: topicIds.length > 0 ? topicIds : undefined,
          limit: finalConfig.maxSources,
          minScore: 0.5, // Minimum similarity score
        },
      );
      searchResults = semanticResults;
      this.logger.log(
        `Semantic search found ${semanticResults.length} results with scores: ${semanticResults.map((r) => r.similarity_score?.toFixed(2)).join(', ')}`,
      );
    } catch (error) {
      // Fallback to text search if semantic search fails
      this.logger.warn(`Semantic search failed, falling back to text search: ${error.message}`);
      searchResults = await this.contentService.searchContent(
        ragQuery.board,
        ragQuery.grade,
        ragQuery.subject,
        {
          query: ragQuery.query,
          topic_ids: topicIds.length > 0 ? topicIds : undefined,
          limit: finalConfig.maxSources,
        },
      );
    }

    // Step 5: Generate response (simplified - in production, use LLM)
    const answer = this.generateAnswer(
      ragQuery.query,
      searchResults,
      queryMapping,
    );

    const processingTime = Date.now() - startTime;

    return {
      answer,
      isInScope: scopeValidation.allowed,
      scopeValidation: {
        allowed: scopeValidation.allowed,
        reason: scopeValidation.reason,
        matched_topics: queryMapping.topic_ids,
        matched_outcomes: queryMapping.learning_outcomes,
      },
      sources: searchResults.map((doc) => ({
        document_id: doc.document_id,
        title: doc.title,
        topic_id: doc.topic_id,
      })),
      metadata: {
        query: ragQuery.query,
        timestamp: new Date().toISOString(),
        processing_time_ms: processingTime,
      },
    };
  }

  private generateAnswer(
    query: string,
    sources: any[],
    queryMapping: any,
  ): string {
    if (sources.length === 0) {
      return (
        `I couldn't find relevant content for your query about "${query}". ` +
        `This might be outside the syllabus scope or the content hasn't been uploaded yet.`
      );
    }

    // Simple template-based answer generation
    // In production, this would use an LLM (OpenAI, Anthropic, etc.)
    const topicNames = queryMapping.topic_ids?.join(', ') || 'the topic';

    let answer = `Based on the syllabus content for ${topicNames}, `;

    if (sources.length === 1) {
      answer += `here's what I found:\n\n${sources[0].content.substring(0, 500)}...`;
    } else {
      answer += `I found ${sources.length} relevant sources. `;
      answer += `Here's a summary based on the most relevant content:\n\n`;
      answer += sources[0].content.substring(0, 300) + '...';
      if (sources.length > 1) {
        answer += `\n\nAdditional information from other sources is also available.`;
      }
    }

    return answer;
  }

  async validateAndFilter(
    query: string,
    board: string,
    grade: string,
    subject: string,
  ): Promise<{ allowed: boolean; filteredQuery?: string; reason: string }> {
    const mapping = await this.syllabusService.mapQueryToSyllabus(
      query,
      board,
      grade,
      subject,
    );

    if (!mapping.isInScope) {
      return {
        allowed: false,
        reason: mapping.reason || 'Query does not match any syllabus topics',
      };
    }

    // Query is in scope
    return {
      allowed: true,
      filteredQuery: query, // In production, could enhance/refine query here
      reason: `Query maps to ${mapping.topic_ids?.length || 0} topic(s)`,
    };
  }
}
