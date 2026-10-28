import { Module } from '@nestjs/common';
import { RagController } from './rag.controller';
import { ChatHistoryService } from './chat-history.service';
import { RagService } from './rag.service';
import { SyllabusModule } from '../syllabus/syllabus.module';

@Module({
  imports: [SyllabusModule],
  controllers: [RagController],
  providers: [RagService, ChatHistoryService],
  exports: [RagService],
})
export class RagModule {}
