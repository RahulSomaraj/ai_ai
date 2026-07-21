import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Assign existing chunks to syllabus topics for a subject.
 * Reuses chunk embeddings already stored in the DB — no re-embedding of content.
 */
export class MapTopicsDto {
  @ApiProperty({
    description: 'Canonical subject ID whose syllabus topics to map chunks against.',
    example: 'seed-11-physics',
  })
  @IsString()
  subjectId: string;

  @ApiPropertyOptional({
    description:
      'Minimum cosine similarity (0-1) for a chunk to be tagged with its nearest topic. ' +
      'Chunks below this stay untagged. Defaults to RAG_TOPIC_MIN_SIMILARITY (0.3).',
    example: 0.3,
    minimum: 0,
    maximum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minSimilarity?: number;

  @ApiPropertyOptional({
    description:
      'When true, only assign topics to chunks that are not already tagged. ' +
      'When false (default), re-map every in-scope chunk.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  onlyUntagged?: boolean;
}

/** Embed (or re-embed) all syllabus topics for a subject. */
export class EmbedTopicsDto {
  @ApiProperty({
    description: 'Canonical subject ID whose topics to embed.',
    example: 'seed-11-physics',
  })
  @IsString()
  subjectId: string;
}
