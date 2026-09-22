import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TeamMemberRecord, TeamRecord, TeamRepository } from './team.repository';
import { fields, optionalText, requiredText } from '../request-fields';

@Injectable()
export class TeamsService {
  constructor(private readonly teamRepo: TeamRepository) {}

  async list(): Promise<TeamRecord[]> {
    return this.teamRepo.list();
  }

  async getById(id: string): Promise<TeamRecord> {
    const team = await this.teamRepo.findById(id);
    if (!team) {
      throw new NotFoundException('Equipe não encontrada.');
    }
    return team;
  }

  async create(value: unknown): Promise<TeamRecord> {
    const body = fields(value);
    const organizationId = requiredText(body, 'organizationId', 100);
    const name = requiredText(body, 'name', 160);
    const description = optionalText(body, 'description');

    return this.teamRepo.create({
      organizationId,
      name,
      description,
    });
  }

  async update(id: string, value: unknown): Promise<TeamRecord> {
    await this.getById(id);
    const body = fields(value);
    const name = optionalText(body, 'name', 160);
    const description = optionalText(body, 'description');

    return this.teamRepo.update(id, {
      name: name ?? undefined,
      description: description ?? undefined,
    });
  }

  async listMembers(teamId: string): Promise<TeamMemberRecord[]> {
    await this.getById(teamId);
    return this.teamRepo.listMembers(teamId);
  }

  async addMember(teamId: string, value: unknown): Promise<TeamMemberRecord> {
    await this.getById(teamId);
    const body = fields(value);
    const userId = requiredText(body, 'userId', 100);
    const role = (optionalText(body, 'role', 20) || 'MEMBER').toUpperCase();

    if (role !== 'MEMBER' && role !== 'LEADER') {
      throw new BadRequestException('O papel do membro deve ser MEMBER ou LEADER.');
    }

    return this.teamRepo.addMember(teamId, userId, role as 'MEMBER' | 'LEADER');
  }

  async removeMember(teamId: string, userId: string): Promise<void> {
    await this.getById(teamId);
    const member = await this.teamRepo.findMember(teamId, userId);
    if (!member) {
      throw new NotFoundException('Membro não encontrado nesta equipe.');
    }
    await this.teamRepo.removeMember(teamId, userId);
  }
}
