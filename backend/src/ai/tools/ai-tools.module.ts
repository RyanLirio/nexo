import { Module } from '@nestjs/common';
import { AiToolsService } from './ai-tools.service';
import { ProjectsModule } from '../../projects/projects.module';
import { CheckInsModule } from '../../check-ins/check-ins.module';
import { TechnicalProblemModule } from '../../technical-problems/technical-problem.module';
import { ConversationsModule } from '../../conversations/conversations.module';

@Module({
  imports: [
    ProjectsModule,
    CheckInsModule,
    TechnicalProblemModule,
    ConversationsModule,
  ],
  providers: [AiToolsService],
  exports: [AiToolsService],
})
export class AiToolsModule {}
