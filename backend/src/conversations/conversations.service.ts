import { Injectable } from '@nestjs/common';
import { ProjectRepository } from '../projects/project.repository';
import { OpenAIService } from '../ai/openai.service';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly projectRepo: ProjectRepository,
    private readonly openAIService: OpenAIService,
  ) {}

  async separateMessageByProject(
    userId: string,
    message: string,
  ) {
    const activeProjects = await this.projectRepo.list({
      userId,
      status: 'ACTIVE',
    });

    return this.openAIService.extractProjectContexts(
      message,
      activeProjects.map((project) => ({
        id: project.id,
        name: project.name,
        description: project.description,
      })),
    );
  }
}