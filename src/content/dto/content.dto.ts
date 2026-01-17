import { IsString, IsOptional, IsNumber, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateContentDto {
  @ApiProperty({ description: 'Education board' })
  @IsString()
  board: string;

  @ApiProperty({ description: 'Grade level' })
  @IsString()
  grade: string;

  @ApiProperty({ description: 'Subject name' })
  @IsString()
  subject: string;

  @ApiProperty({ description: 'Unit ID from syllabus' })
  @IsString()
  unit_id: string;

  @ApiProperty({ description: 'Topic ID from syllabus' })
  @IsString()
  topic_id: string;

  @ApiProperty({ description: 'Content title' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Actual content text' })
  @IsString()
  content: string;

  @ApiProperty({ description: 'Additional metadata', required: false })
  @IsOptional()
  @IsObject()
  metadata?: {
    source?: string;
    page?: number;
  };
}

export class SearchContentDto {
  @ApiProperty({ description: 'Search query' })
  @IsString()
  query: string;

  @ApiProperty({ description: 'Filter by topic IDs', required: false, type: [String] })
  @IsOptional()
  topic_ids?: string[];

  @ApiProperty({ description: 'Maximum number of results', required: false })
  @IsOptional()
  @IsNumber()
  limit?: number;
}
