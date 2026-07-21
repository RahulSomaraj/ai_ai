import { Module } from '@nestjs/common';
import { SyllabusController } from './syllabus.controller';
import { SyllabusService } from './syllabus.service';
import { SyllabusDbService } from './syllabus-db.service';

@Module({
  controllers: [SyllabusController],
  providers: [SyllabusService, SyllabusDbService],
  exports: [SyllabusService, SyllabusDbService],
})
export class SyllabusModule {}
