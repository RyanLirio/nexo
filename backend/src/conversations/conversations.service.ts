import { Injectable, Logger } from '@nestjs/common';
import { ProjectRepository } from '../projects/project.repository';
import { OpenAIService } from '../ai/openai.service';
import { ConversationRepository } from './conversation.repository';
import { CheckInRepository } from '../check-ins/check-in.repository';
import {
  SimilarTechnicalProblem,
} from '../technical-problems/technical-problem.repository';
import { TechnicalProblemService } from '../technical-problems/technical-problem.service';

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

  async separateMessageByProject(
    userId: string,
    message: string,
  ) {
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
      content: message,
    });

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

        return { ...project, ...context, similarProblems };
      }),
    );

    return {
      conversationId: conversation.id,
      messageId: savedMessage.id,
      projects: persistedProjects,
    };
  }
}
