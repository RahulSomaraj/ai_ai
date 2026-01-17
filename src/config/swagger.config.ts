import { registerAs } from '@nestjs/config';

export const swaggerConfig = registerAs('swagger', () => ({
  enabled: process.env.SWAGGER_ENABLED !== 'false',
  path: process.env.SWAGGER_PATH || 'docs',
  title: process.env.SWAGGER_TITLE || 'AI AI API - Academic Management System',
  description:
    process.env.SWAGGER_DESCRIPTION ||
    'Foundation system for managing subjects, textbooks, and syllabus. Clean architecture with Subject → Textbook structure, ready for syllabus integration.',
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
