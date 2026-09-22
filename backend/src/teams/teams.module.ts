import { Module } from '@nestjs/common';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { TeamRepository } from './team.repository';
import { PrismaTeamRepository } from './prisma-team.repository';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [TeamsController],
  providers: [
    PrismaService,
    TeamsService,
    {
      provide: TeamRepository,
      useClass: PrismaTeamRepository,
    },
  ],
  exports: [TeamsService, TeamRepository],
})
export class TeamsModule {}
