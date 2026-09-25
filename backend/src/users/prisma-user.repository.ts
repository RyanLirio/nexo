import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UserRepository, UserRecord, UserProjectRecord } from './user.repository';

@Injectable()
export class PrismaUserRepository extends UserRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async list(search?: string): Promise<UserRecord[]> {
    return this.prisma.user.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findUserProjects(
    userId: string,
    relation?: 'member' | 'responsible' | 'leader',
    status?: string,
  ): Promise<UserProjectRecord[]> {
    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (relation === 'leader') {
      where.leaderId = userId;
    } else if (relation === 'responsible') {
      where.responsibleUserId = userId;
    } else if (relation === 'member') {
      where.members = { some: { userId } };
    } else {
      where.OR = [
        { leaderId: userId },
        { responsibleUserId: userId },
        { members: { some: { userId } } },
      ];
    }

    return this.prisma.project.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        teamId: true,
        leaderId: true,
        responsibleUserId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async updateGoogleAuth(
    userId: string,
    data: { googleSubject?: string; avatarUrl?: string; name?: string },
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.googleSubject ? { googleSubject: data.googleSubject } : {}),
        ...(data.avatarUrl ? { avatarUrl: data.avatarUrl } : {}),
        ...(data.name ? { name: data.name } : {}),
      },
    });
  }
}
