import { IsString, IsOptional, IsObject, IsBoolean, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RAGQueryDto {
  @ApiProperty({ description: 'User query/question' })
  @IsString()
  query: string;

  @ApiProperty({ description: 'Education board' })
  @IsString()
  board: string;

  @ApiProperty({ description: 'Grade level' })
  @IsString()
  grade: string;

  @ApiProperty({ description: 'Subject name' })
  @IsString()
  subject: string;

  @ApiProperty({ description: 'Optional context (topic_ids, learning_outcomes)', required: false })
  @IsOptional()
  @IsObject()
  context?: {
    topic_ids?: string[];
    learning_outcomes?: string[];
  };
}

export class RAGConfigDto {
  @ApiProperty({ description: 'Maximum number of sources to retrieve', required: false })
  @IsOptional()
  @IsNumber()
  maxSources?: number;

  @ApiProperty({ description: 'Require scope validation', required: false })
  @IsOptional()
  @IsBoolean()
  requireScopeValidation?: boolean;

  @ApiProperty({ description: 'Reject queries out of scope', required: false })
  @IsOptional()
  @IsBoolean()
  rejectOutOfScope?: boolean;
}
