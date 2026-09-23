import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { KnowledgeEntryRecord, KnowledgeRepository } from './knowledge.repository';
import { KnowledgeEntry } from './models';
import { fields, optionalText, requiredText } from '../request-fields';

@Injectable()
export class KnowledgeService {
  constructor(private readonly knowledgeRepo: KnowledgeRepository) {}

  async list(query?: string, projectId?: string): Promise<any[]> {
    if (query !== undefined && (typeof query !== 'string' || query.length > 200)) {
      throw new BadRequestException('A busca deve ter até 200 caracteres.');
    }
    if (projectId !== undefined && (typeof projectId !== 'string' || projectId.length > 100)) {
      throw new BadRequestException('Projeto inválido.');
    }
    return this.knowledgeRepo.list(query, projectId);
  }

  async getById(id: string): Promise<any> {
    const entry = await this.knowledgeRepo.findById(id);
    if (!entry || !entry.sharingAuthorizedAt) {
      throw new NotFoundException('Conhecimento compartilhado não encontrado.');
    }
    return entry;
  }

  async create(value: unknown, currentUserId?: string): Promise<KnowledgeEntryRecord> {
    const body = fields(value);
    const projectId = requiredText(body, 'projectId', 100);
    const authorId = optionalText(body, 'authorId', 100) || currentUserId;
    if (!authorId) {
      throw new BadRequestException('Identificador de autor ausente.');
    }
    const title = requiredText(body, 'title', 160);
    const problem = requiredText(body, 'problem');
    const solution = requiredText(body, 'solution');
    const technology = optionalText(body, 'technology', 160);
    const sourceCheckInId = optionalText(body, 'sourceCheckInId', 100);
    const sourceHelpRequestId = optionalText(body, 'sourceHelpRequestId', 100);

    KnowledgeEntry.validateSources(sourceCheckInId, sourceHelpRequestId);

    const projectExists = await this.knowledgeRepo.projectExists(projectId);
    if (!projectExists) throw new NotFoundException('Projeto não encontrado.');

    const isMember = await this.knowledgeRepo.isProjectMember(projectId, authorId);
    if (!isMember) {
      throw new ForbiddenException('O autor informado não participa deste projeto.');
    }

    if (sourceCheckInId) {
      const source = await this.knowledgeRepo.findSourceCheckIn(sourceCheckInId);
      if (!source || source.projectId !== projectId) {
        throw new BadRequestException('O check-in de origem deve pertencer ao mesmo projeto.');
      }
    }

    if (sourceHelpRequestId) {
      const sourceHelp = await this.knowledgeRepo.findSourceHelpRequest(sourceHelpRequestId);
      if (!sourceHelp || sourceHelp.projectId !== projectId) {
        throw new BadRequestException('O pedido de ajuda de origem deve pertencer ao mesmo projeto.');
      }
    }

    return this.knowledgeRepo.create({
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

  async authorize(id: string, value: unknown, currentUserId?: string): Promise<KnowledgeEntryRecord> {
    const body = fields(value);
    const authorId = optionalText(body, 'authorId', 100) || currentUserId;
    if (!authorId) {
      throw new BadRequestException('Identificador de autor ausente para autorização.');
    }

    const entry = await this.knowledgeRepo.findById(id);
    if (!entry) throw new NotFoundException('Conhecimento não encontrado.');

    const needsUpdate = KnowledgeEntry.validateAuthorization(entry, authorId);
    if (!needsUpdate) {
      return entry;
    }

    return this.knowledgeRepo.authorize(id, authorId, new Date());
  }
}
