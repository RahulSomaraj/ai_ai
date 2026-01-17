import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';

@Injectable()
export class SubjectsService {
  private readonly logger = new Logger(SubjectsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(createSubjectDto: CreateSubjectDto) {
    const subject = await this.prisma.subject.create({
      data: createSubjectDto,
      include: {
        textbooks: {
          orderBy: { order: 'asc' },
        },
      },
    });

    this.logger.log(`Subject created: ${subject.name} (Class ${subject.class})`);
    return subject;
  }

  async findAll() {
    return this.prisma.subject.findMany({
      include: {
        textbooks: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: { textbooks: true },
        },
      },
      orderBy: [
        { class: 'asc' },
        { name: 'asc' },
      ],
    });
  }

  async findOne(id: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { id },
      include: {
        textbooks: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: { textbooks: true },
        },
      },
    });

    if (!subject) {
      throw new NotFoundException(`Subject with ID ${id} not found`);
    }

    return subject;
  }

  async findByClassAndName(classNumber: number, name: string) {
    const subject = await this.prisma.subject.findFirst({
      where: {
        class: classNumber,
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
      include: {
        textbooks: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: { textbooks: true },
        },
      },
    });

    return subject;
  }

  async update(id: string, updateSubjectDto: UpdateSubjectDto) {
    try {
      const subject = await this.prisma.subject.update({
        where: { id },
        data: updateSubjectDto,
        include: {
          textbooks: {
            orderBy: { order: 'asc' },
          },
          _count: {
            select: { textbooks: true },
          },
        },
      });

      this.logger.log(`Subject updated: ${subject.id}`);
      return subject;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Subject with ID ${id} not found`);
      }
      throw error;
    }
  }

  async remove(id: string) {
    try {
      const subject = await this.prisma.subject.delete({
        where: { id },
      });

      this.logger.log(`Subject deleted: ${subject.id}`);
      return { message: `Subject ${subject.name} deleted successfully` };
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Subject with ID ${id} not found`);
      }
      throw error;
    }
  }

  /**
   * Get textbooks count for a subject (derived, not authoritative)
   */
  async getTextbooksCount(id: string): Promise<number> {
    const count = await this.prisma.textbook.count({
      where: { subjectId: id },
    });
    return count;
  }
}
