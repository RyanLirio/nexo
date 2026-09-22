import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { KnowledgeEntryRecord, KnowledgeRepository } from './knowledge.repository';

@Injectable()
export class PrismaKnowledgeRepository extends KnowledgeRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async list(query?: string, projectId?: string): Promise<any[]> {
    const term = query?.trim();
    return this.prisma.knowledgeEntry.findMany({
      where: {
        sharingAuthorizedAt: { not: null },
        ...(projectId ? { projectId } : {}),
        ...(term
          ? {
              OR: ['title', 'problem', 'technology', 'solution'].map(field => ({
                [field]: { contains: term, mode: 'insensitive' as const },
              })),
            }
          : {}),
      },
      select: {
        id: true,
        projectId: true,
        title: true,
        problem: true,
        technology: true,
        solution: true,
        createdAt: true,
        author: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async findById(id: string): Promise<any | null> {
    return this.prisma.knowledgeEntry.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    });
  }

  async create(data: {
    projectId: string;
    authorId: string;
    title: string;
    problem: string;
    solution: string;
    technology?: string | null;
    sourceCheckInId?: string | null;
    sourceHelpRequestId?: string | null;
  }): Promise<KnowledgeEntryRecord> {
    return this.prisma.knowledgeEntry.create({
      data: {
        projectId: data.projectId,
        authorId: data.authorId,
        title: data.title,
        problem: data.problem,
        solution: data.solution,
        technology: data.technology,
        sourceCheckInId: data.sourceCheckInId,
        sourceHelpRequestId: data.sourceHelpRequestId,
      },
    }) as unknown as KnowledgeEntryRecord;
  }

  async authorize(id: string, authorId: string, authorizedAt: Date): Promise<KnowledgeEntryRecord> {
    return this.prisma.knowledgeEntry.update({
      where: { id },
      data: {
        sharingAuthorizedBy: authorId,
        sharingAuthorizedAt: authorizedAt,
      },
    }) as unknown as KnowledgeEntryRecord;
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

  async findSourceCheckIn(id: string): Promise<{ projectId: string } | null> {
    return this.prisma.checkIn.findUnique({
      where: { id },
      select: { projectId: true },
    });
  }

  async findSourceHelpRequest(id: string): Promise<{ projectId: string } | null> {
    return this.prisma.helpRequest.findUnique({
      where: { id },
      select: { projectId: true },
    });
  }
}
