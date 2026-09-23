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
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string): Promise<TeamRecord | null> {
    return this.prisma.team.findUnique({
      where: { id },
    });
  }

  async create(data: { organizationId: string; name: string; description?: string | null }): Promise<TeamRecord> {
    return this.prisma.team.create({
      data: {
        organizationId: data.organizationId,
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
        user: { select: { id: true, name: true, email: true } },
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
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async addMember(teamId: string, userId: string, role: 'MEMBER' | 'LEADER' = 'MEMBER'): Promise<TeamMemberRecord> {
    return this.prisma.teamMember.upsert({
      where: {
        teamId_userId: { teamId, userId },
      },
      create: {
        teamId,
        userId,
        role,
      },
      update: {
        role,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
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
