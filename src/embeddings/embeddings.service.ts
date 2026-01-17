import { Injectable, Logger } from '@nestjs/common';
import { EmbeddingProvider } from './interfaces/embeddings.interface';
import { OpenAIEmbeddingsProvider } from './providers/openai-embeddings.provider';
import { VectorStorage } from './interfaces/embeddings.interface';
import { InMemoryVectorStorage } from './storage/in-memory-vector-storage';

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private readonly provider: EmbeddingProvider;
  private readonly storage: VectorStorage;

  constructor(
    private readonly openAIProvider: OpenAIEmbeddingsProvider,
    private readonly inMemoryStorage: InMemoryVectorStorage,
  ) {
    // Use OpenAI as default provider (can be extended to support multiple providers)
    this.provider = openAIProvider;
    this.storage = inMemoryStorage;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    return this.provider.generateEmbedding(text);
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    return this.provider.generateEmbeddings(texts);
  }

  getStorage(): VectorStorage {
    return this.storage;
  }

  async embedAndStore(
    id: string,
    text: string,
    metadata: {
      document_id: string;
      topic_id: string;
      unit_id: string;
      content: string;
      title?: string;
      chunk_index?: number;
    },
  ): Promise<void> {
    const embedding = await this.generateEmbedding(text);
    await this.storage.upsert([
      {
        id,
        vector: embedding,
        metadata,
      },
    ]);
    this.logger.log(`Stored embedding for ${id}`);
  }

  async embedAndStoreBatch(
    items: Array<{
      id: string;
      text: string;
      metadata: {
        document_id: string;
        topic_id: string;
        unit_id: string;
        content: string;
        title?: string;
        chunk_index?: number;
      };
    }>,
  ): Promise<void> {
    const texts = items.map((item) => item.text);
    const embeddings = await this.generateEmbeddings(texts);

    const vectors = items.map((item, index) => ({
      id: item.id,
      vector: embeddings[index],
      metadata: item.metadata,
    }));

    await this.storage.upsert(vectors);
    this.logger.log(`Stored ${vectors.length} embeddings in batch`);
  }
}
