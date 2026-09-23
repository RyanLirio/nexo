import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { HelpRequestRecord, HelpRequestRepository } from './help-request.repository';

@Injectable()
export class PrismaHelpRequestRepository extends HelpRequestRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async list(projectId?: string, status?: string): Promise<HelpRequestRecord[]> {
    const where: Record<string, unknown> = {};
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;

    return this.prisma.helpRequest.findMany({
      where,
      include: {
        requester: { select: { id: true, name: true } },
        helper: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }) as unknown as HelpRequestRecord[];
  }

  async findById(id: string): Promise<HelpRequestRecord | null> {
    return this.prisma.helpRequest.findUnique({
      where: { id },
      include: {
        requester: { select: { id: true, name: true } },
        helper: { select: { id: true, name: true } },
      },
    }) as unknown as HelpRequestRecord | null;
  }

  async create(data: {
    projectId: string;
    requesterId: string;
    problem: string;
    helperId?: string | null;
  }): Promise<HelpRequestRecord> {
    return this.prisma.helpRequest.create({
      data: {
        projectId: data.projectId,
        requesterId: data.requesterId,
        problem: data.problem,
        helperId: data.helperId,
      },
      include: {
        requester: { select: { id: true, name: true } },
        helper: { select: { id: true, name: true } },
      },
    }) as unknown as HelpRequestRecord;
  }

  async updateStatus(
    id: string,
    status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED',
    resolvedAt: Date | null,
  ): Promise<HelpRequestRecord> {
    return this.prisma.helpRequest.update({
      where: { id },
      data: {
        status,
        resolvedAt,
      },
      include: {
        requester: { select: { id: true, name: true } },
        helper: { select: { id: true, name: true } },
      },
    }) as unknown as HelpRequestRecord;
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
}
