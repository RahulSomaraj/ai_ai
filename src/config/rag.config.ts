import { registerAs } from '@nestjs/config';

export const ragConfig = registerAs('rag', () => ({
  openAiApiKey: process.env.OPENAI_API_KEY || '',
  embeddingModel: process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small',
  chatModel: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
  topK: parseInt(process.env.RAG_TOP_K || '5', 10),
  minSimilarity: parseFloat(process.env.RAG_MIN_SIMILARITY || '0.42'),
  // Threshold for tagging a chunk with its nearest syllabus topic during mapping.
  // Lower than answer similarity because topic descriptors are short.
  topicMinSimilarity: parseFloat(process.env.RAG_TOPIC_MIN_SIMILARITY || '0.3'),
}));
