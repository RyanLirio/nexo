import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma.service';
import { ProjectsController } from './projects/projects.controller';
import { ProjectsService } from './projects/projects.service';
import { CheckInsController } from './check-ins/check-ins.controller';
import { CheckInsService } from './check-ins/check-ins.service';
import { KnowledgeController } from './knowledge/knowledge.controller';
import { KnowledgeService } from './knowledge/knowledge.service';
import { HelpRequestsController } from './help-requests/help-requests.controller';
import { HelpRequestsService } from './help-requests/help-requests.service';

import { UsersModule } from './users/users.module';
import { TeamsModule } from './teams/teams.module';
import { ProjectsModule } from './projects/projects.module';
import { CheckInsModule } from './check-ins/check-ins.module';
import { KnowledgeModule } from './knowledge/knowledge.module';

@Module({
  imports: [UsersModule, TeamsModule, ProjectsModule, CheckInsModule, KnowledgeModule],
  controllers: [HealthController, HelpRequestsController],
  providers: [PrismaService, HelpRequestsService],
})
export class AppModule {}
