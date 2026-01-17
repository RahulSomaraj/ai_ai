export interface EmbeddingVector {
  id: string;
  vector: number[];
  metadata: {
    document_id: string;
    topic_id: string;
    unit_id: string;
    content: string;
    title?: string;
    chunk_index?: number;
  };
}

export interface EmbeddingProvider {
  generateEmbedding(text: string): Promise<number[]>;
  generateEmbeddings(texts: string[]): Promise<number[][]>;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: EmbeddingVector['metadata'];
}

export interface VectorStorage {
  upsert(vectors: EmbeddingVector[]): Promise<void>;
  search(
    queryVector: number[],
    options: {
      topK?: number;
      filter?: {
        topic_ids?: string[];
        unit_ids?: string[];
      };
      minScore?: number;
    },
  ): Promise<VectorSearchResult[]>;
  delete(ids: string[]): Promise<void>;
  getById(id: string): Promise<EmbeddingVector | null>;
}
