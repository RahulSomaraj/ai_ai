import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ChatSession, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Number of previous Q&A turns fed back to the model for follow-up questions. */
const HISTORY_TURNS = 4;
const TITLE_MAX_LENGTH = 60;

export type ChatTurnRecord = {
  userId: string;
  session: ChatSession | null;
  scope: {
    subjectId: string | null;
    textbookId: string | null;
    classLevel: number;
    sourceType: string | null;
  };
  question: string;
  standaloneQuestion: string | null;
  answer: string;
  status: 'answered' | 'no_context' | 'out_of_scope';
  citations: Prisma.InputJsonValue;
  confidence: number;
  fallback: boolean;
};

@Injectable()
export class ChatHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves the session an ask request continues. Returns null when the request
   * starts a new chat (no sessionId); the session row is only created once the
   * first answer is saved, so "New chat" never leaves an empty session behind.
   */
  async findSessionForAsk(
    userId: string | undefined,
    sessionId: string | undefined,
  ): Promise<ChatSession | null> {
    if (!sessionId) {
      return null;
    }
    if (!userId) {
      throw new BadRequestException('sessionId requires userId.');
    }
    return this.getOwnedSession(userId, sessionId);
  }

  /** Last few turns of a session, oldest first, for follow-up context. */
  async recentTurns(sessionId: string) {
    const rows = await this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: HISTORY_TURNS,
      select: { question: true, answer: true },
    });
    return rows.reverse();
  }

  /** Saves one Q&A turn, creating the session in the same transaction when needed. */
  async saveTurn(turn: ChatTurnRecord) {
    const now = new Date();
    const message = {
      question: turn.question,
      standaloneQuestion: turn.standaloneQuestion,
      answer: turn.answer,
      status: turn.status,
      citations: turn.citations,
      confidence: turn.confidence,
      fallback: turn.fallback,
      createdAt: now,
    };

    if (!turn.session) {
      const session = await this.prisma.chatSession.create({
        data: {
          userId: turn.userId,
          title: this.buildTitle(turn.question),
          subjectId: turn.scope.subjectId,
          textbookId: turn.scope.textbookId,
          classLevel: turn.scope.classLevel,
          sourceType: turn.scope.sourceType,
          lastMessageAt: now,
          messages: { create: message },
        },
        include: { messages: { select: { id: true } } },
      });
      return { sessionId: session.id, messageId: session.messages[0].id };
    }

    const [created] = await this.prisma.$transaction([
      this.prisma.chatMessage.create({
        data: { ...message, sessionId: turn.session.id },
        select: { id: true },
      }),
      this.prisma.chatSession.update({
        where: { id: turn.session.id },
        data: { lastMessageAt: now },
      }),
    ]);
    return { sessionId: turn.session.id, messageId: created.id };
  }

  /** Recent history: the user's sessions, most recently active first. */
  async listSessions(userId: string, limit = 20, cursor?: string) {
    const rows = await this.prisma.chatSession.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        title: true,
        subjectId: true,
        textbookId: true,
        classLevel: true,
        sourceType: true,
        lastMessageAt: true,
        createdAt: true,
        _count: { select: { messages: true } },
        messages: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: { question: true },
        },
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: page.map(({ _count, messages, ...session }) => ({
        ...session,
        messageCount: _count.messages,
        lastQuestion: messages[0]?.question ?? null,
      })),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  /** Chat history: one session's turns in chronological order, newest page first. */
  async listMessages(
    userId: string,
    sessionId: string,
    limit = 50,
    cursor?: string,
  ) {
    const session = await this.getOwnedSession(userId, sessionId);

    const rows = await this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        question: true,
        answer: true,
        status: true,
        citations: true,
        confidence: true,
        fallback: true,
        createdAt: true,
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      session: {
        id: session.id,
        title: session.title,
        subjectId: session.subjectId,
        textbookId: session.textbookId,
        classLevel: session.classLevel,
        sourceType: session.sourceType,
        lastMessageAt: session.lastMessageAt,
        createdAt: session.createdAt,
      },
      items: page.reverse(),
      nextCursor: hasMore ? page[0].id : null,
    };
  }

  async deleteSession(userId: string, sessionId: string) {
    await this.getOwnedSession(userId, sessionId);
    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { deletedAt: new Date() },
    });
    return { id: sessionId, deleted: true };
  }

  private async getOwnedSession(userId: string, sessionId: string) {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId, deletedAt: null },
    });
    if (!session) {
      throw new NotFoundException('Chat session not found.');
    }
    return session;
  }

  private buildTitle(question: string) {
    const text = question.trim().replace(/\s+/g, ' ');
    return text.length > TITLE_MAX_LENGTH
      ? `${text.slice(0, TITLE_MAX_LENGTH - 1).trimEnd()}…`
      : text;
  }
}
