import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma.service';
import { ProjectsController } from './projects/projects.controller';
import { ProjectsService } from './projects/projects.service';
import { CheckInsController } from './check-ins/check-ins.controller';
import { CheckInsService } from './check-ins/check-ins.service';

@Module({
  controllers: [HealthController, ProjectsController, CheckInsController],
  providers: [PrismaService, ProjectsService, CheckInsService],
})
export class AppModule {}
