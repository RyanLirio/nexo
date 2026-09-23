import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { HelpRequestRecord, HelpRequestRepository } from './help-request.repository';
import { HelpRequest, HelpStatus } from './models';
import { fields, optionalText, requiredText } from '../request-fields';

@Injectable()
export class HelpRequestsService {
  constructor(private readonly helpRequestRepo: HelpRequestRepository) {}

  async list(projectId?: string, status?: string): Promise<HelpRequestRecord[]> {
    if (projectId) {
      const exists = await this.helpRequestRepo.projectExists(projectId);
      if (!exists) throw new NotFoundException('Projeto não encontrado.');
    }
    return this.helpRequestRepo.list(projectId, status);
  }

  async getById(id: string): Promise<HelpRequestRecord> {
    const request = await this.helpRequestRepo.findById(id);
    if (!request) throw new NotFoundException('Pedido de ajuda não encontrado.');
    return request;
  }

  async create(projectId: string, value: unknown, currentUserId?: string): Promise<HelpRequestRecord> {
    const body = fields(value);
    const requesterId = optionalText(body, 'requesterId', 100) || currentUserId;
    if (!requesterId) {
      throw new BadRequestException('Identificador de solicitante ausente.');
    }

    const helperId = optionalText(body, 'helperId', 100);
    const problem = requiredText(body, 'problem');

    const project = await this.helpRequestRepo.projectExists(projectId);
    if (!project) throw new NotFoundException('Projeto não encontrado.');

    const requester = await this.helpRequestRepo.isProjectMember(projectId, requesterId);
    if (!requester) throw new ForbiddenException('O solicitante informado não participa deste projeto.');

    if (helperId) {
      const helper = await this.helpRequestRepo.isProjectMember(projectId, helperId);
      if (!helper) throw new BadRequestException('O ajudante informado deve participar deste projeto.');
    }

    return this.helpRequestRepo.create({
      projectId,
      requesterId,
      helperId,
      problem,
    });
  }

  async changeStatus(id: string, value: unknown): Promise<HelpRequestRecord> {
    const rawStatus = requiredText(fields(value), 'status', 20);
    const status = HelpRequest.validateStatus(rawStatus);

    const request = await this.getById(id);
    if (status === request.status) return request;

    HelpRequest.validateTransition(request.status as HelpStatus, status);

    const resolvedAt = status === HelpStatus.RESOLVED ? new Date() : null;
    return this.helpRequestRepo.updateStatus(id, status, resolvedAt);
  }
}
