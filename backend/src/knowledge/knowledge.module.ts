import { Module } from '@nestjs/common';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeRepository } from './knowledge.repository';
import { PrismaKnowledgeRepository } from './prisma-knowledge.repository';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [KnowledgeController],
  providers: [
    PrismaService,
    KnowledgeService,
    {
      provide: KnowledgeRepository,
      useClass: PrismaKnowledgeRepository,
    },
  ],
  exports: [KnowledgeService, KnowledgeRepository],
})
export class KnowledgeModule {}
