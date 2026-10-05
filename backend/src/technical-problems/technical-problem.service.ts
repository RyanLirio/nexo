import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { SharedTechnicalProblem, SimilarTechnicalProblem, TechnicalProblemFilter, TechnicalProblemRecord, TechnicalProblemRepository } from './technical-problem.repository';
import { TechnicalProblem } from './models';
import { fields, optionalText, requiredText } from '../request-fields';
import { OpenAIService } from '../ai/openai.service';
import { AccessControlService } from '../common/auth/access-control.service';

const SIMILARITY_LIMIT = 5;
const SIMILARITY_THRESHOLD = 0.78;

@Injectable()
export class TechnicalProblemService {
  private readonly logger = new Logger(TechnicalProblemService.name);

  constructor(
    private readonly technicalProblemRepo: TechnicalProblemRepository,
    private readonly openAIService: OpenAIService,
    private readonly accessControl: AccessControlService,
  ) {}

  private warnEmbeddingFailure(id: string): void {
    // Do not log provider errors: they may contain request text or credentials.
    this.logger.warn(`Embedding indisponível para TechnicalProblem ${id}; executar backfill posteriormente.`);
  }

  async ensureProblemEmbedding(id: string, problem: string): Promise<boolean> {
    if (await this.technicalProblemRepo.hasProblemEmbedding(id)) return false;
    const embedding = await this.openAIService.generateEmbedding(problem);
    return this.technicalProblemRepo.setProblemEmbedding(id, embedding);
  }

  async list(
    query?: string,
    projectId?: string,
    filter?: TechnicalProblemFilter,
    userId?: string,
  ): Promise<SharedTechnicalProblem[]> {
    this.requireUser(userId);
    if (query !== undefined && (typeof query !== 'string' || query.length > 200)) {
      throw new BadRequestException('A busca deve ter até 200 caracteres.');
    }
    if (projectId !== undefined && (typeof projectId !== 'string' || projectId.length > 100)) {
      throw new BadRequestException('Projeto inválido.');
    }
    if (filter?.status && filter.status !== 'OPEN' && filter.status !== 'RESOLVED') {
      throw new BadRequestException('Status inválido. Use OPEN ou RESOLVED.');
    }
    return this.technicalProblemRepo.list(query, projectId, filter, {
      userId,
      isAdmin: await this.accessControl.isAdmin(userId),
    });
  }


  async getById(id: string, userId: string): Promise<TechnicalProblemRecord> {
    this.requireUser(userId);
    const technicalProblem = await this.technicalProblemRepo.findById(id);
    if (!technicalProblem || !technicalProblem.sharingAuthorizedAt
      || !(await this.canReadProject(technicalProblem.projectId, userId))) {
      throw new NotFoundException('Problema técnico compartilhado não encontrado.');
    }
    return technicalProblem;
  }

  private requireUser(userId: string | undefined): asserts userId is string {
    if (!userId?.trim()) throw new UnauthorizedException('Usuário não identificado.');
  }

  private async canReadProject(projectId: string, userId: string): Promise<boolean> {
    if (await this.accessControl.isAdmin(userId)) return true;
    const teamId = await this.technicalProblemRepo.findProjectTeamId(projectId);
    return teamId !== null && this.accessControl.isTeamMember(userId, teamId);
  }

  async searchSimilarByText(problem: string, userId: string): Promise<SimilarTechnicalProblem[]> {
    this.requireUser(userId);
    const text = requiredText({ problem }, 'problem');
    const embedding = await this.openAIService.generateEmbedding(text);
    return this.technicalProblemRepo.searchSimilar(userId, embedding, SIMILARITY_LIMIT, SIMILARITY_THRESHOLD);
  }

  async create(value: unknown, currentUserId?: string): Promise<TechnicalProblemRecord> {
    const body = fields(value);
    const projectId = requiredText(body, 'projectId', 100);
    const authorId = optionalText(body, 'authorId', 100) || currentUserId;
    if (!authorId) {
      throw new BadRequestException('Identificador de autor ausente.');
    }
    if (currentUserId && authorId !== currentUserId) {
      throw new ForbiddenException('O autor deve ser o usuário autenticado.');
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

    let embedding: number[] | null = null;
    try {
      embedding = await this.openAIService.generateEmbedding(problem);
    } catch {
      // The business record must survive an unavailable enrichment provider.
    }

    const created = await this.technicalProblemRepo.create({
      projectId,
      authorId,
      title,
      problem,
      solution,
      technology,
      sourceCheckInId,
      sourceHelpRequestId,
    });
    if (embedding) {
      try {
        await this.technicalProblemRepo.setProblemEmbedding(created.id, embedding);
      } catch {
        this.warnEmbeddingFailure(created.id);
      }
    } else {
      this.warnEmbeddingFailure(created.id);
    }
    return created;
  }

  async authorize(id: string, value: unknown, currentUserId?: string): Promise<TechnicalProblemRecord> {
    const body = fields(value);
    const authorId = optionalText(body, 'authorId', 100) || currentUserId;
    if (!authorId) {
      throw new BadRequestException('Identificador de autor ausente para autorização.');
    }
    if (currentUserId && authorId !== currentUserId) {
      throw new ForbiddenException('O autorizador deve ser o usuário autenticado.');
    }

    const technicalProblem = await this.technicalProblemRepo.findById(id);
    if (!technicalProblem) throw new NotFoundException('Problema técnico não encontrado.');

    const needsUpdate = TechnicalProblem.validateAuthorization(technicalProblem, authorId);
    if (currentUserId && !(await this.canReadProject(technicalProblem.projectId, currentUserId))) {
      throw new ForbiddenException('Você não tem acesso à equipe deste problema.');
    }
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
      if (!(await this.canReadProject(technicalProblem.projectId, currentUserId))) {
        throw new ForbiddenException('Você não tem acesso à equipe deste problema.');
      }
      const isMember = await this.technicalProblemRepo.isProjectMember(technicalProblem.projectId, currentUserId);
      if (!isMember && technicalProblem.authorId !== currentUserId) {
        throw new ForbiddenException('Você não tem permissão para registrar solução neste problema.');
      }
    }

    const updated = await this.technicalProblemRepo.updateSolution(id, solution.trim());
    try {
      await this.ensureProblemEmbedding(id, technicalProblem.problem);
    } catch {
      this.warnEmbeddingFailure(id);
    }
    return updated;
  }
}

