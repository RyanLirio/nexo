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
import { HelpRequestsModule } from './help-requests/help-requests.module';

import { AuthModule } from './auth/auth.module';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './common/auth/auth.guard';
import { RolesGuard } from './common/auth/roles.guard';
import { AccessControlService, PrismaAccessControlService } from './common/auth/access-control.service';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    TeamsModule,
    ProjectsModule,
    CheckInsModule,
    KnowledgeModule,
    HelpRequestsModule,
  ],
  controllers: [HealthController],
  providers: [
    PrismaService,
    {
      provide: AccessControlService,
      useClass: PrismaAccessControlService,
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
