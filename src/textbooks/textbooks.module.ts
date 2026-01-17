import { Module } from '@nestjs/common';
import { TextbooksService } from './textbooks.service';
import { TextbooksController } from './textbooks.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TextbooksController],
  providers: [TextbooksService],
  exports: [TextbooksService],
})
export class TextbooksModule {}
