import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UserRepository, UserRecord, UserProjectRecord, ListUsersParams } from './user.repository';

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
        isActive: true,
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
        isActive: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async list(params?: ListUsersParams | string): Promise<UserRecord[]> {
    const search = typeof params === 'string' ? params : params?.search;
    const status = typeof params === 'object' ? params?.status : undefined;
    const role = typeof params === 'object' ? params?.role : undefined;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    if (role && role !== 'ALL') {
      where.role = role as any;
    }

    return this.prisma.user.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async create(data: { name: string; email: string; role: string }): Promise<UserRecord> {
    return this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        role: data.role as any,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async update(
    id: string,
    data: { name?: string; role?: string; isActive?: boolean },
  ): Promise<UserRecord> {
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.role ? { role: data.role as any } : {}),
        ...(typeof data.isActive === 'boolean' ? { isActive: data.isActive } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async countActiveAdmins(): Promise<number> {
    return this.prisma.user.count({
      where: {
        role: 'ADMIN',
        isActive: true,
      },
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
