import { Module } from '@nestjs/common';
import { HelpRequestsController } from './help-requests.controller';
import { HelpRequestsService } from './help-requests.service';
import { HelpRequestRepository } from './help-request.repository';
import { PrismaHelpRequestRepository } from './prisma-help-request.repository';
import { PrismaService } from '../prisma.service';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [ProjectsModule],
  controllers: [HelpRequestsController],
  providers: [
    PrismaService,
    HelpRequestsService,
    {
      provide: HelpRequestRepository,
      useClass: PrismaHelpRequestRepository,
    },
  ],
  exports: [HelpRequestsService, HelpRequestRepository],
})
export class HelpRequestsModule {}
