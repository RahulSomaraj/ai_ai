import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SyllabusModule } from './syllabus/syllabus.module';
import { ContentModule } from './content/content.module';
import { RAGModule } from './rag/rag.module';
import { EmbeddingsModule } from './embeddings/embeddings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    EmbeddingsModule,
    SyllabusModule,
    ContentModule,
    RAGModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
