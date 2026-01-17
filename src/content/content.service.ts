import { Injectable, Logger, NotFoundException, Optional, Inject } from '@nestjs/common';
import { ContentChunk, ContentDocument } from './interfaces/content.interface';
import { CreateContentDto, SearchContentDto } from './dto/content.dto';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);
  private contentCache: Map<string, ContentDocument[]> = new Map();
  private readonly contentDir = path.join(process.cwd(), 'data', 'content');

  constructor(
    @Optional() @Inject(EmbeddingsService)
    private readonly embeddingsService?: EmbeddingsService,
  ) {
    this.ensureDirectoryExists();
  }

  private async ensureDirectoryExists() {
    try {
      await fs.mkdir(this.contentDir, { recursive: true });
    } catch (error) {
      this.logger.error(`Failed to create content directory: ${error.message}`);
    }
  }

  private getContentKey(board: string, grade: string, subject: string): string {
    return `${board}_${grade}_${subject}`.toUpperCase();
  }

  async createContent(createContentDto: CreateContentDto): Promise<ContentDocument> {
    const key = this.getContentKey(
      createContentDto.board,
      createContentDto.grade,
      createContentDto.subject,
    );

    const document: ContentDocument = {
      document_id: `DOC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      board: createContentDto.board,
      grade: createContentDto.grade,
      subject: createContentDto.subject,
      unit_id: createContentDto.unit_id,
      topic_id: createContentDto.topic_id,
      title: createContentDto.title,
      content: createContentDto.content,
      metadata: {
        ...createContentDto.metadata,
        created_at: new Date().toISOString(),
      },
    };

    // Load existing content
    const existingContent = await this.getContentByKey(key);
    existingContent.push(document);

    // Cache in memory
    this.contentCache.set(key, existingContent);

    // Persist to file
    const filePath = path.join(this.contentDir, `${key}.json`);
    await fs.writeFile(filePath, JSON.stringify(existingContent, null, 2), 'utf-8');

    // Generate and store embeddings
    if (this.embeddingsService) {
      try {
        const textToEmbed = `${document.title}\n\n${document.content}`;
        await this.embeddingsService.embedAndStore(
          document.document_id,
          textToEmbed,
          {
            document_id: document.document_id,
            topic_id: document.topic_id,
            unit_id: document.unit_id,
            content: document.content,
            title: document.title,
          },
        );
        this.logger.log(`Embeddings generated for ${document.document_id}`);
      } catch (error) {
        this.logger.warn(
          `Failed to generate embeddings for ${document.document_id}: ${error.message}`,
        );
        // Don't fail content creation if embeddings fail
      }
    }

    this.logger.log(`Content created: ${document.document_id}`);
    return document;
  }

  private async getContentByKey(key: string): Promise<ContentDocument[]> {
    // Check cache first
    if (this.contentCache.has(key)) {
      return this.contentCache.get(key)!;
    }

    // Load from file
    const filePath = path.join(this.contentDir, `${key}.json`);
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const content: ContentDocument[] = JSON.parse(fileContent);
      this.contentCache.set(key, content);
      return content;
    } catch (error) {
      // File doesn't exist yet, return empty array
      return [];
    }
  }

  async getContentByTopic(
    board: string,
    grade: string,
    subject: string,
    topicId: string,
  ): Promise<ContentDocument[]> {
    const key = this.getContentKey(board, grade, subject);
    const allContent = await this.getContentByKey(key);
    return allContent.filter((doc) => doc.topic_id === topicId);
  }

  async getContentByUnit(
    board: string,
    grade: string,
    subject: string,
    unitId: string,
  ): Promise<ContentDocument[]> {
    const key = this.getContentKey(board, grade, subject);
    const allContent = await this.getContentByKey(key);
    return allContent.filter((doc) => doc.unit_id === unitId);
  }

  async getAllContent(
    board: string,
    grade: string,
    subject: string,
  ): Promise<ContentDocument[]> {
    const key = this.getContentKey(board, grade, subject);
    return this.getContentByKey(key);
  }

  async searchContent(
    board: string,
    grade: string,
    subject: string,
    searchDto: SearchContentDto,
  ): Promise<ContentDocument[]> {
    const key = this.getContentKey(board, grade, subject);
    let allContent = await this.getContentByKey(key);

    // Filter by topic_ids if provided
    if (searchDto.topic_ids && searchDto.topic_ids.length > 0) {
      allContent = allContent.filter((doc) =>
        searchDto.topic_ids!.includes(doc.topic_id),
      );
    }

    // Simple text search (can be enhanced with vector search)
    const queryLower = searchDto.query.toLowerCase();
    const matchingContent = allContent.filter((doc) => {
      const contentLower = doc.content.toLowerCase();
      const titleLower = doc.title.toLowerCase();
      return (
        contentLower.includes(queryLower) || titleLower.includes(queryLower)
      );
    });

    // Sort by relevance (simple: count matches)
    matchingContent.sort((a, b) => {
      const aMatches = (a.content.match(new RegExp(queryLower, 'gi')) || []).length;
      const bMatches = (b.content.match(new RegExp(queryLower, 'gi')) || []).length;
      return bMatches - aMatches;
    });

    // Apply limit
    const limit = searchDto.limit || 10;
    return matchingContent.slice(0, limit);
  }

  async semanticSearch(
    board: string,
    grade: string,
    subject: string,
    query: string,
    options: {
      topic_ids?: string[];
      limit?: number;
      minScore?: number;
    } = {},
  ): Promise<Array<ContentDocument & { similarity_score: number }>> {
    if (!this.embeddingsService) {
      throw new Error('EmbeddingsService not available. Semantic search requires embeddings.');
    }

    try {
      // Generate embedding for query
      const queryEmbedding = await this.embeddingsService.generateEmbedding(query);

      // Search vectors
      const vectorStorage = this.embeddingsService.getStorage();
      const searchResults = await vectorStorage.search(queryEmbedding, {
        topK: options.limit || 10,
        filter: options.topic_ids
          ? { topic_ids: options.topic_ids }
          : undefined,
        minScore: options.minScore || 0.5,
      });

      // Map vector search results back to content documents
      const key = this.getContentKey(board, grade, subject);
      const allContent = await this.getContentByKey(key);
      const contentMap = new Map(
        allContent.map((doc) => [doc.document_id, doc]),
      );

      const results: Array<ContentDocument & { similarity_score: number }> = [];

      for (const result of searchResults) {
        const document = contentMap.get(result.metadata.document_id);
        if (document) {
          results.push({
            ...document,
            similarity_score: result.score,
          });
        }
      }

      // Sort by similarity score (already sorted by vector storage, but ensure)
      results.sort((a, b) => b.similarity_score - a.similarity_score);

      this.logger.log(
        `Semantic search found ${results.length} results for query: ${query.substring(0, 50)}...`,
      );

      return results;
    } catch (error) {
      this.logger.error(`Semantic search failed: ${error.message}`);
      // Fallback to text search if semantic search fails
      return this.searchContent(board, grade, subject, {
        query,
        topic_ids: options.topic_ids,
        limit: options.limit,
      }).then((docs) =>
        docs.map((doc) => ({ ...doc, similarity_score: 0 })),
      );
    }
  }

  async chunkContent(
    document: ContentDocument,
    chunkSize: number = 500,
  ): Promise<ContentChunk[]> {
    const chunks: ContentChunk[] = [];
    const sentences = document.content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    
    let currentChunk = '';
    let chunkIndex = 0;

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
        chunks.push({
          chunk_id: `${document.document_id}_CHUNK_${chunkIndex}`,
          topic_id: document.topic_id,
          unit_id: document.unit_id,
          content: currentChunk.trim(),
          metadata: {
            ...document.metadata,
            section: `Chunk ${chunkIndex + 1}`,
          },
        });
        currentChunk = sentence;
        chunkIndex++;
      } else {
        currentChunk += (currentChunk ? '. ' : '') + sentence;
      }
    }

    // Add remaining content
    if (currentChunk.trim().length > 0) {
      chunks.push({
        chunk_id: `${document.document_id}_CHUNK_${chunkIndex}`,
        topic_id: document.topic_id,
        unit_id: document.unit_id,
        content: currentChunk.trim(),
        metadata: {
          ...document.metadata,
          section: `Chunk ${chunkIndex + 1}`,
        },
      });
    }

    // Generate embeddings for chunks
    if (this.embeddingsService) {
      try {
        const chunkEmbeddings = chunks.map((chunk) => ({
          id: chunk.chunk_id,
          text: chunk.content,
          metadata: {
            document_id: document.document_id,
            topic_id: chunk.topic_id,
            unit_id: chunk.unit_id,
            content: chunk.content,
            title: document.title,
            chunk_index: chunkIndex,
          },
        }));

        await this.embeddingsService.embedAndStoreBatch(chunkEmbeddings);
        this.logger.log(`Generated embeddings for ${chunks.length} chunks`);
      } catch (error) {
        this.logger.warn(`Failed to generate chunk embeddings: ${error.message}`);
      }
    }

    return chunks;
  }
}
