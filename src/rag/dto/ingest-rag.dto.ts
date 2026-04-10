import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { TransformOptionalTextbookId } from '../utils/optional-textbook-id';

export class IngestRagDto {
  @ApiProperty({ description: 'Canonical subject ID from subjects table' })
  @IsString()
  subjectId: string;

  @ApiPropertyOptional({
    description: 'Canonical textbook ID from textbooks table (omit unless set)',
    example: 'seed-11-physics-tb1',
  })
  @TransformOptionalTextbookId()
  @IsOptional()
  @IsString()
  textbookId?: string;

  @ApiProperty({ description: 'Subject name', example: 'Science' })
  @IsString()
  subject: string;

  @ApiProperty({ description: 'Class level', example: 10, minimum: 1, maximum: 12 })
  @IsInt()
  @Min(1)
  @Max(12)
  classLevel: number;

  @ApiProperty({ description: 'Chapter title', example: 'Chemical Reactions and Equations' })
  @IsString()
  chapter: string;

  @ApiPropertyOptional({ description: 'Exercise identifier', example: '2.1' })
  @IsOptional()
  @IsString()
  exercise?: string;

  @ApiProperty({ description: 'Document title', example: 'Class 10 Science Chapter 1' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Raw source text extracted from NCERT', example: '...chapter text...' })
  @IsString()
  @MinLength(200)
  sourceText: string;

  @ApiPropertyOptional({ description: 'Source type', example: 'ncert_book' })
  @IsOptional()
  @IsString()
  sourceType?: string;

  @ApiPropertyOptional({ description: 'Source location', example: 'ncert/class10/science/ch1.pdf' })
  @IsOptional()
  @IsString()
  sourcePath?: string;
}
