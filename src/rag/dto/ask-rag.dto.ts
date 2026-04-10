import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { TransformOptionalTextbookId } from '../utils/optional-textbook-id';

export class AskRagDto {
  @ApiPropertyOptional({
    description:
      'Optional canonical subject ID from subjects table. Omit for class-only retrieval.',
    example: 'seed-11-physics',
  })
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiPropertyOptional({
    description: 'Canonical textbook ID from textbooks table (omit unless set)',
    example: 'seed-11-physics-tb1',
  })
  @TransformOptionalTextbookId()
  @IsOptional()
  @IsString()
  textbookId?: string;

  @ApiProperty({
    description: 'Student doubt/question to resolve from NCERT context',
    example: 'Why does magnesium burn with a bright white flame?',
  })
  @IsString()
  question: string;

  @ApiPropertyOptional({
    description:
      'Optional subject name filter. Omit for class-only retrieval across all subjects.',
    example: 'Physics',
  })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty({ description: 'Class level filter', example: 10, minimum: 1, maximum: 12 })
  @IsInt()
  @Min(1)
  @Max(12)
  classLevel: number;

  @ApiPropertyOptional({
    description: 'Optional chapter filter',
    example: 'Chemical Reactions and Equations',
  })
  @IsOptional()
  @IsString()
  chapter?: string;

  @ApiPropertyOptional({ description: 'Top K chunks to retrieve', example: 5, minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  topK?: number;
}
