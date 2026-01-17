import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly maxRetries = 5;
  private readonly retryDelay = 3000; // 3 seconds

  constructor(private readonly configService: ConfigService) {
    const databaseConfig = configService.get('database');
    super({
      datasources: {
        db: {
          url: databaseConfig.url,
        },
      },
      log: databaseConfig.logging ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
    });
  }

  async onModuleInit() {
    await this.connectWithRetry();
  }

  private async connectWithRetry(retryCount = 0): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('✅ Database connected successfully');
    } catch (error: any) {
      // Check if it's a Prisma initialization error (error code P1001)
      const isPrismaInitError =
        error?.code === 'P1001' ||
        error?.errorCode === 'P1001' ||
        error?.name === 'PrismaClientInitializationError' ||
        error?.message?.includes("Can't reach database server");

      if (isPrismaInitError) {
        this.logger.error(
          `❌ Database connection failed (attempt ${retryCount + 1}/${this.maxRetries}): ${error.message}`,
        );

        if (retryCount < this.maxRetries - 1) {
          this.logger.warn(
            `⏳ Retrying connection in ${this.retryDelay / 1000} seconds...`,
          );
          await this.sleep(this.retryDelay);
          return this.connectWithRetry(retryCount + 1);
        }

        this.logger.error('❌ Max retry attempts reached. Database connection failed.');
        this.logger.error('💡 Troubleshooting tips:');
        this.logger.error('   1. Check if database server is running');
        this.logger.error('   2. Verify DATABASE_URL in .env file');
        this.logger.error('   3. Check network connectivity');
        this.logger.error('   4. Verify firewall/security group settings');
        this.logger.error('   5. Ensure SSL is configured if required');
      } else {
        this.logger.error(`❌ Unexpected error: ${error.message}`);
      }
      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('Database disconnected');
    } catch (error) {
      this.logger.error(`Error disconnecting from database: ${error.message}`);
    }
  }
}
