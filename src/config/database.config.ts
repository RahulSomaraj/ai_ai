import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => {
  const url = process.env.DATABASE_URL;
  
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Please configure it in your .env file.',
    );
  }

  return {
    url,
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    },
    logging: process.env.DB_LOGGING === 'true',
    connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT || '10000', 10), // 10 seconds
  };
});
