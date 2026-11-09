import { registerAs } from '@nestjs/config';

export const swaggerConfig = registerAs('swagger', () => ({
  enabled: process.env.SWAGGER_ENABLED !== 'false',
  path: process.env.SWAGGER_PATH || 'docs',
  title: process.env.SWAGGER_TITLE || 'AI AI API - Academic Management System',
  description:
    process.env.SWAGGER_DESCRIPTION ||
    'Academic APIs for subjects, textbooks and chapters, syllabus import and retrieval, RAG ingestion and questions, and saved chat history. ' +
      'Ask requires question and classLevel. Include userId to save history and sessionId to continue a conversation; omitting sessionId starts a new conversation. ' +
      'GET /rag/last-question automatically looks up the latest saved question when only userId is supplied. ' +
      'History endpoints currently use caller-supplied userId as a filter; it is not authentication. ' +
      'Legacy file-based syllabus routes are labelled [Legacy].',
  version: process.env.SWAGGER_VERSION || '1.0',
  contact: {
    name: process.env.SWAGGER_CONTACT_NAME || 'API Support',
    email: process.env.SWAGGER_CONTACT_EMAIL,
    url: process.env.SWAGGER_CONTACT_URL,
  },
  bearerAuth: {
    enabled: process.env.SWAGGER_BEARER_AUTH !== 'false',
  },
}));
