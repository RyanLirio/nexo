import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectMemberRecord, ProjectRecord, ProjectRepository } from './project.repository';
import { Project } from './models';
import { fields, optionalText, requiredText } from '../request-fields';

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
      Project.validateLeader(leaderMember);
    }

    if (responsibleUserId) {
      const responsibleMember = await this.projectRepo.findTeamMember(teamId, responsibleUserId);
      Project.validateResponsible(responsibleMember);
    }

    const members = Project.buildInitialMembers(leaderId, responsibleUserId);

    return this.projectRepo.create({
      teamId,
      name,
      description,
      leaderId,
      responsibleUserId,
      createdBy,
      members: members.length > 0 ? members : undefined,
    });
  }

  async changeStatus(id: string, value: unknown, currentUserId: string): Promise<ProjectRecord> {
    const project = await this.getById(id);
    const body = fields(value);
    const newStatus = Project.validateStatus(requiredText(body, 'status', 50));
    const reason = optionalText(body, 'reason');

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
    const role = Project.validateMemberRole(optionalText(body, 'role', 20) || undefined);

    return this.projectRepo.addMember(projectId, userId, role);
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
