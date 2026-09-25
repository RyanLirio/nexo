import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ProjectMemberRecord, ProjectRecord, ProjectRepository } from './project.repository';

@Injectable()
export class PrismaProjectRepository extends ProjectRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: string): Promise<any | null> {
    return this.prisma.project.findUnique({
      where: { id },
      include: {
        team: { select: { id: true, name: true } },
        leader: { select: { id: true, name: true } },
        responsibleUser: { select: { id: true, name: true } },
        members: { include: { user: { select: { id: true, name: true } } } },
        checkIns: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  }

  async list(filter?: { teamId?: string; status?: string; userId?: string }): Promise<any[]> {
    const where: Record<string, unknown> = {};
    if (filter?.teamId) where.teamId = filter.teamId;
    if (filter?.status) where.status = filter.status;
    if (filter?.userId) where.members = { some: { userId: filter.userId } };

    return this.prisma.project.findMany({
      where,
      include: {
        team: { select: { id: true, name: true } },
        leader: { select: { id: true, name: true } },
        responsibleUser: { select: { id: true, name: true } },
        checkIns: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { name: 'asc' },
    });
  }

  async create(data: {
    teamId: string;
    name: string;
    description?: string | null;
    leaderId?: string | null;
    responsibleUserId?: string | null;
    createdBy?: string | null;
    members?: { userId: string; role: 'OWNER' | 'MEMBER' }[];
  }): Promise<ProjectRecord> {
    return this.prisma.project.create({
      data: {
        teamId: data.teamId,
        name: data.name,
        description: data.description,
        leaderId: data.leaderId,
        responsibleUserId: data.responsibleUserId,
        createdBy: data.createdBy,
        ...(data.members && data.members.length > 0
          ? {
              members: {
                create: data.members,
              },
            }
          : {}),
      },
    }) as unknown as ProjectRecord;
  }

  async update(id: string, data: { name?: string; description?: string | null }): Promise<ProjectRecord> {
    return this.prisma.project.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
      },
    }) as unknown as ProjectRecord;
  }

  async updateStatus(
    id: string,
    newStatus: string,
    changedById: string,
    reason?: string | null,
    previousStatus?: string,
  ): Promise<ProjectRecord> {
    return this.prisma.$transaction(async tx => {
      const updated = await tx.project.update({
        where: { id },
        data: { status: newStatus as any },
      });

      await tx.projectStatusHistory.create({
        data: {
          projectId: id,
          previousStatus: (previousStatus || updated.status) as any,
          newStatus: newStatus as any,
          changedById,
          reason,
        },
      });

      return updated as unknown as ProjectRecord;
    });
  }

  async listMembers(projectId: string): Promise<ProjectMemberRecord[]> {
    return this.prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { joinedAt: 'asc' },
    }) as unknown as ProjectMemberRecord[];
  }

  async findMember(projectId: string, userId: string): Promise<ProjectMemberRecord | null> {
    return this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    }) as unknown as ProjectMemberRecord | null;
  }

  async addMember(projectId: string, userId: string, role: 'OWNER' | 'MEMBER' = 'MEMBER'): Promise<ProjectMemberRecord> {
    return this.prisma.projectMember.upsert({
      where: {
        projectId_userId: { projectId, userId },
      },
      create: {
        projectId,
        userId,
        role,
      },
      update: {
        role,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    }) as unknown as ProjectMemberRecord;
  }

  async removeMember(projectId: string, userId: string): Promise<void> {
    await this.prisma.projectMember.delete({
      where: {
        projectId_userId: { projectId, userId },
      },
    });
  }

  async findTeam(teamId: string): Promise<{ id: string } | null> {
    return this.prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true },
    });
  }

  async findTeamMember(teamId: string, userId: string): Promise<{ userId: string; role: string } | null> {
    return this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
      select: { userId: true, role: true },
    });
  }
}
