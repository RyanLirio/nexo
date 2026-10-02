import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TechnicalProblemRecord, TechnicalProblemRepository } from './technical-problem.repository';

@Injectable()
export class PrismaTechnicalProblemRepository extends TechnicalProblemRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async list(
    query?: string,
    projectId?: string,
    filter?: { status?: string; technology?: string; onlyAuthorized?: boolean },
  ): Promise<any[]> {
    const term = query?.trim();
    const where: Record<string, unknown> = {};

    if (filter?.onlyAuthorized !== false) {
      where.sharingAuthorizedAt = { not: null };
    }

    if (projectId) {
      where.projectId = projectId;
    }

    if (filter?.status === 'OPEN') {
      where.solution = null;
    } else if (filter?.status === 'RESOLVED') {
      where.solution = { not: null };
    }

    if (filter?.technology) {
      where.technology = { contains: filter.technology, mode: 'insensitive' as const };
    }

    if (term) {
      where.OR = ['title', 'problem', 'technology', 'solution'].map(field => ({
        [field]: { contains: term, mode: 'insensitive' as const },
      }));
    }

    return this.prisma.technicalProblem.findMany({
      where,
      select: {
        id: true,
        projectId: true,
        title: true,
        problem: true,
        technology: true,
        solution: true,
        sharingAuthorizedAt: true,
        createdAt: true,
        author: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }


  async findById(id: string): Promise<any | null> {
    return this.prisma.technicalProblem.findUnique({
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
    solution?: string | null;
    technology?: string | null;
    sourceCheckInId?: string | null;
    sourceHelpRequestId?: string | null;
  }): Promise<TechnicalProblemRecord> {
    return this.prisma.technicalProblem.create({
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
    }) as unknown as TechnicalProblemRecord;
  }

  async authorize(id: string, authorId: string, authorizedAt: Date): Promise<TechnicalProblemRecord> {
    return this.prisma.technicalProblem.update({
      where: { id },
      data: {
        sharingAuthorizedBy: authorId,
        sharingAuthorizedAt: authorizedAt,
      },
    }) as unknown as TechnicalProblemRecord;
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

  async updateSolution(id: string, solution: string): Promise<TechnicalProblemRecord> {
    return this.prisma.technicalProblem.update({
      where: { id },
      data: { solution },
    }) as unknown as TechnicalProblemRecord;
  }
}

