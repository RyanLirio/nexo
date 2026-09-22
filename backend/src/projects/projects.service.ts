import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ProjectMemberRecord, ProjectRecord, ProjectRepository } from './project.repository';
import { fields, optionalText, requiredText } from '../request-fields';

const VALID_PROJECT_STATUSES = ['PLANNING', 'ACTIVE', 'PAUSED', 'COMPLETED'];

@Injectable()
export class ProjectsService {
  constructor(private readonly projectRepo: ProjectRepository) {}

  async getById(id: string): Promise<any> {
    const project = await this.projectRepo.findById(id);
    if (!project) throw new NotFoundException('Projeto não encontrado.');
    return project;
  }

  async list(filter?: { teamId?: string; status?: string; userId?: string }): Promise<any[]> {
    return this.projectRepo.list(filter);
  }

  async listByUser(userId: string): Promise<any[]> {
    return this.projectRepo.list({ userId });
  }

  async listByTeam(teamId: string): Promise<any[]> {
    const team = await this.projectRepo.findTeam(teamId);
    if (!team) throw new NotFoundException('Equipe não encontrada.');
    return this.projectRepo.list({ teamId });
  }

  async create(value: unknown, createdByUserId?: string): Promise<ProjectRecord> {
    const body = fields(value);
    const teamId = requiredText(body, 'teamId', 100);
    const name = requiredText(body, 'name', 160);
    const description = optionalText(body, 'description');
    const leaderId = optionalText(body, 'leaderId', 100);
    const responsibleUserId = optionalText(body, 'responsibleUserId', 100);
    const createdBy = optionalText(body, 'createdBy', 100) || createdByUserId || null;

    const team = await this.projectRepo.findTeam(teamId);
    if (!team) throw new NotFoundException('Equipe não encontrada.');

    if (leaderId) {
      const leaderMember = await this.projectRepo.findTeamMember(teamId, leaderId);
      if (!leaderMember) throw new BadRequestException('O líder deve pertencer à mesma equipe do projeto.');
      if (leaderMember.role !== 'LEADER') {
        throw new BadRequestException('Apenas membros com papel LEADER podem liderar o projeto.');
      }
    }

    if (responsibleUserId) {
      const responsibleMember = await this.projectRepo.findTeamMember(teamId, responsibleUserId);
      if (!responsibleMember) throw new BadRequestException('O responsável deve pertencer à mesma equipe do projeto.');
    }

    const membersToCreate: { userId: string; role: 'OWNER' | 'MEMBER' }[] = [];
    if (leaderId) {
      membersToCreate.push({ userId: leaderId, role: 'OWNER' });
    }
    if (responsibleUserId && responsibleUserId !== leaderId) {
      membersToCreate.push({ userId: responsibleUserId, role: 'MEMBER' });
    }

    return this.projectRepo.create({
      teamId,
      name,
      description,
      leaderId,
      responsibleUserId,
      createdBy,
      members: membersToCreate.length > 0 ? membersToCreate : undefined,
    });
  }

  async update(id: string, value: unknown): Promise<ProjectRecord> {
    await this.getById(id);
    const body = fields(value);
    const name = optionalText(body, 'name', 160);
    const description = optionalText(body, 'description');

    return this.projectRepo.update(id, {
      name: name ?? undefined,
      description: description ?? undefined,
    });
  }

  async changeStatus(id: string, value: unknown, currentUserId: string): Promise<ProjectRecord> {
    const project = await this.getById(id);
    const body = fields(value);
    const newStatus = requiredText(body, 'status', 50).toUpperCase();
    const reason = optionalText(body, 'reason');

    if (!VALID_PROJECT_STATUSES.includes(newStatus)) {
      throw new BadRequestException(
        `Status inválido. Valores aceitos: ${VALID_PROJECT_STATUSES.join(', ')}.`,
      );
    }

    return this.projectRepo.updateStatus(id, newStatus, currentUserId, reason, project.status);
  }

  async listMembers(projectId: string): Promise<ProjectMemberRecord[]> {
    await this.getById(projectId);
    return this.projectRepo.listMembers(projectId);
  }

  async addMember(projectId: string, value: unknown): Promise<ProjectMemberRecord> {
    await this.getById(projectId);
    const body = fields(value);
    const userId = requiredText(body, 'userId', 100);
    const role = (optionalText(body, 'role', 20) || 'MEMBER').toUpperCase();

    if (role !== 'MEMBER' && role !== 'OWNER') {
      throw new BadRequestException('O papel do membro no projeto deve ser MEMBER ou OWNER.');
    }

    return this.projectRepo.addMember(projectId, userId, role as 'MEMBER' | 'OWNER');
  }

  async removeMember(projectId: string, userId: string): Promise<void> {
    await this.getById(projectId);
    const member = await this.projectRepo.findMember(projectId, userId);
    if (!member) {
      throw new NotFoundException('Membro não encontrado neste projeto.');
    }
    await this.projectRepo.removeMember(projectId, userId);
  }
}
