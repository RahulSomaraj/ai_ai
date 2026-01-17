import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  Syllabus,
  Unit,
  Topic,
  QueryMapping,
} from './interfaces/syllabus.interface';
import { CreateSyllabusDto } from './dto/syllabus.dto';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class SyllabusService {
  private readonly logger = new Logger(SyllabusService.name);
  private syllabusCache: Map<string, Syllabus> = new Map();
  private readonly syllabusDir = path.join(process.cwd(), 'data', 'syllabus');

  constructor() {
    this.ensureDirectoryExists();
  }

  private async ensureDirectoryExists() {
    try {
      await fs.mkdir(this.syllabusDir, { recursive: true });
    } catch (error) {
      this.logger.error(
        `Failed to create syllabus directory: ${error.message}`,
      );
    }
  }

  private getSyllabusKey(
    board: string,
    grade: string,
    subject: string,
  ): string {
    return `${board}_${grade}_${subject}`.toUpperCase();
  }

  async createSyllabus(
    createSyllabusDto: CreateSyllabusDto,
  ): Promise<Syllabus> {
    const key = this.getSyllabusKey(
      createSyllabusDto.board,
      createSyllabusDto.grade,
      createSyllabusDto.subject,
    );

    const syllabus: Syllabus = {
      ...createSyllabusDto,
    };

    // Cache in memory
    this.syllabusCache.set(key, syllabus);

    // Persist to file
    const filePath = path.join(this.syllabusDir, `${key}.json`);
    await fs.writeFile(filePath, JSON.stringify(syllabus, null, 2), 'utf-8');

    this.logger.log(`Syllabus created: ${key}`);
    return syllabus;
  }

  async getSyllabus(
    board: string,
    grade: string,
    subject: string,
  ): Promise<Syllabus> {
    const key = this.getSyllabusKey(board, grade, subject);

    // Check cache first
    if (this.syllabusCache.has(key)) {
      return this.syllabusCache.get(key)!;
    }

    // Load from file
    const filePath = path.join(this.syllabusDir, `${key}.json`);
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const syllabus: Syllabus = JSON.parse(fileContent);
      this.syllabusCache.set(key, syllabus);
      return syllabus;
    } catch (error) {
      throw new NotFoundException(
        `Syllabus not found for ${board} ${grade} ${subject}`,
      );
    }
  }

  async getAllTopics(
    board: string,
    grade: string,
    subject: string,
  ): Promise<Topic[]> {
    const syllabus = await this.getSyllabus(board, grade, subject);
    return syllabus.units.flatMap((unit) => unit.topics);
  }

  async getTopicById(
    board: string,
    grade: string,
    subject: string,
    topicId: string,
  ): Promise<Topic> {
    const syllabus = await this.getSyllabus(board, grade, subject);
    for (const unit of syllabus.units) {
      const topic = unit.topics.find((t) => t.topic_id === topicId);
      if (topic) {
        return topic;
      }
    }
    throw new NotFoundException(`Topic ${topicId} not found`);
  }

  async getAllLearningOutcomes(
    board: string,
    grade: string,
    subject: string,
  ): Promise<string[]> {
    const topics = await this.getAllTopics(board, grade, subject);
    return topics.flatMap((topic) => topic.learning_outcomes);
  }

  async mapQueryToSyllabus(
    query: string,
    board: string,
    grade: string,
    subject: string,
  ): Promise<QueryMapping> {
    const syllabus = await this.getSyllabus(board, grade, subject);
    const allTopics = syllabus.units.flatMap((unit) => unit.topics);

    // Simple keyword-based mapping (can be enhanced with ML/NLP)
    const queryLower = query.toLowerCase();
    const matchedTopics: Topic[] = [];
    const matchedOutcomes: string[] = [];

    for (const topic of allTopics) {
      const topicNameLower = topic.topic_name.toLowerCase();

      // Check if query mentions topic name
      if (topicNameLower.split(' ').some((word) => queryLower.includes(word))) {
        matchedTopics.push(topic);
        matchedOutcomes.push(...topic.learning_outcomes);
      } else {
        // Check if query mentions any learning outcome keywords
        for (const outcome of topic.learning_outcomes) {
          const outcomeLower = outcome.toLowerCase();
          const outcomeKeywords = outcomeLower
            .split(' ')
            .filter((word) => word.length > 3); // Filter out common words

          if (outcomeKeywords.some((keyword) => queryLower.includes(keyword))) {
            if (!matchedTopics.includes(topic)) {
              matchedTopics.push(topic);
            }
            if (!matchedOutcomes.includes(outcome)) {
              matchedOutcomes.push(outcome);
            }
          }
        }
      }
    }

    const isInScope = matchedTopics.length > 0;

    return {
      query,
      topic_ids: matchedTopics.map((t) => t.topic_id),
      learning_outcomes: matchedOutcomes,
      isInScope,
      reason: isInScope
        ? `Query maps to ${matchedTopics.length} topic(s)`
        : 'Query does not match any syllabus topics or learning outcomes',
    };
  }

  async validateQueryScope(
    query: string,
    board: string,
    grade: string,
    subject: string,
  ): Promise<{ allowed: boolean; reason: string }> {
    const mapping = await this.mapQueryToSyllabus(query, board, grade, subject);

    return {
      allowed: mapping.isInScope,
      reason: mapping.reason || 'Query is out of syllabus scope',
    };
  }
}
