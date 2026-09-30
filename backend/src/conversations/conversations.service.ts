import { Injectable } from '@nestjs/common';
import { ProjectRepository } from '../projects/project.repository';
import { OpenAIService } from '../ai/openai.service';
import { ConversationRepository } from './conversation.repository';
import { CheckInRepository } from '../check-ins/check-in.repository';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly projectRepo: ProjectRepository,
    private readonly openAIService: OpenAIService,
    private readonly conversationRepo: ConversationRepository,
    private readonly checkInRepo: CheckInRepository,
  ) {}

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

    await Promise.all(
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

        if (existingCheckIn) {
          await this.checkInRepo.updateSummary(
            existingCheckIn.id,
            project.summary,
            savedMessage.id,
          );

          return;
        }

        await this.checkInRepo.create({
          projectId: project.projectId,
          userId,
          summary: project.summary,
          messageIds: [savedMessage.id],
        });
      }),
    );

    return {
      conversationId: conversation.id,
      messageId: savedMessage.id,
      projects,
    };
  }
}