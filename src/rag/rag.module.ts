import { Module } from '@nestjs/common';
import { RAGController } from './rag.controller';
import { RAGService } from './rag.service';
import { SyllabusModule } from '../syllabus/syllabus.module';
import { ContentModule } from '../content/content.module';

@Module({
  imports: [SyllabusModule, ContentModule],
  controllers: [RAGController],
  providers: [RAGService],
  exports: [RAGService],
})
export class RAGModule {}
