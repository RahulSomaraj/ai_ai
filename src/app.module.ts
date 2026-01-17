import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { SubjectsModule } from './subjects/subjects.module';
import { TextbooksModule } from './textbooks/textbooks.module';
import { SyllabusModule } from './syllabus/syllabus.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    SubjectsModule,
    TextbooksModule,
    SyllabusModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
