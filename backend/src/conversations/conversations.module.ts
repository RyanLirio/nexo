import { Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ProjectsModule } from '../projects/projects.module';
import { AiModule } from '../ai/ai.module';
import { ConversationsController } from './conversations.controller';

@Module({
  imports: [
    ProjectsModule,
    AiModule,
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}