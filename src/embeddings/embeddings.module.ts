import { Module } from '@nestjs/common';
import { EmbeddingsService } from './embeddings.service';
import { OpenAIEmbeddingsProvider } from './providers/openai-embeddings.provider';
import { InMemoryVectorStorage } from './storage/in-memory-vector-storage';

@Module({
  providers: [
    EmbeddingsService,
    OpenAIEmbeddingsProvider,
    InMemoryVectorStorage,
  ],
  exports: [EmbeddingsService, OpenAIEmbeddingsProvider, InMemoryVectorStorage],
})
export class EmbeddingsModule {}
