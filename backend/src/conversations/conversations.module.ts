import { Module, forwardRef } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ProjectsModule } from '../projects/projects.module';
import { AiModule } from '../ai/ai.module';
import { ConversationsController } from './conversations.controller';
import { ConversationRepository } from './conversation.repository';
import { PrismaConversationRepository } from './prisma-conversation.repository';
import { PrismaService } from '../prisma.service';
import { CheckInsModule } from '../check-ins/check-ins.module';

@Module({
  imports: [
    ProjectsModule,
    forwardRef(() => AiModule),
    CheckInsModule,
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