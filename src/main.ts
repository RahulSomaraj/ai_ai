import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const logger = new Logger('Bootstrap');
  const configService = app.get(ConfigService);

  // Get configurations safely
  const appConfig = configService.get('app');
  const swaggerConfig = configService.get('swagger');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global API prefix
  if (appConfig?.globalPrefix) {
    app.setGlobalPrefix(appConfig.globalPrefix);
  }

  // CORS configuration
  if (appConfig?.cors?.enabled) {
    app.enableCors({
      origin: appConfig.cors.origin || '*',
    });
  }

  // Swagger configuration
  if (swaggerConfig?.enabled) {
    const builder = new DocumentBuilder()
      .setTitle(swaggerConfig.title || 'API Docs')
      .setDescription(swaggerConfig.description || 'API documentation')
      .setVersion(swaggerConfig.version || '1.0');

    // FIXED: correct order → name, url, email
    if (swaggerConfig?.contact?.name) {
      builder.setContact(
        swaggerConfig.contact.name,
        swaggerConfig.contact.url || '',
        swaggerConfig.contact.email || '',
      );
    }

    // Better Bearer Auth config
    if (swaggerConfig?.bearerAuth?.enabled) {
      builder.addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        'access-token',
      );
    }

    const document = SwaggerModule.createDocument(app, builder.build());

    // FIXED: include global prefix
    const swaggerPath = appConfig?.globalPrefix
      ? `${appConfig.globalPrefix}/${swaggerConfig.path}`
      : swaggerConfig.path;

    SwaggerModule.setup(swaggerPath, app, document);

    const host =
      appConfig?.host === '0.0.0.0' ? 'localhost' : appConfig?.host;

    logger.log(
      `📘 Swagger docs: http://${host}:${appConfig?.port}/${swaggerPath}`,
    );
  }

  // Start server
  await app.listen(appConfig?.port || 3000, appConfig?.host || '0.0.0.0');

  logger.log(
    `🚀 ${appConfig?.name || 'App'} v${
      appConfig?.version || '1.0'
    } running on http://localhost:${appConfig?.port}/${
      appConfig?.globalPrefix || ''
    }`,
  );

  logger.log(`🌍 Environment: ${appConfig?.env || 'development'}`);
}

bootstrap();
