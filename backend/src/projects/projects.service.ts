import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ProjectMemberRecord, ProjectRecord, ProjectRepository } from './project.repository';
import { Project } from './models';
import { fields, optionalText, requiredText } from '../request-fields';
import { AccessControlService } from '../common/auth/access-control.service';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly projectRepo: ProjectRepository,
    private readonly accessControl: AccessControlService,
  ) {}

  private async loadProject(id: string): Promise<any> {
    const project = await this.projectRepo.findById(id);
    if (!project) throw new NotFoundException('Projeto não encontrado.');
    return project;
  }

  async getById(id: string, userId: string): Promise<any> {
    if (!(await this.isMember(id, userId))) {
      throw new ForbiddenException('Você não tem acesso à equipe deste projeto.');
    }
    return this.loadProject(id);
  }

  async list(filter: { teamId?: string; status?: string; userId?: string } | undefined, userId: string): Promise<any[]> {
    if (!userId?.trim()) throw new UnauthorizedException('Usuário não identificado.');
    return this.projectRepo.list({
      ...filter,
      ...((await this.accessControl.isAdmin(userId)) ? {} : { viewerId: userId }),
    });
  }

  async isMember(projectId: string, userId: string): Promise<boolean> {
    if (!userId?.trim()) return false;
    if (await this.accessControl.isAdmin(userId)) return true;
    const project = await this.projectRepo.findById(projectId);
    if (!project) return false;
    return this.accessControl.isTeamMember(userId, project.teamId);
  }

  async getLeaderView(id: string, currentUserId: string): Promise<any> {
    const isMember = await this.isMember(id, currentUserId);
    if (!isMember) {
      throw new ForbiddenException('Você não tem permissão para acessar a visão do líder deste projeto.');
    }
    const project = await this.getById(id, currentUserId);
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      priority: project.priority ?? null,
      estimatedCompletionAt: project.estimatedCompletionAt ?? null,
      team: project.team,
      leader: project.leader,
      responsibleUser: project.responsibleUser,
      members: project.members || [],
      latestCheckIn: project.checkIns?.[0] || null,
      openTechnicalProblems: project.technicalProblems || [],
    };
  }

  async update(id: string, value: unknown, currentUserId: string): Promise<ProjectRecord> {
    const project = await this.loadProject(id);
    const body = fields(value);

    const isLeader = project.leaderId === currentUserId;
    const isProjectMember = isLeader ? true : !!(await this.projectRepo.findMember(id, currentUserId));
    const isTeamMember = (isLeader || isProjectMember) ? true : !!(await this.projectRepo.findTeamMember(project.teamId, currentUserId));

    if (!isLeader && !isProjectMember && !isTeamMember) {
      throw new ForbiddenException('Você não tem permissão para alterar este projeto.');
    }

    const updateData: {
      name?: string;
      description?: string | null;
      estimatedCompletionAt?: Date | null;
      priority?: number | null;
    } = {};

    if (body['name'] !== undefined) {
      updateData.name = requiredText(body, 'name', 160);
    }

    if (body['description'] !== undefined) {
      updateData.description = optionalText(body, 'description');
    }

    if (body['priority'] !== undefined) {
      updateData.priority = Project.validatePriority(body['priority']);
    }

    if (body['estimatedCompletionAt'] !== undefined) {
      updateData.estimatedCompletionAt = Project.validateEstimatedCompletionAt(body['estimatedCompletionAt']);
    }

    return this.projectRepo.update(id, updateData);
  }

  async create(value: unknown, createdByUserId?: string): Promise<ProjectRecord> {
    const body = fields(value);
    const teamId = requiredText(body, 'teamId', 100);
    const name = requiredText(body, 'name', 160);
    const description = optionalText(body, 'description');
    const leaderId = optionalText(body, 'leaderId', 100);
    const responsibleUserId = optionalText(body, 'responsibleUserId', 100);
    const createdBy = optionalText(body, 'createdBy', 100) || createdByUserId || null;
    const priority = Project.validatePriority(body['priority']);
    const estimatedCompletionAt = Project.validateEstimatedCompletionAt(body['estimatedCompletionAt']);

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
      estimatedCompletionAt,
      priority,
      members: members.length > 0 ? members : undefined,
    });
  }

  async changeStatus(id: string, value: unknown, currentUserId: string): Promise<ProjectRecord> {
    const project = await this.loadProject(id);
    const body = fields(value);
    const newStatus = Project.validateStatus(requiredText(body, 'status', 50));
    const reason = optionalText(body, 'reason');

    return this.projectRepo.updateStatus(id, newStatus, currentUserId, reason, project.status);
  }

  async listMembers(projectId: string): Promise<ProjectMemberRecord[]> {
    await this.loadProject(projectId);
    return this.projectRepo.listMembers(projectId);
  }

  async addMember(projectId: string, value: unknown): Promise<ProjectMemberRecord> {
    await this.loadProject(projectId);
    const body = fields(value);
    const userId = requiredText(body, 'userId', 100);
    const role = Project.validateMemberRole(optionalText(body, 'role', 20) || undefined);

    return this.projectRepo.addMember(projectId, userId, role);
  }

  async removeMember(projectId: string, userId: string): Promise<void> {
    await this.loadProject(projectId);
    const member = await this.projectRepo.findMember(projectId, userId);
    if (!member) {
      throw new NotFoundException('Membro não encontrado neste projeto.');
    }
    await this.projectRepo.removeMember(projectId, userId);
  }
}
