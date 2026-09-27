import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

export abstract class AccessControlService {
  abstract isAdmin(userId: string): Promise<boolean>;
  abstract isTeamMember(userId: string, teamId: string): Promise<boolean>;
  abstract isTeamLeader(userId: string, teamId: string): Promise<boolean>;
}

@Injectable()
export class PrismaAccessControlService extends AccessControlService {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async isAdmin(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role === 'ADMIN';
  }

  async isTeamMember(userId: string, teamId: string): Promise<boolean> {
    const membership = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId },
      },
    });
    return Boolean(membership);
  }

  async isTeamLeader(userId: string, teamId: string): Promise<boolean> {
    const membership = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId },
      },
      select: {
        user: { select: { role: true } },
      },
    });
    return membership?.user.role === 'LEADER';
  }
}
