import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { fields, optionalText, requiredText } from '../request-fields';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        team: { select: { id: true, name: true, organizationId: true } },
        leader: { select: { id: true, name: true } },
        responsibleUser: { select: { id: true, name: true } },
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
      include: {
        team: { select: { id: true, name: true } },
        leader: { select: { id: true, name: true } },
        responsibleUser: { select: { id: true, name: true } },
        checkIns: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { name: 'asc' },
    });
  }

  async listByTeam(teamId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId }, select: { id: true } });
    if (!team) throw new NotFoundException('Equipe não encontrada.');
    return this.prisma.project.findMany({
      where: { teamId },
      include: {
        leader: { select: { id: true, name: true } },
        responsibleUser: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async create(value: unknown) {
    const body = fields(value);
    const teamId = requiredText(body, 'teamId', 100);
    const name = requiredText(body, 'name', 160);
    const description = optionalText(body, 'description');
    const leaderId = optionalText(body, 'leaderId', 100);
    const responsibleUserId = optionalText(body, 'responsibleUserId', 100);
    const createdBy = optionalText(body, 'createdBy', 100);

    const team = await this.prisma.team.findUnique({ where: { id: teamId }, select: { id: true } });
    if (!team) throw new NotFoundException('Equipe não encontrada.');

    if (leaderId) {
      const leaderMember = await this.prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId: leaderId } },
      });
      if (!leaderMember) throw new BadRequestException('O líder deve pertencer à mesma equipe do projeto.');
      if (leaderMember.role !== 'LEADER') throw new BadRequestException('Apenas membros com papel LEADER podem liderar o projeto.');
    }

    if (responsibleUserId) {
      const responsibleMember = await this.prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId: responsibleUserId } },
      });
      if (!responsibleMember) throw new BadRequestException('O responsável deve pertencer à mesma equipe do projeto.');
    }

    const membersToCreate: { userId: string; role: 'OWNER' | 'MEMBER' }[] = [];
    if (leaderId) {
      membersToCreate.push({ userId: leaderId, role: 'OWNER' });
    }
    if (responsibleUserId && responsibleUserId !== leaderId) {
      membersToCreate.push({ userId: responsibleUserId, role: 'MEMBER' });
    }

    return this.prisma.project.create({
      data: {
        teamId,
        name,
        description,
        leaderId,
        responsibleUserId,
        createdBy,
        ...(membersToCreate.length > 0 ? {
          members: {
            create: membersToCreate,
          },
        } : {}),
      },
    });
  }
}
