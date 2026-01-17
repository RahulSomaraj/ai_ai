import { Injectable, Logger } from '@nestjs/common';
import {
  EmbeddingVector,
  VectorStorage,
  VectorSearchResult,
} from '../interfaces/embeddings.interface';

@Injectable()
export class InMemoryVectorStorage implements VectorStorage {
  private readonly logger = new Logger(InMemoryVectorStorage.name);
  private vectors: Map<string, EmbeddingVector> = new Map();

  async upsert(vectors: EmbeddingVector[]): Promise<void> {
    for (const vector of vectors) {
      this.vectors.set(vector.id, vector);
    }
    this.logger.log(`Upserted ${vectors.length} vectors. Total: ${this.vectors.size}`);
  }

  async search(
    queryVector: number[],
    options: {
      topK?: number;
      filter?: {
        topic_ids?: string[];
        unit_ids?: string[];
      };
      minScore?: number;
    } = {},
  ): Promise<VectorSearchResult[]> {
    const topK = options.topK || 10;
    const minScore = options.minScore || 0;

    const results: VectorSearchResult[] = [];

    for (const vector of this.vectors.values()) {
      // Apply filters
      if (options.filter) {
        if (
          options.filter.topic_ids &&
          !options.filter.topic_ids.includes(vector.metadata.topic_id)
        ) {
          continue;
        }
        if (
          options.filter.unit_ids &&
          !options.filter.unit_ids.includes(vector.metadata.unit_id)
        ) {
          continue;
        }
      }

      // Calculate cosine similarity
      const score = this.cosineSimilarity(queryVector, vector.vector);

      if (score >= minScore) {
        results.push({
          id: vector.id,
          score,
          metadata: vector.metadata,
        });
      }
    }

    // Sort by score (descending) and return top K
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  async delete(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.vectors.delete(id);
    }
    this.logger.log(`Deleted ${ids.length} vectors`);
  }

  async getById(id: string): Promise<EmbeddingVector | null> {
    return this.vectors.get(id) || null;
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) {
      return 0;
    }

    return dotProduct / denominator;
  }

  // Utility method to get stats
  getStats(): { totalVectors: number } {
    return {
      totalVectors: this.vectors.size,
    };
  }
}
