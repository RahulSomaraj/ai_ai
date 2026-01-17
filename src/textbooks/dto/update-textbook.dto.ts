import { PartialType } from '@nestjs/swagger';
import { CreateTextbookDto } from './create-textbook.dto';

export class UpdateTextbookDto extends PartialType(CreateTextbookDto) {}
