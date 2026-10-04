import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ProjectRepository } from '../projects/project.repository';
import { OpenAIService, RECENT_CONVERSATION_LIMIT } from '../ai/openai.service';
import { ConversationRepository, MessageRecord, PendingSolutionSuggestionRecord } from './conversation.repository';
import { CheckInRepository } from '../check-ins/check-in.repository';
import { SimilarTechnicalProblem, TechnicalProblemRecord } from '../technical-problems/technical-problem.repository';
import { TechnicalProblemService } from '../technical-problems/technical-problem.service';
import { findPendingProjectSelection, isStandaloneSolutionReply, parseSolutionReply } from './solution-reply';
import { AccessControlService } from '../common/auth/access-control.service';
import { UserRepository } from '../users/user.repository';
import { ProjectsService } from '../projects/projects.service';
import { ProjectRecord } from '../projects/project.repository';
import { ConversationIdentity, LeadershipProjectContext, leadershipCollectiveReply, selectLeadershipProjects } from './leadership-context';
import { acknowledgeAllProjects, isClaimedLeadershipLookup } from './conversation-response';
import { isProjectCreationTurn } from '../projects/chat-project-creation';

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
  // Protege a instância local do MVP; não substitui constraint/lock entre instâncias.
  private readonly userRequests = new Map<string, Promise<void>>();

  constructor(
    private readonly projectRepo: ProjectRepository,
    private readonly openAIService: OpenAIService,
    private readonly conversationRepo: ConversationRepository,
    private readonly checkInRepo: CheckInRepository,
    private readonly technicalProblems: TechnicalProblemService,
    private readonly accessControl: AccessControlService,
    private readonly users: UserRepository,
    private readonly projectsService: ProjectsService,
  ) {}

  private dayBounds() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  async getCurrentHistory(userId: string) {
    const { start, end } = this.dayBounds();
    const conversation = await this.conversationRepo.findDailyConversation(userId, start, end);
    if (!conversation) return { conversationId: null, messages: [] };
    const messages = await this.conversationRepo.findConversationMessages(conversation.id, userId, 50);
    return { conversationId: conversation.id, messages: messages.map(({ id, role, content, createdAt }) => ({ id, role, content, createdAt })) };
  }

  private async leadershipContext(user: ConversationIdentity, message: string, history: Array<Pick<MessageRecord, 'role' | 'content'>>) {
    const projects: ProjectRecord[] = await this.projectsService.list(undefined, user.id);
    const directory = await Promise.all(projects.map(async project => ({
      id: project.id, name: project.name, leaderId: project.leaderId,
      members: (await this.projectRepo.listMembers(project.id)).flatMap(member => member.user
        ? [{ id: member.user.id, name: member.user.name }] : []),
    })));
    const selection = selectLeadershipProjects(message, history, directory, user.id);
    if (selection.clarification) return { directory, clarification: selection.clarification, contexts: [], hasMoreProjects: false };
    const contexts: LeadershipProjectContext[] = [];
    for (const project of selection.projects.slice(0, 10)) {
      const view: { id: string; name: string; status: string; members: Array<{
        user?: { id: string; name: string }; latestCheckIn?: { summary: string; difficulties?: string | null; nextSteps?: string | null; updatedAt: Date } | null;
      }> } = await this.projectsService.getLeaderView(project.id, user.id);
      const shared = await this.technicalProblems.list(undefined, project.id, { onlyAuthorized: true }, user.id);
      contexts.push({
        id: view.id, name: view.name, status: view.status,
        members: view.members.filter(member => member.user && (!selection.memberIds.length || selection.memberIds.includes(member.user.id)))
          .map(member => ({ id: member.user!.id, name: member.user!.name, latestUpdate: member.latestCheckIn ? {
            summary: member.latestCheckIn.summary, difficulties: member.latestCheckIn.difficulties ?? null,
            nextSteps: member.latestCheckIn.nextSteps ?? null, updatedAt: member.latestCheckIn.updatedAt,
          } : null })),
        technicalProblems: shared.slice(0, 5).map(problem => ({ title: problem.title, problem: problem.problem, technology: problem.technology ?? null })),
      });
    }
    return { directory, contexts, hasMoreProjects: selection.projects.length > 10 };
  }

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
    if (typeof message !== 'string' || !message.trim() || message.length > 10000) {
      throw new BadRequestException('Informe uma mensagem.');
    }
    const previous = this.userRequests.get(userId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>(resolve => { release = resolve; });
    this.userRequests.set(userId, current);
    await previous;
    try {
      return await this.processMessage(userId, message);
    } finally {
      release();
      if (this.userRequests.get(userId) === current) this.userRequests.delete(userId);
    }
  }

  private async processMessage(userId: string, message: string): Promise<ConversationResponse> {
    const account = await this.users.findById(userId);
    if (!account || !['MEMBER', 'LEADER', 'ADMIN'].includes(account.role)) throw new ForbiddenException('Usuário autenticado não disponível.');
    const authenticatedUser: ConversationIdentity = { id: account.id, name: account.name, role: account.role as ConversationIdentity['role'] };
    const { start: startOfDay, end: endOfDay } = this.dayBounds();

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

    const history = (await this.conversationRepo.findConversationMessages(conversation.id, userId, RECENT_CONVERSATION_LIMIT + 1))
      .filter(previous => previous.id !== savedMessage.id).slice(-RECENT_CONVERSATION_LIMIT)
      .map(({ role, content }) => ({ role, content }));
    if (authenticatedUser.role !== 'MEMBER') {
      const leadership = await this.leadershipContext(authenticatedUser, message, history);
      if (leadership.clarification) return this.respond(conversation.id, savedMessage.id, leadership.clarification);
      const collective = leadershipCollectiveReply(message, leadership.contexts, leadership.hasMoreProjects);
      if (collective) return this.respond(conversation.id, savedMessage.id, collective);
      const result = await this.openAIService.extractProjectContexts(message, leadership.directory, history, {
        authenticatedUser, leadershipContext: leadership.contexts, hasMoreProjects: leadership.hasMoreProjects,
      });
      return this.respond(conversation.id, savedMessage.id, result.assistantResponse);
    }

    const activeProjects = await this.projectRepo.list({
      userId,
      status: 'ACTIVE',
      ...((await this.accessControl.isAdmin(userId)) ? {} : { viewerId: userId }),
    });

    if (isClaimedLeadershipLookup(message, activeProjects.map(project => project.name))) {
      return this.respond(conversation.id, savedMessage.id,
        'Sua conta de colaborador não tem acesso à visão de acompanhamento de outros colaboradores.');
    }

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
      history,
      { authenticatedUser, projectCreationAllowed: isProjectCreationTurn(message, history) },
    );

    if (result.projectCreation && isProjectCreationTurn(message, history)) {
      const creation = await this.projectsService.createFromConversation(result.projectCreation, userId);
      if (creation.project) await this.conversationRepo.linkProject(conversation.id, creation.project.id);
      return this.respond(conversation.id, savedMessage.id, creation.reply);
    }

    const validProjectIds = new Set(
      activeProjects.map((project) => project.id),
    );

    const seenProjects = new Set<string>();
    const projects = result.projects.filter((project) => {
      if (seenProjects.has(project.projectId)) return false;
      seenProjects.add(project.projectId);
      return validProjectIds.has(project.projectId);
    });

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
    return this.respond(conversation.id, savedMessage.id,
      acknowledgeAllProjects(content, projects, activeProjects), persistedProjects);
  }
}
