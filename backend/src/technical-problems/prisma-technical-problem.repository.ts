import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  SimilarTechnicalProblem,
  TechnicalProblemRecord,
  TechnicalProblemRepository,
} from './technical-problem.repository';

const EMBEDDING_DIMENSIONS = 1536;
const DEFAULT_SIMILARITY_LIMIT = 5;
const DEFAULT_SIMILARITY_THRESHOLD = 0.78;

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

  async searchSimilar(
    userId: string,
    embedding: number[],
    limit = DEFAULT_SIMILARITY_LIMIT,
    threshold = DEFAULT_SIMILARITY_THRESHOLD,
  ): Promise<SimilarTechnicalProblem[]> {
    const vector = this.toVector(embedding);

    return this.prisma.$queryRaw<SimilarTechnicalProblem[]>`
      WITH query_embedding AS (
        SELECT ${vector}::vector AS value
      ), viewer AS (
        SELECT id, role
        FROM "User"
        WHERE id = ${userId}
      )
      SELECT
        problem.id,
        problem."projectId",
        problem.problem,
        problem.solution,
        problem.technology,
        json_build_object('id', author.id, 'name', author.name) AS author,
        1 - (problem."problemEmbedding" <=> query_embedding.value) AS similarity
      FROM "TechnicalProblem" AS problem
      CROSS JOIN query_embedding
      CROSS JOIN viewer
      INNER JOIN "User" AS author ON author.id = problem."authorId"
      INNER JOIN "Project" AS project ON project.id = problem."projectId"
      WHERE problem."problemEmbedding" IS NOT NULL
        AND problem."sharingAuthorizedAt" IS NOT NULL
        AND problem.solution IS NOT NULL
        AND BTRIM(problem.solution) <> ''
        AND (
          viewer.role = 'ADMIN'
          OR EXISTS (
            SELECT 1
            FROM "TeamMember" AS membership
            WHERE membership."teamId" = project."teamId"
              AND membership."userId" = viewer.id
          )
        )
        AND 1 - (problem."problemEmbedding" <=> query_embedding.value) >= ${threshold}
      ORDER BY similarity DESC
      LIMIT ${limit}
    `;
  }

  async hasProblemEmbedding(id: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ present: boolean }>>`
      SELECT "problemEmbedding" IS NOT NULL AS present
      FROM "TechnicalProblem" WHERE id = ${id}
    `;
    return rows[0]?.present ?? false;
  }

  async setProblemEmbedding(id: string, embedding: number[]): Promise<boolean> {
    const vector = this.toVector(embedding);
    const changed = await this.prisma.$executeRaw`
      UPDATE "TechnicalProblem"
      SET "problemEmbedding" = ${vector}::vector(1536)
      WHERE id = ${id} AND "problemEmbedding" IS NULL
    `;
    return changed === 1;
  }

  async listWithoutEmbedding(): Promise<Array<{ id: string; problem: string }>> {
    return this.prisma.$queryRaw`
      SELECT id, problem FROM "TechnicalProblem"
      WHERE "problemEmbedding" IS NULL ORDER BY "createdAt", id
    `;
  }

  private toVector(embedding: number[]): string {
    if (
      embedding.length !== EMBEDDING_DIMENSIONS
      || embedding.some((value) => !Number.isFinite(value))
    ) {
      throw new Error(
        `O embedding deve possuir ${EMBEDDING_DIMENSIONS} valores numéricos.`,
      );
    }

    return `[${embedding.join(',')}]`;
  }
}

