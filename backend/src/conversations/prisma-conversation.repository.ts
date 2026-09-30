import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  ConversationRecord,
  ConversationRepository,
  MessageRecord,
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
    senderId: string;
    content: string;
  }): Promise<MessageRecord> {
    return this.prisma.message.create({
      data: {
        conversationId: data.conversationId,
        senderId: data.senderId,
        role: 'USER',
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
}