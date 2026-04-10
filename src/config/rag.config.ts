import { registerAs } from '@nestjs/config';

export const ragConfig = registerAs('rag', () => ({
  openAiApiKey: process.env.OPENAI_API_KEY || '',
  embeddingModel: process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small',
  chatModel: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
  topK: parseInt(process.env.RAG_TOP_K || '5', 10),
  minSimilarity: parseFloat(process.env.RAG_MIN_SIMILARITY || '0.42'),
}));
