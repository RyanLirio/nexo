import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { AI_TOOL_DEFINITIONS, FunctionToolDefinition } from './ai-tools.definitions';
import { ProjectsService } from '../../projects/projects.service';
import { CheckInsService } from '../../check-ins/check-ins.service';
import { TechnicalProblemService } from '../../technical-problems/technical-problem.service';
import { ConversationRepository } from '../../conversations/conversation.repository';

@Injectable()
export class AiToolsService {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly checkInsService: CheckInsService,
    private readonly technicalProblemService: TechnicalProblemService,
    private readonly conversationRepo: ConversationRepository,
  ) {}

  getToolDefinitions(): FunctionToolDefinition[] {
    return AI_TOOL_DEFINITIONS;
  }

  async executeTool(
    name: string,
    args: Record<string, unknown>,
    userId: string,
  ): Promise<unknown> {
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      throw new BadRequestException('Usuário não identificado.');
    }

    const toolDef = AI_TOOL_DEFINITIONS.find((t) => t.function.name === name);
    if (!toolDef) {
      throw new BadRequestException(`Ferramenta não encontrada: ${name}`);
    }

    // Validação estrita de autorização em ferramentas com escopo de projeto
    const projectId = typeof args.projectId === 'string' ? args.projectId : undefined;
    if (projectId) {
      const hasAccess = await this.projectsService.isMember(projectId, userId);
      if (!hasAccess) {
        throw new ForbiddenException('Você não tem permissão para acessar este projeto.');
      }
    }

    switch (name) {
      case 'get_user_projects':
        return this.projectsService.list({ userId, status: 'ACTIVE' }, userId);

      case 'get_project_context': {
        if (!projectId) {
          throw new BadRequestException('Identificador de projeto ausente.');
        }
        const project = await this.projectsService.getById(projectId, userId);
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
          members: (project.members || []).map((m: any) => ({
            userId: m.userId,
            role: m.role,
            name: m.user?.name,
            email: m.user?.email,
          })),
          latestCheckIn: project.checkIns?.[0] || null,
          openTechnicalProblems: project.technicalProblems || [],
        };
      }

      case 'get_recent_messages': {
        const limit = typeof args.limit === 'number' && args.limit > 0 ? args.limit : 10;
        const messages = await this.conversationRepo.findRecentMessages(userId, limit);
        return { messages };
      }


      case 'search_knowledge_base': {
        const query = typeof args.query === 'string' ? args.query : '';
        return this.technicalProblemService.list(query, projectId, undefined, userId);
      }

      case 'search_similar_technical_problems': {
        if (typeof args.problem !== 'string' || !args.problem.trim()) {
          throw new BadRequestException('Informe um problema técnico concreto em problem.');
        }
        return this.technicalProblemService.searchSimilarByText(args.problem, userId);
      }

      case 'save_checkin': {
        if (!projectId) {
          throw new BadRequestException('Identificador de projeto ausente.');
        }
        return this.checkInsService.saveCheckIn(projectId, args, userId);
      }

      case 'manage_technical_problem': {
        if (!projectId) {
          throw new BadRequestException('Identificador de projeto ausente.');
        }
        const action = args.action;
        if (action === 'create') {
          return this.technicalProblemService.create(args, userId);
        } else if (action === 'resolve') {
          const problemId = typeof args.problemId === 'string' ? args.problemId : undefined;
          if (!problemId) {
            throw new BadRequestException('Identificador de problema técnico obrigatório para resolução.');
          }
          const solution = typeof args.solution === 'string' ? args.solution : '';
          return this.technicalProblemService.updateSolution(problemId, solution, userId);
        }
        throw new BadRequestException(`Ação inválida: ${action}`);
      }


      default:
        throw new BadRequestException(`Ferramenta não suportada: ${name}`);
    }
  }
}
