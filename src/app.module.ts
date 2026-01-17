import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { SubjectsModule } from './subjects/subjects.module';
import { TextbooksModule } from './textbooks/textbooks.module';
import { SyllabusModule } from './syllabus/syllabus.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    SubjectsModule,
    TextbooksModule,
    SyllabusModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
