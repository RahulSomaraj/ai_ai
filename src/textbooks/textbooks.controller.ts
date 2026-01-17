import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TextbooksService } from './textbooks.service';
import { CreateTextbookDto } from './dto/create-textbook.dto';
import { UpdateTextbookDto } from './dto/update-textbook.dto';

@ApiTags('Textbooks')
@Controller('textbooks')
export class TextbooksController {
  constructor(private readonly textbooksService: TextbooksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new textbook' })
  @ApiResponse({ status: 201, description: 'Textbook created successfully' })
  @ApiResponse({ status: 404, description: 'Subject not found' })
  @ApiResponse({ status: 400, description: 'Order conflict' })
  async create(@Body() createTextbookDto: CreateTextbookDto) {
    return this.textbooksService.create(createTextbookDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all textbooks' })
  @ApiResponse({ status: 200, description: 'List of all textbooks' })
  async findAll(@Query('subjectId') subjectId?: string) {
    if (subjectId) {
      return this.textbooksService.findBySubject(subjectId);
    }
    return this.textbooksService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get textbook by ID' })
  @ApiResponse({ status: 200, description: 'Textbook found' })
  @ApiResponse({ status: 404, description: 'Textbook not found' })
  async findOne(@Param('id') id: string) {
    return this.textbooksService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update textbook' })
  @ApiResponse({ status: 200, description: 'Textbook updated' })
  @ApiResponse({ status: 404, description: 'Textbook not found' })
  @ApiResponse({ status: 400, description: 'Order conflict' })
  async update(@Param('id') id: string, @Body() updateTextbookDto: UpdateTextbookDto) {
    return this.textbooksService.update(id, updateTextbookDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete textbook' })
  @ApiResponse({ status: 200, description: 'Textbook deleted' })
  @ApiResponse({ status: 404, description: 'Textbook not found' })
  async remove(@Param('id') id: string) {
    return this.textbooksService.remove(id);
  }

  @Get('subject/:subjectId')
  @ApiOperation({ summary: 'Get all textbooks for a subject' })
  @ApiResponse({ status: 200, description: 'List of textbooks' })
  @ApiResponse({ status: 404, description: 'Subject not found' })
  async findBySubject(@Param('subjectId') subjectId: string) {
    return this.textbooksService.findBySubject(subjectId);
  }
}
