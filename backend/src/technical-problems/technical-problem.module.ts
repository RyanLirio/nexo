import { Module } from '@nestjs/common';
import { TechnicalProblemController } from './technical-problem.controller';
import { TechnicalProblemService } from './technical-problem.service';
import { TechnicalProblemRepository } from './technical-problem.repository';
import { PrismaTechnicalProblemRepository } from './prisma-technical-problem.repository';
import { PrismaService } from '../prisma.service';
import { AiModule } from '../ai/ai.module';
import { AccessControlModule } from '../common/auth/access-control.module';

@Module({
  imports: [AiModule, AccessControlModule],
  controllers: [TechnicalProblemController],
  providers: [
    PrismaService,
    TechnicalProblemService,
    {
      provide: TechnicalProblemRepository,
      useClass: PrismaTechnicalProblemRepository,
    },
  ],
  exports: [TechnicalProblemService, TechnicalProblemRepository],
})
export class TechnicalProblemModule {}
