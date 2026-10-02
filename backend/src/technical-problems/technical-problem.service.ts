import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TechnicalProblemRecord, TechnicalProblemRepository } from './technical-problem.repository';
import { TechnicalProblem } from './models';
import { fields, optionalText, requiredText } from '../request-fields';

@Injectable()
export class TechnicalProblemService {
  constructor(private readonly technicalProblemRepo: TechnicalProblemRepository) {}

  async list(query?: string, projectId?: string): Promise<any[]> {
    if (query !== undefined && (typeof query !== 'string' || query.length > 200)) {
      throw new BadRequestException('A busca deve ter até 200 caracteres.');
    }
    if (projectId !== undefined && (typeof projectId !== 'string' || projectId.length > 100)) {
      throw new BadRequestException('Projeto inválido.');
    }
    return this.technicalProblemRepo.list(query, projectId);
  }

  async getById(id: string): Promise<any> {
    const technicalProblem = await this.technicalProblemRepo.findById(id);
    if (!technicalProblem || !technicalProblem.sharingAuthorizedAt) {
      throw new NotFoundException('Problema técnico compartilhado não encontrado.');
    }
    return technicalProblem;
  }

  async create(value: unknown, currentUserId?: string): Promise<TechnicalProblemRecord> {
    const body = fields(value);
    const projectId = requiredText(body, 'projectId', 100);
    const authorId = optionalText(body, 'authorId', 100) || currentUserId;
    if (!authorId) {
      throw new BadRequestException('Identificador de autor ausente.');
    }
    const title = requiredText(body, 'title', 160);
    const problem = requiredText(body, 'problem');
    const solution = optionalText(body, 'solution');
    const technology = optionalText(body, 'technology', 160);
    const sourceCheckInId = optionalText(body, 'sourceCheckInId', 100);
    const sourceHelpRequestId = optionalText(body, 'sourceHelpRequestId', 100);

    TechnicalProblem.validateSources(sourceCheckInId, sourceHelpRequestId);

    const projectExists = await this.technicalProblemRepo.projectExists(projectId);
    if (!projectExists) throw new NotFoundException('Projeto não encontrado.');

    const isMember = await this.technicalProblemRepo.isProjectMember(projectId, authorId);
    if (!isMember) {
      throw new ForbiddenException('O autor informado não participa deste projeto.');
    }

    if (sourceCheckInId) {
      const source = await this.technicalProblemRepo.findSourceCheckIn(sourceCheckInId);
      if (!source || source.projectId !== projectId) {
        throw new BadRequestException('O check-in de origem deve pertencer ao mesmo projeto.');
      }
    }

    if (sourceHelpRequestId) {
      const sourceHelp = await this.technicalProblemRepo.findSourceHelpRequest(sourceHelpRequestId);
      if (!sourceHelp || sourceHelp.projectId !== projectId) {
        throw new BadRequestException('O pedido de ajuda de origem deve pertencer ao mesmo projeto.');
      }
    }

    return this.technicalProblemRepo.create({
      projectId,
      authorId,
      title,
      problem,
      solution,
      technology,
      sourceCheckInId,
      sourceHelpRequestId,
    });
  }

  async authorize(id: string, value: unknown, currentUserId?: string): Promise<TechnicalProblemRecord> {
    const body = fields(value);
    const authorId = optionalText(body, 'authorId', 100) || currentUserId;
    if (!authorId) {
      throw new BadRequestException('Identificador de autor ausente para autorização.');
    }

    const technicalProblem = await this.technicalProblemRepo.findById(id);
    if (!technicalProblem) throw new NotFoundException('Problema técnico não encontrado.');

    const needsUpdate = TechnicalProblem.validateAuthorization(technicalProblem, authorId);
    if (!needsUpdate) {
      return technicalProblem;
    }

    return this.technicalProblemRepo.authorize(id, authorId, new Date());
  }

  async updateSolution(id: string, solution: string, currentUserId?: string): Promise<TechnicalProblemRecord> {
    if (!solution || typeof solution !== 'string' || solution.trim() === '') {
      throw new BadRequestException('A solução deve ser informada.');
    }
    const technicalProblem = await this.technicalProblemRepo.findById(id);
    if (!technicalProblem) throw new NotFoundException('Problema técnico não encontrado.');

    if (currentUserId) {
      const isMember = await this.technicalProblemRepo.isProjectMember(technicalProblem.projectId, currentUserId);
      if (!isMember && technicalProblem.authorId !== currentUserId) {
        throw new ForbiddenException('Você não tem permissão para registrar solução neste problema.');
      }
    }

    return this.technicalProblemRepo.updateSolution(id, solution.trim());
  }
}

