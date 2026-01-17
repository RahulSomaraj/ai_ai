import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTextbookDto } from './dto/create-textbook.dto';
import { UpdateTextbookDto } from './dto/update-textbook.dto';

@Injectable()
export class TextbooksService {
  private readonly logger = new Logger(TextbooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(createTextbookDto: CreateTextbookDto) {
    // Verify subject exists
    const subject = await this.prisma.subject.findUnique({
      where: { id: createTextbookDto.subjectId },
    });

    if (!subject) {
      throw new NotFoundException(
        `Subject with ID ${createTextbookDto.subjectId} not found`,
      );
    }

    // Check if order already exists for this subject
    const existing = await this.prisma.textbook.findFirst({
      where: {
        subjectId: createTextbookDto.subjectId,
        order: createTextbookDto.order,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Textbook with order ${createTextbookDto.order} already exists for this subject`,
      );
    }

    const textbook = await this.prisma.textbook.create({
      data: {
        ...createTextbookDto,
        source: createTextbookDto.source || 'NCERT',
      },
      include: {
        subject: true,
      },
    });

    this.logger.log(
      `Textbook created: ${textbook.title} (Order ${textbook.order}) for ${subject.name}`,
    );
    return textbook;
  }

  async findAll(subjectId?: string) {
    const where = subjectId ? { subjectId } : {};

    return this.prisma.textbook.findMany({
      where,
      include: {
        subject: true,
      },
      orderBy: [
        { subjectId: 'asc' },
        { order: 'asc' },
      ],
    });
  }

  async findOne(id: string) {
    const textbook = await this.prisma.textbook.findUnique({
      where: { id },
      include: {
        subject: true,
      },
    });

    if (!textbook) {
      throw new NotFoundException(`Textbook with ID ${id} not found`);
    }

    return textbook;
  }

  async findBySubject(subjectId: string) {
    // Verify subject exists
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
    });

    if (!subject) {
      throw new NotFoundException(`Subject with ID ${subjectId} not found`);
    }

    return this.prisma.textbook.findMany({
      where: { subjectId },
      include: {
        subject: true,
      },
      orderBy: { order: 'asc' },
    });
  }

  async update(id: string, updateTextbookDto: UpdateTextbookDto) {
    // If updating order, check for conflicts
    if (updateTextbookDto.order !== undefined) {
      const current = await this.prisma.textbook.findUnique({
        where: { id },
      });

      if (!current) {
        throw new NotFoundException(`Textbook with ID ${id} not found`);
      }

      const existing = await this.prisma.textbook.findFirst({
        where: {
          subjectId: current.subjectId,
          order: updateTextbookDto.order,
          id: { not: id },
        },
      });

      if (existing) {
        throw new BadRequestException(
          `Textbook with order ${updateTextbookDto.order} already exists for this subject`,
        );
      }
    }

    try {
      const textbook = await this.prisma.textbook.update({
        where: { id },
        data: updateTextbookDto,
        include: {
          subject: true,
        },
      });

      this.logger.log(`Textbook updated: ${textbook.id}`);
      return textbook;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Textbook with ID ${id} not found`);
      }
      throw error;
    }
  }

  async remove(id: string) {
    try {
      const textbook = await this.prisma.textbook.delete({
        where: { id },
        include: {
          subject: true,
        },
      });

      this.logger.log(`Textbook deleted: ${textbook.id}`);
      return {
        message: `Textbook "${textbook.title}" deleted successfully`,
      };
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Textbook with ID ${id} not found`);
      }
      throw error;
    }
  }
}
