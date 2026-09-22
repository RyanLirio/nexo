import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectRepository } from './project.repository';
import { PrismaProjectRepository } from './prisma-project.repository';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ProjectsController],
  providers: [
    PrismaService,
    ProjectsService,
    {
      provide: ProjectRepository,
      useClass: PrismaProjectRepository,
    },
  ],
  exports: [ProjectsService, ProjectRepository],
})
export class ProjectsModule {}
