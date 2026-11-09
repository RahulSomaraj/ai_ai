import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatHistoryService } from './chat-history.service';

describe('ChatHistoryService.lastQuestion', () => {
  const prisma = {
    chatMessage: { findFirst: jest.fn() },
    chatSession: { findFirst: jest.fn() },
  };
  const service = new ChatHistoryService(prisma as unknown as PrismaService);

  beforeEach(() => jest.resetAllMocks());

  it('scopes the latest question to the user and excludes deleted sessions', async () => {
    const question = { id: 'm1', sessionId: 's1', question: 'Why?', createdAt: new Date() };
    prisma.chatMessage.findFirst.mockResolvedValue(question);
    await expect(service.lastQuestion('u1')).resolves.toEqual(question);
    expect(prisma.chatMessage.findFirst).toHaveBeenCalledWith({
      where: { session: { userId: 'u1', deletedAt: null } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, sessionId: true, question: true, createdAt: true },
    });
  });

  it('returns null for a user with no saved questions', async () => {
    prisma.chatMessage.findFirst.mockResolvedValue(null);
    await expect(service.lastQuestion('u1')).resolves.toBeNull();
  });

  it('restricts a session lookup to an active session owned by the user', async () => {
    prisma.chatSession.findFirst.mockResolvedValue({ id: 's1' });
    prisma.chatMessage.findFirst.mockResolvedValue(null);
    await service.lastQuestion('u1', 's1');
    expect(prisma.chatSession.findFirst).toHaveBeenCalledWith({
      where: { id: 's1', userId: 'u1', deletedAt: null },
    });
    expect(prisma.chatMessage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionId: 's1', session: { userId: 'u1', deletedAt: null } },
      }),
    );
  });

  it('rejects missing, deleted, or other users sessions before reading messages', async () => {
    prisma.chatSession.findFirst.mockResolvedValue(null);
    await expect(service.lastQuestion('u1', 's2')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.chatMessage.findFirst).not.toHaveBeenCalled();
  });
});
