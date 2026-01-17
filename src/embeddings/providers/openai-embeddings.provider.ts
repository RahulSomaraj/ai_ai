import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { EmbeddingProvider } from '../interfaces/embeddings.interface';

@Injectable()
export class OpenAIEmbeddingsProvider implements EmbeddingProvider {
  private readonly logger = new Logger(OpenAIEmbeddingsProvider.name);
  private readonly openai: OpenAI;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        'OPENAI_API_KEY not found. Embeddings will fail. Set it in .env file.',
      );
    }
    this.openai = new OpenAI({
      apiKey: apiKey,
    });
    this.model = this.configService.get<string>('OPENAI_EMBEDDING_MODEL') || 'text-embedding-3-small';
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      this.logger.error(`Failed to generate embedding: ${error.message}`);
      throw error;
    }
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      // OpenAI supports batch embeddings
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: texts,
      });
      return response.data.map((item) => item.embedding);
    } catch (error) {
      this.logger.error(`Failed to generate embeddings: ${error.message}`);
      throw error;
    }
  }
}
