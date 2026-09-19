import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { fields, optionalText, requiredText } from '../request-fields';

@Injectable()
export class CheckInsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) throw new NotFoundException('Projeto não encontrado.');
    return this.prisma.checkIn.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async create(projectId: string, value: unknown) {
    const body = fields(value);
    const userId = requiredText(body, 'userId', 100);
    const summary = requiredText(body, 'summary');
    const difficulties = optionalText(body, 'difficulties');
    const nextSteps = optionalText(body, 'nextSteps');

    const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) throw new NotFoundException('Projeto não encontrado.');
    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { userId: true },
    });
    if (!membership) throw new ForbiddenException('O usuário informado não participa deste projeto.');

    return this.prisma.checkIn.create({ data: { projectId, userId, summary, difficulties, nextSteps } });
  }
}
