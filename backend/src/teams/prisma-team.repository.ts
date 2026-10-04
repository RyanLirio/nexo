import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TeamMemberRecord, TeamRecord, TeamRepository } from './team.repository';

@Injectable()
export class PrismaTeamRepository extends TeamRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async list(): Promise<TeamRecord[]> {
    return this.prisma.team.findMany({
      include: {
        _count: {
          select: {
            members: true,
            projects: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string): Promise<TeamRecord | null> {
    return this.prisma.team.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            members: true,
            projects: true,
          },
        },
      },
    });
  }

  async countProjects(teamId: string): Promise<number> {
    return this.prisma.project.count({
      where: { teamId },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.teamMember.deleteMany({ where: { teamId: id } }),
      this.prisma.team.delete({ where: { id } }),
    ]);
  }

  async create(data: { name: string; description?: string | null }): Promise<TeamRecord> {
    return this.prisma.team.create({
      data: {
        name: data.name,
        description: data.description,
      },
    });
  }

  async update(id: string, data: { name?: string; description?: string | null }): Promise<TeamRecord> {
    return this.prisma.team.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
      },
    });
  }

  async listMembers(teamId: string): Promise<TeamMemberRecord[]> {
    return this.prisma.teamMember.findMany({
      where: { teamId },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, isActive: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async findMember(teamId: string, userId: string): Promise<TeamMemberRecord | null> {
    return this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId },
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, isActive: true } },
      },
    });
  }

  async addMember(teamId: string, userId: string): Promise<TeamMemberRecord> {
    return this.prisma.teamMember.create({
      data: {
        teamId,
        userId,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, isActive: true } },
      },
    });
  }

  async removeMember(teamId: string, userId: string): Promise<void> {
    await this.prisma.teamMember.delete({
      where: {
        teamId_userId: { teamId, userId },
      },
    });
  }
}
