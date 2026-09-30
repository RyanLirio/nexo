import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma.service';

import { UsersModule } from './users/users.module';
import { TeamsModule } from './teams/teams.module';
import { ProjectsModule } from './projects/projects.module';
import { CheckInsModule } from './check-ins/check-ins.module';
import { TechnicalProblemModule } from './technical-problems/technical-problem.module';
import { HelpRequestsModule } from './help-requests/help-requests.module';

import { AuthModule } from './auth/auth.module';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './common/auth/auth.guard';
import { RolesGuard } from './common/auth/roles.guard';
import { AccessControlService, PrismaAccessControlService } from './common/auth/access-control.service';

import { ConversationsModule } from './conversations/conversations.module';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    TeamsModule,
    ProjectsModule,
    ConversationsModule,
    CheckInsModule,
    TechnicalProblemModule,
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
