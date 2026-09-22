import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CheckInRecord, CheckInRepository } from './check-in.repository';

@Injectable()
export class PrismaCheckInRepository extends CheckInRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async projectExists(projectId: string): Promise<boolean> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    return !!project;
  }

  async isProjectMember(projectId: string, userId: string): Promise<boolean> {
    const membership = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId },
      },
      select: { userId: true },
    });
    return !!membership;
  }

  async listByProject(projectId: string): Promise<CheckInRecord[]> {
    return this.prisma.checkIn.findMany({
      where: { projectId },
      include: {
        user: { select: { id: true, name: true } },
        messages: {
          include: {
            message: {
              select: { id: true, content: true, role: true, createdAt: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }) as unknown as CheckInRecord[];
  }

  async findById(id: string): Promise<CheckInRecord | null> {
    return this.prisma.checkIn.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true } },
        messages: {
          include: {
            message: {
              select: { id: true, content: true, role: true, createdAt: true },
            },
          },
        },
      },
    }) as unknown as CheckInRecord | null;
  }

  async create(data: {
    projectId: string;
    userId: string;
    summary: string;
    difficulties?: string | null;
    nextSteps?: string | null;
    messageIds?: string[];
  }): Promise<CheckInRecord> {
    return this.prisma.checkIn.create({
      data: {
        projectId: data.projectId,
        userId: data.userId,
        summary: data.summary,
        difficulties: data.difficulties,
        nextSteps: data.nextSteps,
        ...(data.messageIds && data.messageIds.length > 0
          ? {
              messages: {
                create: data.messageIds.map(messageId => ({ messageId })),
              },
            }
          : {}),
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    }) as unknown as CheckInRecord;
  }
}
