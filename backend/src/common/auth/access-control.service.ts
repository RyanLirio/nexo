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
    const adminMembership = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        role: 'ADMIN',
      },
    });
    return Boolean(adminMembership);
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
    });
    return membership?.role === 'LEADER';
  }
}
