import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  ConversationRecord,
  ConversationRepository,
  MessageRecord,
  PendingSolutionSuggestionInput,
  PendingSolutionSuggestionRecord,
} from './conversation.repository';

@Injectable()
export class PrismaConversationRepository extends ConversationRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findDailyConversation(
    userId: string,
    startOfDay: Date,
    endOfDay: Date,
  ): Promise<ConversationRecord | null> {
    return this.prisma.conversation.findFirst({
      where: {
        userId,
        createdAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    }) as unknown as ConversationRecord | null;
  }

  async createConversation(
    userId: string,
  ): Promise<ConversationRecord> {
    return this.prisma.conversation.create({
      data: {
        userId,
      },
    }) as unknown as ConversationRecord;
  }

  async createMessage(data: {
    conversationId: string;
    senderId?: string | null;
    role?: MessageRecord['role'];
    content: string;
  }): Promise<MessageRecord> {
    return this.prisma.message.create({
      data: {
        conversationId: data.conversationId,
        senderId: data.senderId,
        role: data.role ?? 'USER',
        content: data.content,
      },
    }) as unknown as MessageRecord;
  }

  async linkProject(
    conversationId: string,
    projectId: string,
  ): Promise<void> {
    await this.prisma.conversationProject.upsert({
      where: {
        conversationId_projectId: {
          conversationId,
          projectId,
        },
      },
      create: {
        conversationId,
        projectId,
      },
      update: {},
    });
  }

  async findRecentMessages(
    userId: string,
    limit: number = 10,
  ): Promise<MessageRecord[]> {
    return this.prisma.message.findMany({
      where: {
        conversation: { userId },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }) as unknown as MessageRecord[];
  }

  async savePendingSuggestion(data: PendingSolutionSuggestionInput): Promise<PendingSolutionSuggestionRecord> {
    return this.prisma.pendingTechnicalSolutionSuggestion.upsert({
      where: { userId_conversationId_projectId: {
        userId: data.userId, conversationId: data.conversationId, projectId: data.projectId,
      } },
      create: data,
      update: { technicalProblemId: data.technicalProblemId, similarity: data.similarity, status: 'PENDING' },
    });
  }

  async findPendingSuggestions(userId: string, conversationId: string): Promise<PendingSolutionSuggestionRecord[]> {
    return this.prisma.pendingTechnicalSolutionSuggestion.findMany({
      where: { userId, conversationId, status: 'PENDING', conversation: { userId } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async completeSuggestion(
    suggestion: PendingSolutionSuggestionRecord,
    status: 'ACCEPTED' | 'DECLINED',
    assistantContent: string,
  ): Promise<MessageRecord | null> {
    // Compare-and-set: uma resposta concorrente não aceita uma sugestão já trocada/encerrada.
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.pendingTechnicalSolutionSuggestion.updateMany({
        where: {
          id: suggestion.id, userId: suggestion.userId, conversationId: suggestion.conversationId,
          technicalProblemId: suggestion.technicalProblemId, updatedAt: suggestion.updatedAt,
          status: 'PENDING', conversation: { userId: suggestion.userId },
        },
        data: { status },
      });
      if (result.count !== 1) return null;
      return tx.message.create({ data: {
        conversationId: suggestion.conversationId, role: 'ASSISTANT', content: assistantContent,
      } });
    });
  }
}