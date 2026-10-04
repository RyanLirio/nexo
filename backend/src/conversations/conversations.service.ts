import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ProjectRepository } from '../projects/project.repository';
import { OpenAIService } from '../ai/openai.service';
import { ConversationRepository, MessageRecord, PendingSolutionSuggestionRecord } from './conversation.repository';
import { CheckInRepository } from '../check-ins/check-in.repository';
import { SimilarTechnicalProblem, TechnicalProblemRecord } from '../technical-problems/technical-problem.repository';
import { TechnicalProblemService } from '../technical-problems/technical-problem.service';
import { findPendingProjectSelection, isStandaloneSolutionReply, parseSolutionReply } from './solution-reply';

export interface SolutionSuggestion {
  available: true;
  technicalProblemId: string;
  similarity: number;
  technology: string | null;
}

interface ProjectConversationContext {
  projectId: string;
  summary: string;
  difficulties: string | null;
  nextSteps: string | null;
  classification: 'NO_PROBLEM' | 'DIFFICULTY' | 'TECHNICAL_PROBLEM';
  normalizedProblem: string | null;
  solutionSuggestion: SolutionSuggestion | null;
}

interface AcceptedSolution {
  projectId: string;
  technicalProblemId: string;
  solution: string;
}

export interface ConversationResponse {
  conversationId: string;
  messageId: string;
  projects: ProjectConversationContext[];
  assistantMessage: Pick<MessageRecord, 'id' | 'role' | 'content'>;
  acceptedSolution?: AcceptedSolution;
}

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    private readonly projectRepo: ProjectRepository,
    private readonly openAIService: OpenAIService,
    private readonly conversationRepo: ConversationRepository,
    private readonly checkInRepo: CheckInRepository,
    private readonly technicalProblems: TechnicalProblemService,
  ) {}

  private async searchSimilarProblems(userId: string, project: {
    projectId: string;
    classification: 'NO_PROBLEM' | 'DIFFICULTY' | 'TECHNICAL_PROBLEM';
    normalizedProblem: string | null;
  }): Promise<SimilarTechnicalProblem[]> {
    if (project.classification !== 'TECHNICAL_PROBLEM') {
      return [];
    }

    const normalizedProblem = project.normalizedProblem?.trim();
    if (!normalizedProblem) {
      throw new Error('Problema técnico identificado sem normalização.');
    }

    const similarProblems = await this.technicalProblems.searchSimilarByText(
      normalizedProblem,
      userId,
    );

    for (const candidate of similarProblems) {
      this.logger.log(
        `semantic-search projectId=${project.projectId} candidateId=${candidate.id} similarity=${candidate.similarity.toFixed(4)}`,
      );
    }

    return similarProblems;
  }

  private toSolutionSuggestion(
    candidates: SimilarTechnicalProblem[],
  ): SolutionSuggestion | null {
    const candidate = candidates[0];
    if (!candidate) return null;

    return {
      available: true,
      technicalProblemId: candidate.id,
      similarity: candidate.similarity,
      technology: candidate.technology,
    };
  }

  private response(
    conversationId: string,
    messageId: string,
    assistant: MessageRecord,
    projects: ProjectConversationContext[] = [],
    acceptedSolution?: AcceptedSolution,
  ): ConversationResponse {
    return {
      conversationId, messageId, projects,
      assistantMessage: { id: assistant.id, role: assistant.role, content: assistant.content },
      ...(acceptedSolution ? { acceptedSolution } : {}),
    };
  }

  private async respond(
    conversationId: string,
    messageId: string,
    content: string,
    projects: ProjectConversationContext[] = [],
  ): Promise<ConversationResponse> {
    const assistant = await this.conversationRepo.createMessage({
      conversationId, role: 'ASSISTANT', content,
    });
    return this.response(conversationId, messageId, assistant, projects);
  }

  private async finishSuggestion(
    suggestion: PendingSolutionSuggestionRecord,
    messageId: string,
    status: 'ACCEPTED' | 'DECLINED',
    content: string,
    acceptedSolution?: AcceptedSolution,
  ): Promise<ConversationResponse> {
    const assistant = await this.conversationRepo.completeSuggestion(suggestion, status, content);
    if (!assistant) {
      return this.respond(suggestion.conversationId, messageId, 'Essa sugestão mudou ou já foi encerrada. Não mostrei nenhuma solução.');
    }
    return this.response(suggestion.conversationId, messageId, assistant, [], acceptedSolution);
  }

  private async answerPending(
    userId: string,
    conversationId: string,
    messageId: string,
    message: string,
  ): Promise<ConversationResponse | null> {
    const pending = (await this.conversationRepo.findPendingSuggestions(userId, conversationId))
      .filter((suggestion) => suggestion.userId === userId
        && suggestion.conversationId === conversationId && suggestion.status === 'PENDING');
    if (pending.length === 0) return null;

    const explicitDecision = parseSolutionReply(message);
    const selection = findPendingProjectSelection(message, pending.map((item) => ({
      projectId: item.projectId,
      projectName: item.projectName,
    })));
    let decision = explicitDecision;
    let suggestion: PendingSolutionSuggestionRecord;

    if (pending.length === 1) {
      if (!decision) return null;
      if (!isStandaloneSolutionReply(message) && selection.matches.length !== 1) {
        return this.respond(
          conversationId,
          messageId,
          `Não consegui identificar qual projeto. A opção é: ${pending[0].projectName}.`,
        );
      }
      suggestion = pending[0];
    } else {
      if (selection.matches.length === 1 && (decision || selection.isSelectionOnly)) {
        suggestion = pending.find((item) => item.projectId === selection.matches[0].projectId)!;
        decision ??= 'ACCEPTED';
      } else {
        const options = pending.map((item) => item.projectName).join(' e ');
        const initialQuestion = explicitDecision && selection.matches.length === 0
          && isStandaloneSolutionReply(message);
        const content = initialQuestion
          ? 'Tenho soluções sugeridas para mais de um projeto. Para qual projeto você quer ver a solução?'
          : `Não consegui identificar qual projeto. As opções são: ${options}.`;
        return this.respond(conversationId, messageId, content);
      }
    }

    if (decision === 'DECLINED') {
      return this.finishSuggestion(suggestion, messageId, 'DECLINED', 'Sem problema. Seguimos por aqui.');
    }

    let problem: TechnicalProblemRecord;
    try {
      // Acesso e consentimento são consultados de novo, nunca copiados da sugestão.
      problem = await this.technicalProblems.getById(suggestion.technicalProblemId, userId);
    } catch (error) {
      if (!(error instanceof NotFoundException || error instanceof ForbiddenException)) throw error;
      return this.finishSuggestion(suggestion, messageId, 'DECLINED', 'Essa solução não está mais disponível para você.');
    }
    const solution = problem.solution?.trim();
    if (!problem.sharingAuthorizedAt || !solution) {
      return this.finishSuggestion(suggestion, messageId, 'DECLINED', 'Essa solução não está mais disponível para você.');
    }
    return this.finishSuggestion(suggestion, messageId, 'ACCEPTED', solution, {
      projectId: suggestion.projectId, technicalProblemId: problem.id, solution,
    });
  }

  async separateMessageByProject(
    userId: string,
    message: string,
  ): Promise<ConversationResponse> {
    if (typeof message !== 'string' || !message.trim()) {
      throw new BadRequestException('Informe uma mensagem.');
    }
    const now = new Date();

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    let conversation =
      await this.conversationRepo.findDailyConversation(
        userId,
        startOfDay,
        endOfDay,
      );

    if (!conversation) {
      conversation =
        await this.conversationRepo.createConversation(userId);
    }

    const savedMessage = await this.conversationRepo.createMessage({
      conversationId: conversation.id,
      senderId: userId,
      role: 'USER',
      content: message,
    });

    const pendingResponse = await this.answerPending(userId, conversation.id, savedMessage.id, message);
    if (pendingResponse) return pendingResponse;

    const activeProjects = await this.projectRepo.list({
      userId,
      status: 'ACTIVE',
    });

    const projectsWithDailyContext = await Promise.all(
      activeProjects.map(async (project) => {
        const checkIn =
          await this.checkInRepo.findDailyByUserAndProject(
            userId,
            project.id,
            startOfDay,
            endOfDay,
          );

        return {
          id: project.id,
          name: project.name,
          description: project.description,
          currentSummary: checkIn?.summary ?? null,
          currentDifficulties: checkIn?.difficulties ?? null,
          currentNextSteps: checkIn?.nextSteps ?? null,
        };
      }),
    );

    const result = await this.openAIService.extractProjectContexts(
      message,
      projectsWithDailyContext,
    );

    const validProjectIds = new Set(
      activeProjects.map((project) => project.id),
    );

    const projects = result.projects.filter((project) =>
      validProjectIds.has(project.projectId),
    );

    const persistedProjects = await Promise.all(
      projects.map(async (project) => {
        await this.conversationRepo.linkProject(
          conversation.id,
          project.projectId,
        );

        const existingCheckIn =
          await this.checkInRepo.findDailyByUserAndProject(
            userId,
            project.projectId,
            startOfDay,
            endOfDay,
          );

        const context = {
          summary: project.summary,
          difficulties:
            project.difficulties ?? existingCheckIn?.difficulties ?? null,
          nextSteps:
            project.nextSteps ?? existingCheckIn?.nextSteps ?? null,
        };

        if (existingCheckIn) {
          await this.checkInRepo.updateContext(existingCheckIn.id, {
            ...context,
            messageId: savedMessage.id,
          });
        } else {
          await this.checkInRepo.create({
            projectId: project.projectId,
            userId,
            ...context,
            messageIds: [savedMessage.id],
          });
        }

        const similarProblems = await this.searchSimilarProblems(
          userId,
          project,
        );

        const solutionSuggestion = this.toSolutionSuggestion(similarProblems);
        if (solutionSuggestion) {
          await this.conversationRepo.savePendingSuggestion({
            userId, conversationId: conversation.id, projectId: project.projectId,
            technicalProblemId: solutionSuggestion.technicalProblemId,
            similarity: solutionSuggestion.similarity,
          });
        }

        // Somente metadados da sugestão são públicos; a solução permanece interna.
        return {
          projectId: project.projectId,
          ...context,
          classification: project.classification,
          normalizedProblem: project.normalizedProblem,
          solutionSuggestion,
        };
      }),
    );

    const suggestionCount = persistedProjects.filter((project) => project.solutionSuggestion).length;
    const content = suggestionCount > 1
      ? 'Tenho soluções sugeridas para mais de um projeto. Para qual projeto você quer ver a solução?'
      : suggestionCount === 1
        ? 'Encontrei um problema parecido. Quer ver a solução?'
        : result.assistantResponse;
    return this.respond(conversation.id, savedMessage.id, content, persistedProjects);
  }
}
