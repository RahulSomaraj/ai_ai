import { ApiContract } from '../config/api-docs';
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
import { SubjectsService } from './subjects.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';

@ApiTags('Subjects')
@Controller('subjects')
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @ApiContract('subjects.create')
  @Post()
  @ApiOperation({ summary: 'Create a new subject' })
  @ApiResponse({ status: 201, description: 'Subject created successfully' })
  async create(@Body() createSubjectDto: CreateSubjectDto) {
    return this.subjectsService.create(createSubjectDto);
  }

  @ApiContract('subjects.findAll')
  @Get()
  @ApiOperation({ summary: 'Get all subjects' })
  @ApiResponse({ status: 200, description: 'List of all subjects' })
  async findAll(
    @Query('class') classFilter?: number,
    @Query('name') nameFilter?: string,
  ) {
    if (classFilter && nameFilter) {
      return this.subjectsService.findByClassAndName(classFilter, nameFilter);
    }
    return this.subjectsService.findAll();
  }

  @ApiContract('subjects.findOne', ['id'])
  @Get(':id')
  @ApiOperation({ summary: 'Get subject by ID' })
  @ApiResponse({ status: 200, description: 'Subject found' })
  @ApiResponse({ status: 404, description: 'Subject not found' })
  async findOne(@Param('id') id: string) {
    return this.subjectsService.findOne(id);
  }

  @ApiContract('subjects.update', ['id'])
  @Patch(':id')
  @ApiOperation({ summary: 'Update subject' })
  @ApiResponse({ status: 200, description: 'Subject updated' })
  @ApiResponse({ status: 404, description: 'Subject not found' })
  async update(
    @Param('id') id: string,
    @Body() updateSubjectDto: UpdateSubjectDto,
  ) {
    return this.subjectsService.update(id, updateSubjectDto);
  }

  @ApiContract('subjects.remove', ['id'])
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete subject' })
  @ApiResponse({ status: 200, description: 'Subject deleted' })
  @ApiResponse({ status: 404, description: 'Subject not found' })
  async remove(@Param('id') id: string) {
    return this.subjectsService.remove(id);
  }

  @ApiContract('subjects.getTextbooksCount', ['id'])
  @Get(':id/textbooks/count')
  @ApiOperation({ summary: 'Get textbooks count for a subject' })
  async getTextbooksCount(@Param('id') id: string) {
    const count = await this.subjectsService.getTextbooksCount(id);
    return { count };
  }
}
