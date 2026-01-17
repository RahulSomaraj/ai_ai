import { IsString, IsArray, IsObject, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class LearningOutcomeDto {
  @ApiProperty({ description: 'Learning outcome statement' })
  @IsString()
  outcome: string;
}

export class TopicDto {
  @ApiProperty({ description: 'Unique topic identifier' })
  @IsString()
  topic_id: string;

  @ApiProperty({ description: 'Topic name' })
  @IsString()
  topic_name: string;

  @ApiProperty({ description: 'Learning outcomes for this topic', type: [String] })
  @IsArray()
  @IsString({ each: true })
  learning_outcomes: string[];
}

export class UnitDto {
  @ApiProperty({ description: 'Unique unit identifier' })
  @IsString()
  unit_id: string;

  @ApiProperty({ description: 'Unit name' })
  @IsString()
  unit_name: string;

  @ApiProperty({ description: 'Topics in this unit', type: [TopicDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TopicDto)
  topics: TopicDto[];
}

export class SyllabusDto {
  @ApiProperty({ description: 'Education board' })
  @IsString()
  board: string;

  @ApiProperty({ description: 'Grade level' })
  @IsString()
  grade: string;

  @ApiProperty({ description: 'Subject name' })
  @IsString()
  subject: string;

  @ApiProperty({ description: 'Language' })
  @IsString()
  language: string;

  @ApiProperty({ description: 'Syllabus version' })
  @IsString()
  version: string;

  @ApiProperty({ description: 'Units in the syllabus', type: [UnitDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UnitDto)
  units: UnitDto[];
}

export class CreateSyllabusDto extends SyllabusDto {}

export class QueryMappingDto {
  @ApiProperty({ description: 'User query' })
  @IsString()
  query: string;

  @ApiProperty({ description: 'Mapped topic IDs', type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  topic_ids?: string[];

  @ApiProperty({ description: 'Mapped learning outcomes', type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  learning_outcomes?: string[];
}
