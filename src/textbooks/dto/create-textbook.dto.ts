import { IsString, IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTextbookDto {
  @ApiProperty({ description: 'Subject ID this textbook belongs to' })
  @IsString()
  subjectId: string;

  @ApiProperty({ description: 'Textbook title', example: 'Physics Part 1' })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Optional textbook code/identifier',
    example: 'PH11-P1',
    required: false,
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({
    description: 'Order within subject (1, 2, 3...)',
    example: 1,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  order: number;

  @ApiProperty({
    description: 'Textbook source',
    example: 'NCERT',
    default: 'NCERT',
    required: false,
  })
  @IsOptional()
  @IsString()
  source?: string;
}
