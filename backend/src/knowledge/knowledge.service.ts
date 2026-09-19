import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { fields, optionalText, requiredText } from '../request-fields';

@Injectable()
export class KnowledgeService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query?: string, projectId?: string) {
    if (query !== undefined && (typeof query !== 'string' || query.length > 200)) {
      throw new BadRequestException('A busca deve ter até 200 caracteres.');
    }
    if (projectId !== undefined && (typeof projectId !== 'string' || projectId.length > 100)) {
      throw new BadRequestException('Projeto inválido.');
    }
    const term = query?.trim();
    return this.prisma.knowledgeEntry.findMany({
      where: {
        sharingAuthorizedAt: { not: null },
        ...(projectId ? { projectId } : {}),
        ...(term ? { OR: ['title', 'problem', 'technology', 'solution'].map((field) => ({ [field]: { contains: term, mode: 'insensitive' as const } })) } : {}),
      },
      select: {
        id: true, projectId: true, title: true, problem: true, technology: true,
        solution: true, createdAt: true, author: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getById(id: string) {
    const entry = await this.prisma.knowledgeEntry.findFirst({
      where: { id, sharingAuthorizedAt: { not: null } },
      include: { author: { select: { id: true, name: true } }, project: { select: { id: true, name: true } } },
    });
    if (!entry) throw new NotFoundException('Conhecimento compartilhado não encontrado.');
    return entry;
  }

  async create(value: unknown) {
    const body = fields(value);
    const projectId = requiredText(body, 'projectId', 100);
    const authorId = requiredText(body, 'authorId', 100);
    const title = requiredText(body, 'title', 160);
    const problem = requiredText(body, 'problem');
    const solution = requiredText(body, 'solution');
    const technology = optionalText(body, 'technology', 160);
    const sourceCheckInId = optionalText(body, 'sourceCheckInId', 100);

    const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) throw new NotFoundException('Projeto não encontrado.');
    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: authorId } },
      select: { userId: true },
    });
    if (!membership) throw new ForbiddenException('O autor informado não participa deste projeto.');
    if (sourceCheckInId) {
      const source = await this.prisma.checkIn.findUnique({
        where: { id: sourceCheckInId },
        select: { projectId: true },
      });
      if (!source || source.projectId !== projectId) {
        throw new BadRequestException('O check-in de origem deve pertencer ao mesmo projeto.');
      }
    }
    return this.prisma.knowledgeEntry.create({
      data: { projectId, authorId, title, problem, solution, technology, sourceCheckInId },
    });
  }

  async authorize(id: string, value: unknown) {
    const authorId = requiredText(fields(value), 'authorId', 100);
    const entry = await this.prisma.knowledgeEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Conhecimento não encontrado.');
    if (entry.authorId !== authorId) throw new ForbiddenException('Somente o autor informado pode autorizar.');
    if (entry.sharingAuthorizedAt) return entry;
    return this.prisma.knowledgeEntry.update({
      where: { id },
      data: { sharingAuthorizedAt: new Date() },
    });
  }
}
