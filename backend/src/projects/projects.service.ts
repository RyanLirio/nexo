import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        team: { select: { id: true, name: true, organizationId: true } },
        members: { include: { user: { select: { id: true, name: true } } } },
        checkIns: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!project) throw new NotFoundException('Projeto não encontrado.');
    return project;
  }

  async listByUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return this.prisma.project.findMany({
      where: { members: { some: { userId } } },
      include: { team: { select: { id: true, name: true } }, checkIns: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { name: 'asc' },
    });
  }

  async listByTeam(teamId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId }, select: { id: true } });
    if (!team) throw new NotFoundException('Equipe não encontrada.');
    return this.prisma.project.findMany({ where: { teamId }, orderBy: { name: 'asc' } });
  }
}
