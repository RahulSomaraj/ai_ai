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

  // Get configurations
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
  app.setGlobalPrefix(appConfig.globalPrefix);

  // CORS configuration
  if (appConfig.cors.enabled) {
    app.enableCors({
      origin: appConfig.cors.origin,
    });
  }

  // Swagger configuration
  if (swaggerConfig.enabled && appConfig.env !== 'production') {
    const swaggerBuilder = new DocumentBuilder()
      .setTitle(swaggerConfig.title)
      .setDescription(swaggerConfig.description)
      .setVersion(swaggerConfig.version);

    if (swaggerConfig.contact.name) {
      swaggerBuilder.setContact(
        swaggerConfig.contact.name,
        swaggerConfig.contact.email,
        swaggerConfig.contact.url,
      );
    }

    if (swaggerConfig.bearerAuth.enabled) {
      swaggerBuilder.addBearerAuth();
    }

    const document = SwaggerModule.createDocument(app, swaggerBuilder.build());
    SwaggerModule.setup(swaggerConfig.path, app, document);
    logger.log(`📘 Swagger docs: http://localhost:${appConfig.port}/${swaggerConfig.path}`);
  }

  // Start server
  await app.listen(appConfig.port, appConfig.host);

  logger.log(`🚀 ${appConfig.name} v${appConfig.version} running on http://localhost:${appConfig.port}/${appConfig.globalPrefix}`);
  logger.log(`🌍 Environment: ${appConfig.env}`);
}

bootstrap();
