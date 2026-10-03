import { Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ProjectsModule } from '../projects/projects.module';
import { AiModule } from '../ai/ai.module';
import { ConversationsController } from './conversations.controller';
import { ConversationRepository } from './conversation.repository';
import { PrismaConversationRepository } from './prisma-conversation.repository';
import { PrismaService } from '../prisma.service';
import { CheckInsModule } from '../check-ins/check-ins.module';
import { TechnicalProblemModule } from '../technical-problems/technical-problem.module';

@Module({
  imports: [
    ProjectsModule,
    AiModule,
    CheckInsModule,
    TechnicalProblemModule,
  ],
  controllers: [ConversationsController],
  providers: [
    PrismaService,
    ConversationsService,
    {
      provide: ConversationRepository,
      useClass: PrismaConversationRepository,
    },
  ],
  exports: [ConversationsService, ConversationRepository],
})
export class ConversationsModule {}
