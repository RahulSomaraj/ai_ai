import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
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

  @ApiPropertyOptional({
    description:
      'When true, retrieval ignores subject/subjectId filter and searches all subjects for classLevel. ' +
      'subjectId may still be sent to validate textbook scope and to align classLevel with the subject row.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  crossSubject?: boolean;

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

  @ApiPropertyOptional({
    description:
      'Optional syllabus TOPIC code (e.g. "PHY_U1_T3"). Restricts retrieval to chunks ' +
      'tagged with this syllabus topic. Requires a resolvable subject (subjectId, or subject + classLevel).',
    example: 'PHY_U1_T3',
  })
  @IsOptional()
  @IsString()
  topicCode?: string;

  @ApiPropertyOptional({
    description:
      'Optional syllabus UNIT code (e.g. "PHY_U1"). Restricts retrieval to chunks tagged ' +
      'with any topic in this unit. Requires a resolvable subject.',
    example: 'PHY_U1',
  })
  @IsOptional()
  @IsString()
  unitCode?: string;

  @ApiPropertyOptional({
    description:
      'When true, if no in-scope passage clears the similarity threshold the request is ' +
      'rejected as out-of-syllabus (HTTP 403) instead of falling back to nearest chunks.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  rejectOutOfScope?: boolean;

  @ApiPropertyOptional({
    description:
      'Only use content from one source/board, e.g. "ncert_book" (CBSE) or ' +
      '"scert_kerala_book" (Kerala State). Omit to search all sources.',
    example: 'scert_kerala_book',
  })
  @IsOptional()
  @IsString()
  sourceType?: string;

  @ApiPropertyOptional({ description: 'Top K chunks to retrieve', example: 5, minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  topK?: number;
}
