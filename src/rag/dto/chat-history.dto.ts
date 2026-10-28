import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ChatOwnerQueryDto {
  @ApiProperty({
    description: 'ID of the student who owns the chat history',
    example: 'stu_1024',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  userId: string;
}

export class ListChatSessionsQueryDto extends ChatOwnerQueryDto {
  @ApiPropertyOptional({
    description: 'Page size',
    example: 20,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({
    description:
      'Pass the previous response `nextCursor` to load the next (older) page',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}

export class ListChatMessagesQueryDto extends ChatOwnerQueryDto {
  @ApiPropertyOptional({
    description: 'Page size',
    example: 50,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description:
      'Pass the previous response `nextCursor` to load messages older than the current page',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}
